using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;

namespace Toveri.Api.Compartilhado;

/// <summary>
/// Dados compartilhados das telas (mesmo protocolo do servidor de referência em Python):
/// um documento JSON com as coleções do programa, alterado por "patches" registro a registro.
/// Duas pessoas editando colaboradores diferentes não perdem nada; na mesma ficha, vale a última gravação.
///
/// Guardado num SQLite em <c>Toveri:Dados</c> (no Azure, /home/dados, que é persistente e entra no backup).
/// Etapa intermediária até as rotas de cada cadastro usarem o banco definitivo (Azure SQL).
/// </summary>
public sealed class EstadoCompartilhado
{
    private static readonly Dictionary<string, Func<JsonNode?, string>> Chaves = new()
    {
        ["people"] = x => Texto(Campo(x, "id")),
        ["boats"] = x => Texto(Campo(x, "id")),
        ["courses"] = x => Texto(Campo(x, "pid")) + "|" + Texto(Campo(x, "name")),
        ["hist"] = x => Texto(Campo(x, "pid")) + "|" + Texto(Campo(x, "ini")),
        ["resolved"] = x => Texto(x),
    };

    private readonly string _conexao;
    private readonly SemaphoreSlim _trava = new(1, 1);

    public string PastaDados { get; }
    public string PastaArquivos { get; }

    public EstadoCompartilhado(string pastaDados)
    {
        PastaDados = Path.GetFullPath(pastaDados);
        PastaArquivos = Path.Combine(PastaDados, "arquivos");
        Directory.CreateDirectory(PastaArquivos);
        _conexao = new SqliteConnectionStringBuilder
        {
            DataSource = Path.Combine(PastaDados, "toveri.db"),
            Pooling = false,
            DefaultTimeout = 30,
        }.ToString();

        using var c = Abrir();
        Executar(c, """
            CREATE TABLE IF NOT EXISTS estado(
              id INTEGER PRIMARY KEY CHECK(id=1), dados TEXT, versao INTEGER NOT NULL,
              atualizado_em TEXT, atualizado_por TEXT);
            CREATE TABLE IF NOT EXISTS arquivos(
              id TEXT PRIMARY KEY, nome TEXT NOT NULL, tamanho INTEGER NOT NULL, tipo TEXT,
              criado_em TEXT NOT NULL, criado_por TEXT);
            CREATE TABLE IF NOT EXISTS auditoria(
              id INTEGER PRIMARY KEY, quando TEXT NOT NULL, usuario TEXT, acao TEXT NOT NULL, detalhe TEXT);
            INSERT OR IGNORE INTO estado(id,dados,versao) VALUES(1,NULL,0);
            """);
    }

    public SqliteConnection Conexao() => Abrir();

    private SqliteConnection Abrir()
    {
        var c = new SqliteConnection(_conexao);
        c.Open();
        // O /home do App Service é um compartilhamento de rede: o modo WAL não é confiável lá.
        Executar(c, "PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;");
        return c;
    }

