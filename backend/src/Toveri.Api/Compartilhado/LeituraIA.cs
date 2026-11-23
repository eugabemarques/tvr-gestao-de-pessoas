using System.Text.Json;
using Anthropic;
using Anthropic.Models.Messages;

namespace Toveri.Api.Compartilhado;

/// <summary>
/// Leitura de documentos anexados com IA (Claude): RG, CNH, PIS, título, passaporte, comprovante de
/// residência e certificados de curso/ASO, em qualquer modelo, foto ou PDF. Devolve só os campos; a
/// tela confere os dígitos verificadores, preenche apenas o que está vazio e marca "confira".
///
/// Configuração (App Settings):
///   Toveri__ClaudeApiKey = chave da API da Anthropic. Vazio = leitura com IA desligada (a tela usa o
///                          leitor do navegador).
///   Toveri__ClaudeModelo = modelo (padrão claude-haiku-5-5, o mais barato: frações de centavo por documento).
/// </summary>
public static class LeituraIA
{
    public const string ModeloPadrao = "claude-haiku-5-5";
    /// <summary>Limite do arquivo enviado à IA (a API aceita até 32 MB por requisição).</summary>
    public const long MaxBytes = 15 * 1024 * 1024;

    /// <summary>Tudo o que a IA consegue tirar do documento; a tela escolhe o que vale para o campo do clipe.</summary>
    public sealed record Resultado(
        string Nome, string Cpf, string Rg, string Pis, string Titulo, string Passaporte, string Ctps, string Ctf,
        string Mae, string Pai, string Rua, string Numero, string Bairro, string Cidade, string Cep, string Escolaridade,
        string Validade, string DataExame);

    private static readonly string[] Campos =
        ["nome", "cpf", "rg", "pis", "titulo", "passaporte", "ctps", "ctf", "mae", "pai", "rua", "numero", "bairro", "cidade", "cep", "escolaridade", "validade", "data_exame"];

    private const string Instrucoes = """
        Você lê documentos brasileiros anexados à ficha de um colaborador no RH (RG, CNH, CPF, cartão ou extrato do PIS/NIS,
        título de eleitor, passaporte, CTPS, certidão de nascimento ou casamento, comprovante de residência, comprovante de
        escolaridade, CTF do Ibama, certificados de cursos, exames e ASO) e devolve todos os dados pedidos que estiverem nele.

        Regras:
        - Copie apenas o que está escrito no documento. Nunca invente nem complete dígitos que não dá para ler: na dúvida, deixe "".
        - Campo que não existe no documento: "".
        - nome: nome completo do titular, como está no documento (em CNH, passaporte e certidão, o do titular, não o dos pais).
        - cpf: 11 dígitos no formato 000.000.000-00.
        - rg: número do documento de identidade (RG) com o dígito, sem o órgão emissor nem a UF. Na CNH, o campo
          "Doc. identidade". Não confunda com o nº de registro da CNH nem com o CPF.
        - pis: PIS/PASEP/NIS/NIT, 11 dígitos no formato 000.00000.00-0.
        - titulo: número do título de eleitor, 12 dígitos no formato 0000 0000 0000.
        - passaporte: número do passaporte (ex.: FZ123456).
        - ctps: número e série da Carteira de Trabalho (ex.: 1234567 série 00123-SP). Na CTPS digital, o número que aparece como nº da CTPS (costuma ser o CPF).
        - ctf: número do Cadastro Técnico Federal (CTF) do Ibama, ou o nº de registro do certificado de regularidade.
        - mae / pai: nomes completos da mãe e do pai do titular (filiação), como estão no documento.
        - rua, numero, bairro, cidade, cep: endereço do titular. Num comprovante de residência (conta de luz, água, telefone,
          banco), é o endereço do cliente/da instalação, não o da empresa emissora. rua sem o número; numero só o número
          (e complemento, se houver); cidade como "Cidade - UF"; cep no formato 00000-000.
        - escolaridade: só num comprovante de escolaridade (diploma, histórico, certificado de conclusão), o nível concluído,
          exatamente um destes: "Ensino fundamental", "Ensino médio", "Ensino técnico", "Ensino superior", "Pós-graduação". Senão "".
        - validade: data de validade/vencimento do certificado, curso, exame, ASO ou CTF, no formato AAAA-MM-DD. Se o documento
          só tiver a data de emissão ou de realização, deixe "".
        - data_exame: data em que o exame ou curso foi realizado/concluído, no formato AAAA-MM-DD.
        """;

    private static readonly Dictionary<string, JsonElement> Esquema = new()
    {
        ["type"] = JsonSerializer.SerializeToElement("object"),
        ["properties"] = JsonSerializer.SerializeToElement(Campos.ToDictionary(c => c, _ => new { type = "string" })),
        ["required"] = JsonSerializer.SerializeToElement(Campos),
        ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
    };

    public static bool Configurada(IConfiguration cfg) => !string.IsNullOrWhiteSpace(cfg["Toveri:ClaudeApiKey"]);

    /// <summary>Tipo de mídia aceito pela IA, pela extensão do arquivo (nunca pelo que o navegador declarou).</summary>
    public static string? TipoDoArquivo(string nome) => Path.GetExtension(nome).ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".webp" => "image/webp",
        ".gif" => "image/gif",
        _ => null,
    };

    public static async Task<Resultado> Ler(IConfiguration cfg, byte[] conteudo, string tipo, string? dica, CancellationToken ct)
    {
        var client = new AnthropicClient { ApiKey = cfg["Toveri:ClaudeApiKey"] };
        var b64 = Convert.ToBase64String(conteudo);
        ContentBlockParam anexo = tipo == "application/pdf"
            ? new DocumentBlockParam { Source = new Base64PdfSource { Data = b64 } }
            : new ImageBlockParam { Source = new Base64ImageSource { Data = b64, MediaType = tipo } };
        var pedido = "Documento anexado no campo \"" + (dica ?? "documento") + "\" da ficha. Extraia os dados.";

        var resp = await client.Messages.Create(new MessageCreateParams
        {
            Model = string.IsNullOrWhiteSpace(cfg["Toveri:ClaudeModelo"]) ? ModeloPadrao : cfg["Toveri:ClaudeModelo"]!,
            MaxTokens = 4096,
            System = Instrucoes,
            OutputConfig = new OutputConfig { Effort = Effort.Low, Format = new JsonOutputFormat { Schema = Esquema } },
            Messages = [new UserMessageParam { Content = new List<ContentBlockParam> { anexo, new TextBlockParam { Text = pedido } } }],
        }, ct);

        if (resp.StopReason == "refusal") throw new InvalidOperationException("A IA não leu este documento.");
        var json = string.Concat(resp.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
        using var doc = JsonDocument.Parse(json);
        string C(string k) => doc.RootElement.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString()!.Trim() : "";
        return new Resultado(C("nome"), C("cpf"), C("rg"), C("pis"), C("titulo"), C("passaporte"), C("ctps"), C("ctf"),
            C("mae"), C("pai"), C("rua"), C("numero"), C("bairro"), C("cidade"), C("cep"), C("escolaridade"), C("validade"), C("data_exame"));
    }
}
