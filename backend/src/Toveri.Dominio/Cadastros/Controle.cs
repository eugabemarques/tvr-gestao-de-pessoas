namespace Toveri.Dominio.Cadastros;

/// <summary>Aviso marcado como resolvido pelo RH.</summary>
public class AvisoResolvido
{
    public int Id { get; set; }

    /// <summary>Identifica o aviso (colaborador, item e validade), para ele não reaparecer.</summary>
    public string Chave { get; set; } = "";

    public DateTimeOffset ResolvidoEm { get; set; }
    public string ResolvidoPor { get; set; } = "";
}

/// <summary>Registro de auditoria exigido pela LGPD: quem fez o quê, quando, e o que mudou.</summary>
public class RegistroAuditoria
{
    public long Id { get; set; }
    public DateTimeOffset Quando { get; set; }
    public string Usuario { get; set; } = "";

    /// <summary>Ex.: "consultou", "alterou", "abriu documento", "login".</summary>
    public string Acao { get; set; } = "";

    public string? Entidade { get; set; }
    public string? EntidadeId { get; set; }

    /// <summary>Valores antes e depois, em JSON.</summary>
    public string? ValorAnterior { get; set; }
    public string? ValorNovo { get; set; }

    public string? Ip { get; set; }
}