    private static void Executar(SqliteConnection c, string sql, params (string, object?)[] p)
    {
        using var cmd = c.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (n, v) in p) cmd.Parameters.AddWithValue(n, v ?? DBNull.Value);
        cmd.ExecuteNonQuery();
    }

    private static string Agora() => DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);

    public (JsonNode? Dados, long Versao) Ler()
    {
        using var c = Abrir();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT dados, versao FROM estado WHERE id=1";
        using var r = cmd.ExecuteReader();
        r.Read();
        var dados = r.IsDBNull(0) ? null : JsonNode.Parse(r.GetString(0));
        return (dados, r.GetInt64(1));
    }

    public long Versao() => Ler().Versao;

    /// <summary>
    /// Aplica e grava um patch. Sem <paramref name="podeCorrigirHistorico"/> (quem não é Admin RH), alterações em
    /// embarques antigos são descartadas (ver <see cref="FiltrarHistorico"/>) e contadas em <c>Bloqueadas</c>.
    /// Toda correção de embarque já registrado fica na auditoria com o valor antigo e o novo.
    /// </summary>
    public async Task<(JsonNode Dados, long Versao, int Bloqueadas)> GravarPatch(JsonArray ops, string usuario, bool podeCorrigirHistorico = true)
    {
        await _trava.WaitAsync();
        try
        {
            using var c = Abrir();
            using var tx = c.BeginTransaction();
            string? texto; long versao;
            using (var cmd = c.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = "SELECT dados, versao FROM estado WHERE id=1";
                using var r = cmd.ExecuteReader();
                r.Read();
                texto = r.IsDBNull(0) ? null : r.GetString(0);
                versao = r.GetInt64(1);
            }
            var estado = (texto is null ? null : JsonNode.Parse(texto)) as JsonObject ?? Vazio();
            var (permitidas, bloqueadas, correcoes) = FiltrarHistorico(estado, ops, podeCorrigirHistorico);
            ops = permitidas;
            Aplicar(estado, ops);
            var nova = versao + 1;
            using (var cmd = c.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = "UPDATE estado SET dados=$d, versao=$v, atualizado_em=$t, atualizado_por=$u WHERE id=1";
                cmd.Parameters.AddWithValue("$d", estado.ToJsonString());
                cmd.Parameters.AddWithValue("$v", nova);
                cmd.Parameters.AddWithValue("$t", Agora());
                cmd.Parameters.AddWithValue("$u", usuario);
                cmd.ExecuteNonQuery();
            }
            Auditar(c, tx, usuario, "alterou dados", Resumo(ops));
            foreach (var corr in correcoes) Auditar(c, tx, usuario, "corrigiu embarque", corr);
            if (bloqueadas.Count > 0)
                Auditar(c, tx, usuario, "bloqueado: correção de embarque só para Admin RH", new JsonArray(bloqueadas.Select(b => (JsonNode?)b.DeepClone()).ToArray()));
            tx.Commit();
            return (estado, nova, bloqueadas.Count);
        }
        finally { _trava.Release(); }
    }

    /// <summary>
    /// Separa as alterações do histórico de embarques. Incluir um embarque novo e ajustar o mais recente do
    /// colaborador (dobra, translado, novo registro na mesma data) é rotina do RH; alterar um embarque anterior
    /// ou apagar qualquer embarque registrado é correção, permitida só ao Admin RH.
    /// Devolve as operações permitidas, as bloqueadas e, para a auditoria, cada correção com o valor antigo e o novo.
    /// </summary>
    public static (JsonArray Permitidas, List<JsonObject> Bloqueadas, List<JsonObject> Correcoes) FiltrarHistorico(
        JsonObject estado, JsonArray ops, bool podeCorrigir)
    {
        var permitidas = new JsonArray();
        var bloqueadas = new List<JsonObject>();
        var correcoes = new List<JsonObject>();
        var hist = (estado["hist"] as JsonArray ?? []).OfType<JsonObject>().ToList();
        foreach (var o in ops.OfType<JsonObject>())
        {
            if (Texto(Campo(o, "c")) != "hist")
            {
                permitidas.Add(o.DeepClone());
                continue;
            }
            var substituiTudo = Verdadeiro(Campo(o, "w"));
            var k = Texto(Campo(o, "k"));
            var antes = substituiTudo ? null : hist.FirstOrDefault(h => Texto(Campo(h, "pid")) + "|" + Texto(Campo(h, "ini")) == k);
            var depois = Campo(o, "v");
            var correcao = substituiTudo || (antes is not null && (depois is null || !EhMaisRecente(hist, antes)));
            if (correcao && !podeCorrigir)
            {
                bloqueadas.Add((JsonObject)o.DeepClone());
                continue;
            }
            if (antes is not null && !JsonNode.DeepEquals(antes, depois))
                correcoes.Add(new JsonObject { ["antes"] = antes.DeepClone(), ["depois"] = depois?.DeepClone() });
            permitidas.Add(o.DeepClone());
        }
        return (permitidas, bloqueadas, correcoes);
    }

    /// <summary>O embarque é o mais recente (maior data de início) do colaborador?</summary>
    private static bool EhMaisRecente(List<JsonObject> hist, JsonObject h)
    {
        var pid = Texto(Campo(h, "pid"));
        var ini = Numero(Campo(h, "ini"));
        return !hist.Any(x => Texto(Campo(x, "pid")) == pid && Numero(Campo(x, "ini")) > ini);
    }

    private static double Numero(JsonNode? n) =>
        n is JsonValue v && v.GetValueKind() == JsonValueKind.Number ? v.GetValue<double>()
        : double.TryParse(Texto(n), NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : double.NaN;

    public static JsonObject Vazio() => new()
    {
        ["people"] = new JsonArray(), ["boats"] = new JsonArray(), ["courses"] = new JsonArray(),
        ["hist"] = new JsonArray(), ["resolved"] = new JsonArray(), ["log"] = new JsonArray(),
    };

    /// <summary>Mesma regra de <c>aplicarPatch</c> das telas e de <c>estado.aplicar</c> do servidor Python.</summary>
    public static JsonObject Aplicar(JsonObject estado, JsonArray ops)
    {
        foreach (var o in ops.OfType<JsonObject>())
        {
            if (Campo(o, "c") is not JsonValue cv || !cv.TryGetValue(out string? col) || col.StartsWith('_'))
                continue;
            var valor = Campo(o, "v")?.DeepClone();
            if (Verdadeiro(Campo(o, "w")) || !Chaves.TryGetValue(col, out var chave))
            {
                estado[col] = valor;
                continue;
            }
            if (estado[col] is not JsonArray lista)
            {
                lista = new JsonArray();
                estado[col] = lista;
            }
            var k = Texto(Campo(o, "k"));
            var i = -1;
            for (var n = 0; n < lista.Count; n++)
                if (chave(lista[n]) == k) { i = n; break; }
            if (valor is null) { if (i >= 0) lista.RemoveAt(i); }
            else if (i >= 0) lista[i] = valor;
            else lista.Add(valor);
        }
        return estado;
    }

    private static JsonNode? Campo(JsonNode? x, string nome) =>
        x is JsonObject o && o.TryGetPropertyValue(nome, out var v) ? v : null;

    private static bool Verdadeiro(JsonNode? n) => n switch
    {
        null => false,
        JsonValue v when v.TryGetValue(out bool b) => b,
        JsonValue v when v.TryGetValue(out double d) => d != 0,
        JsonValue v when v.TryGetValue(out string? s) => !string.IsNullOrEmpty(s),
        _ => true,
    };

    /// <summary>Equivale ao String(x) do JavaScript para os valores usados como chave.</summary>
    private static string Texto(JsonNode? n)
    {
        if (n is null) return "null";
        if (n is JsonValue v)
        {
            if (v.TryGetValue(out string? s)) return s;
            if (v.TryGetValue(out bool b)) return b ? "true" : "false";
            if (v.GetValueKind() == JsonValueKind.Number)
            {
                var d = v.GetValue<double>();
                return d == Math.Floor(d) && Math.Abs(d) < 1e15
                    ? ((long)d).ToString(CultureInfo.InvariantCulture)
                    : d.ToString("R", CultureInfo.InvariantCulture);
            }
        }
        return n.ToJsonString();
    }

    private static JsonObject Resumo(JsonArray ops)
    {
        var r = new JsonObject();
        foreach (var o in ops.OfType<JsonObject>())
        {
            var col = Texto(Campo(o, "c"));
            if (r[col] is not JsonArray l) { l = new JsonArray(); r[col] = l; }
            l.Add((Campo(o, "v") is null ? "removido " : "") + (Campo(o, "k") is null ? "" : Texto(Campo(o, "k"))));
        }
        return r;
    }

    private static void Auditar(SqliteConnection c, SqliteTransaction? tx, string usuario, string acao, JsonNode? detalhe)
    {
        using var cmd = c.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "INSERT INTO auditoria(quando,usuario,acao,detalhe) VALUES($q,$u,$a,$d)";
        cmd.Parameters.AddWithValue("$q", Agora());
        cmd.Parameters.AddWithValue("$u", usuario);
        cmd.Parameters.AddWithValue("$a", acao);
        cmd.Parameters.AddWithValue("$d", (object?)detalhe?.ToJsonString() ?? DBNull.Value);
        cmd.ExecuteNonQuery();
    }

    public void Auditar(string usuario, string acao, JsonNode? detalhe = null)
    {
        using var c = Abrir();
        Auditar(c, null, usuario, acao, detalhe);
    }

    // ---------------------------------------------------------------- arquivos

    public const long MaxArquivo = 20 * 1024 * 1024;
    private static readonly HashSet<string> Extensoes = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];

    public async Task<JsonObject> SalvarArquivo(IFormFile arquivo, string usuario)
    {
        var ext = Path.GetExtension(arquivo.FileName ?? "").ToLowerInvariant();
        if (!Extensoes.Contains(ext))
            throw new ArgumentException("Tipo de arquivo não aceito. Envie PDF ou imagem.");
        if (arquivo.Length > MaxArquivo)
            throw new ArgumentException("O arquivo passa de 20 MB.");
        var fid = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
        var destino = Path.Combine(PastaArquivos, fid);
        await using (var f = File.Create(destino))
            await arquivo.CopyToAsync(f);
        var nome = Path.GetFileName(arquivo.FileName ?? "arquivo");
        using var c = Abrir();
        Executar(c, "INSERT INTO arquivos(id,nome,tamanho,tipo,criado_em,criado_por) VALUES($i,$n,$t,$y,$q,$u)",
            ("$i", fid), ("$n", nome), ("$t", arquivo.Length), ("$y", arquivo.ContentType), ("$q", Agora()), ("$u", usuario));
        Auditar(c, null, usuario, "enviou arquivo", new JsonObject { ["arquivo"] = nome, ["fid"] = fid });
        return new JsonObject { ["fid"] = fid, ["name"] = nome, ["size"] = arquivo.Length };
    }

    public (string Caminho, string Nome, string Tipo)? Arquivo(string fid)
    {
        if (fid.Length != 24 || !fid.All(Uri.IsHexDigit)) return null;
        var caminho = Path.Combine(PastaArquivos, fid.ToLowerInvariant());
        if (!File.Exists(caminho)) return null;
        using var c = Abrir();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT nome, tipo FROM arquivos WHERE id=$i";
        cmd.Parameters.AddWithValue("$i", fid.ToLowerInvariant());
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return (caminho, r.GetString(0), r.IsDBNull(1) ? "application/octet-stream" : r.GetString(1));
    }
}
