using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Azure.Core;
using Azure.Identity;
using Microsoft.Data.Sqlite;

namespace Toveri.Api.Compartilhado;

/// <summary>
/// Copia os cadastros para a pasta do RH no SharePoint, uma subpasta por colaborador:
///   &lt;pasta&gt;/&lt;Nome do colaborador&gt;/Cadastro.txt            (dados da ficha)
///   &lt;pasta&gt;/&lt;Nome do colaborador&gt;/&lt;Documento&gt;.pdf     (cada anexo, com o nome do documento)
/// Nunca apaga nada no SharePoint. O que falhar fica pendente e é reenviado a cada minuto.
///
/// Autenticação: identidade gerenciada do App Service, com a permissão Sites.Selected do Microsoft Graph
/// e gravação liberada só no site do Administrativo (sem senha guardada em lugar nenhum).
/// Configuração: Toveri__SpDriveId e Toveri__SpPastaId (biblioteca e pasta de destino).
/// </summary>
public sealed class EnvioSharePoint : BackgroundService
{
    private readonly EstadoCompartilhado _estado;
    private readonly ILogger<EnvioSharePoint> _log;
    private readonly string? _drive, _pasta;
    private readonly TokenCredential _credencial = new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned);
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromMinutes(5) };
    private readonly SemaphoreSlim _acordar = new(0);
    private readonly SemaphoreSlim _trava = new(1, 1);

    public EnvioSharePoint(EstadoCompartilhado estado, IConfiguration cfg, ILogger<EnvioSharePoint> log)
    {
        _estado = estado;
        _log = log;
        _drive = cfg["Toveri:SpDriveId"];
        _pasta = cfg["Toveri:SpPastaId"];
        using var c = _estado.Conexao();
        using var cmd = c.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS sp_pastas(pessoa_id TEXT PRIMARY KEY, nome TEXT UNIQUE NOT NULL);
            CREATE TABLE IF NOT EXISTS sp_envios(
              chave TEXT PRIMARY KEY, pessoa_id TEXT NOT NULL, tipo TEXT NOT NULL, fid TEXT, nome_arquivo TEXT NOT NULL,
              conteudo TEXT, situacao TEXT NOT NULL, tentativas INTEGER NOT NULL DEFAULT 0, erro TEXT, atualizado_em TEXT);
            """;
        cmd.ExecuteNonQuery();
    }

    public bool Configurado => !string.IsNullOrWhiteSpace(_drive) && !string.IsNullOrWhiteSpace(_pasta);

    /// <summary>Chamado depois de cada gravação: agenda o envio das fichas e anexos dessas pessoas.</summary>
    public void Agendar(IEnumerable<JsonNode?> pessoas)
    {
        using var c = _estado.Conexao();
        foreach (var p in pessoas.OfType<JsonObject>())
        {
            var pid = p["id"]?.ToString();
            if (string.IsNullOrEmpty(pid)) continue;
            // Ficha: reenvia sempre que os dados mudarem.
            var ficha = Ficha(p);
            Upsert(c, $"ficha|{pid}", pid, "ficha", null, "Cadastro.txt", ficha);
            // Anexos: cada arquivo (fid) uma vez; se o anexo daquele documento for trocado, o novo também vai.
            foreach (var d in (p["docs"] as JsonArray ?? []).OfType<JsonObject>())
            {
                var fid = d["fid"]?.GetValue<string>();
                if (string.IsNullOrEmpty(fid)) continue;
                Upsert(c, $"arq|{fid}", pid, "arquivo", fid, NomeDocumento(d), null);
            }
        }
        _acordar.Release();
    }

    private static void Upsert(SqliteConnection c, string chave, string pid, string tipo, string? fid, string nome, string? conteudo)
    {
        using var cmd = c.CreateCommand();
        // Arquivo já enviado não volta para a fila; ficha volta só se o conteúdo mudou.
        cmd.CommandText = """
            INSERT INTO sp_envios(chave,pessoa_id,tipo,fid,nome_arquivo,conteudo,situacao,atualizado_em)
            VALUES($k,$p,$t,$f,$n,$c,'pendente',$q)
            ON CONFLICT(chave) DO UPDATE SET
              nome_arquivo=excluded.nome_arquivo,
              situacao=CASE WHEN sp_envios.tipo='ficha' AND IFNULL(sp_envios.conteudo,'')<>IFNULL(excluded.conteudo,'')
                            THEN 'pendente' ELSE sp_envios.situacao END,
              tentativas=CASE WHEN sp_envios.tipo='ficha' AND IFNULL(sp_envios.conteudo,'')<>IFNULL(excluded.conteudo,'')
                            THEN 0 ELSE sp_envios.tentativas END,
              conteudo=excluded.conteudo, atualizado_em=excluded.atualizado_em
            """;
        cmd.Parameters.AddWithValue("$k", chave);
        cmd.Parameters.AddWithValue("$p", pid);
        cmd.Parameters.AddWithValue("$t", tipo);
        cmd.Parameters.AddWithValue("$f", (object?)fid ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$n", nome);
        cmd.Parameters.AddWithValue("$c", (object?)conteudo ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$q", DateTime.UtcNow.ToString("O"));
        cmd.ExecuteNonQuery();
    }

    protected override async Task ExecuteAsync(CancellationToken parar)
    {
        if (!Configurado) { _log.LogWarning("SharePoint não configurado (Toveri:SpDriveId / Toveri:SpPastaId)."); return; }
        // Ao iniciar, garante que todo mundo que já está cadastrado entra na fila.
        try { Agendar((_estado.Ler().Dados?["people"] as JsonArray ?? []).ToList()); }
        catch (Exception e) { _log.LogError(e, "Falha ao preparar a fila do SharePoint"); }
        while (!parar.IsCancellationRequested)
        {
            try { await Processar(parar); }
            catch (Exception e) when (e is not OperationCanceledException) { _log.LogError(e, "Falha no envio ao SharePoint"); }
            await _acordar.WaitAsync(TimeSpan.FromMinutes(1), parar).ContinueWith(_ => { }, TaskScheduler.Default);
        }
    }

    public async Task<int> Processar(CancellationToken parar)
    {
        await _trava.WaitAsync(parar);
        try
        {
            var pendentes = new List<(string Chave, string Pid, string Tipo, string? Fid, string Nome, string? Conteudo)>();
            using (var c = _estado.Conexao())
            using (var cmd = c.CreateCommand())
            {
                cmd.CommandText = "SELECT chave,pessoa_id,tipo,fid,nome_arquivo,conteudo FROM sp_envios WHERE situacao='pendente' ORDER BY tipo DESC LIMIT 200";
                using var r = cmd.ExecuteReader();
                while (r.Read())
                    pendentes.Add((r.GetString(0), r.GetString(1), r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3),
                        r.GetString(4), r.IsDBNull(5) ? null : r.GetString(5)));
            }
            if (pendentes.Count == 0) return 0;

            var pessoas = (_estado.Ler().Dados?["people"] as JsonArray ?? []).OfType<JsonObject>()
                .ToDictionary(p => p["id"]?.ToString() ?? "", p => p);
            var token = (await _credencial.GetTokenAsync(new TokenRequestContext(["https://graph.microsoft.com/.default"]), parar)).Token;
            var enviados = 0;
            foreach (var e in pendentes)
            {
                if (!pessoas.TryGetValue(e.Pid, out var pessoa)) { Marcar(e.Chave, "ignorado", "Colaborador removido."); continue; }
                byte[] conteudo;
                if (e.Tipo == "ficha") conteudo = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(e.Conteudo ?? "")).ToArray();
                else
                {
                    var a = e.Fid is null ? null : _estado.Arquivo(e.Fid);
                    if (a is null) { Marcar(e.Chave, "ignorado", "Arquivo não encontrado no servidor."); continue; }
                    conteudo = await File.ReadAllBytesAsync(a.Value.Caminho, parar);
                }
                var pasta = PastaDaPessoa(e.Pid, pessoa);
                var caminho = Uri.EscapeDataString(pasta) + "/" + Uri.EscapeDataString(e.Nome);
                var url = $"https://graph.microsoft.com/v1.0/drives/{_drive}/items/{_pasta}:/{caminho}:/content?@microsoft.graph.conflictBehavior=replace";
                using var req = new HttpRequestMessage(HttpMethod.Put, url) { Content = new ByteArrayContent(conteudo) };
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                using var resp = await _http.SendAsync(req, parar);
                if (resp.IsSuccessStatusCode) { Marcar(e.Chave, "enviado", null); enviados++; }
                else
                {
                    var corpo = await resp.Content.ReadAsStringAsync(parar);
                    _log.LogWarning("SharePoint {Status} ao enviar {Nome}: {Corpo}", (int)resp.StatusCode, e.Nome, corpo.Length > 300 ? corpo[..300] : corpo);
                    Marcar(e.Chave, "pendente", $"{(int)resp.StatusCode} {resp.StatusCode}", contar: true);
                    if (resp.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) break; // sem permissão: tenta tudo de novo depois
                }
            }
            if (enviados > 0) _log.LogInformation("SharePoint: {N} arquivo(s) enviado(s).", enviados);
            return enviados;
        }
        finally { _trava.Release(); }
    }

    private void Marcar(string chave, string situacao, string? erro, bool contar = false)
    {
        using var c = _estado.Conexao();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "UPDATE sp_envios SET situacao=$s, erro=$e, tentativas=tentativas+$t, atualizado_em=$q WHERE chave=$k";
        cmd.Parameters.AddWithValue("$s", situacao);
        cmd.Parameters.AddWithValue("$e", (object?)erro ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$t", contar ? 1 : 0);
        cmd.Parameters.AddWithValue("$q", DateTime.UtcNow.ToString("O"));
        cmd.Parameters.AddWithValue("$k", chave);
        cmd.ExecuteNonQuery();
    }

    public JsonObject Situacao()
    {
        using var c = _estado.Conexao();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT situacao, COUNT(*), MAX(erro) FROM sp_envios GROUP BY situacao";
        using var r = cmd.ExecuteReader();
        var o = new JsonObject { ["configurado"] = Configurado };
        while (r.Read()) o[r.GetString(0)] = new JsonObject { ["quantidade"] = r.GetInt64(1), ["ultimoErro"] = r.IsDBNull(2) ? null : r.GetString(2) };
        return o;
    }

    /// <summary>A pasta de cada pessoa é fixada no primeiro envio (renomear a pessoa não cria outra pasta).</summary>
    private string PastaDaPessoa(string pid, JsonObject pessoa)
    {
        using var c = _estado.Conexao();
        using (var cmd = c.CreateCommand())
        {
            cmd.CommandText = "SELECT nome FROM sp_pastas WHERE pessoa_id=$p";
            cmd.Parameters.AddWithValue("$p", pid);
            if (cmd.ExecuteScalar() is string existente) return existente;
        }
        var baseNome = Limpa(Texto(pessoa["name"]), $"Colaborador {pid}");
        var nome = baseNome;
        for (var n = 2; ; n++)
        {
            using var cmd = c.CreateCommand();
            cmd.CommandText = "INSERT OR IGNORE INTO sp_pastas VALUES($p,$n)";
            cmd.Parameters.AddWithValue("$p", pid);
            cmd.Parameters.AddWithValue("$n", nome);
            if (cmd.ExecuteNonQuery() == 1) return nome;
            nome = $"{baseNome} ({n})";
        }
    }

    // ---------------------------------------------------------------- nomes e ficha

    private static string Texto(JsonNode? n) => WebUtility.HtmlDecode(n is JsonValue v && v.TryGetValue(out string? s) ? s : n?.ToString() ?? "");

    public static string Limpa(string nome, string padrao = "arquivo")
    {
        nome = Regex.Replace(nome ?? "", "[\\\\/:*?\"<>|#%\\x00-\\x1f]+", "-");
        nome = Regex.Replace(nome, "\\s+", " ").Trim().Trim('.');
        if (nome.Length > 80) nome = nome[..80].Trim();
        return nome.Length == 0 ? padrao : nome;
    }

    public static string NomeDocumento(JsonObject d)
    {
        var nomeOriginal = Texto(d["name"]);
        var ext = Path.GetExtension(nomeOriginal).ToLowerInvariant();
        var campo = Texto(d["campo"]);
        if (string.IsNullOrWhiteSpace(campo)) return Limpa(nomeOriginal);
        campo = Regex.Replace(campo, "^Curso: ", "Curso - ");
        campo = Regex.Replace(campo, "^Vacina: ", "Vacina - ");
        // Mesmo documento com mais de um arquivo (ex.: frente e verso): o id evita sobrescrever.
        var fid = Texto(d["fid"]);
        return Limpa(campo) + (fid.Length >= 6 ? $" ({fid[..6]})" : "") + ext;
    }

    private static readonly (string Chave, string Rotulo)[] Campos =
    [
        ("name", "Nome completo"), ("setor", "Setor"), ("role", "Cargo"), ("unit", "Embarcação ou unidade"),
        ("rg", "RG"), ("cpf", "CPF"), ("pis", "PIS"), ("pass", "Passaporte"), ("tit", "Título de eleitor"),
        ("mae", "Nome da mãe"), ("pai", "Nome do pai"), ("email", "E-mail"), ("cel", "Celular"),
        ("emerg", "Contato de emergência"), ("rua", "Rua"), ("num", "Número"), ("bairro", "Bairro"),
        ("cidade", "Cidade"), ("cep", "CEP"),
    ];

    public static string Ficha(JsonObject p)
    {
        var sb = new StringBuilder();
        sb.AppendLine("TOVERI - Gestão de Pessoas");
        sb.AppendLine("Cadastro do colaborador (gerado automaticamente pelo sistema; edite no sistema, não aqui)");
        sb.AppendLine();
        foreach (var (k, rotulo) in Campos)
        {
            var v = Texto(p[k]);
            if (k == "setor" && v.Length > 0) v = v switch { "ambiental" => "Ambiental", "administrativo" => "Administrativo", "manutencao" => "Manutenção Offshore", _ => v };
            sb.AppendLine($"{rotulo}: {(string.IsNullOrWhiteSpace(v) ? "-" : v)}");
        }
        var docs = (p["docs"] as JsonArray ?? []).OfType<JsonObject>().ToList();
        sb.AppendLine();
        sb.AppendLine($"Documentos anexados: {docs.Count}");
        foreach (var d in docs) sb.AppendLine($"- {(Texto(d["campo"]) is { Length: > 0 } c ? c : "Outros")}: {Texto(d["name"])}");
        return sb.ToString();
    }
}
