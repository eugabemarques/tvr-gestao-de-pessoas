using Toveri.Dominio.Escala;

namespace Toveri.Dominio.Cadastros;

public class Setor
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";

    /// <summary>Escala obrigatória do setor. Vazio quando o setor não trabalha embarcado.</summary>
    public int? RegraEscalaId { get; set; }
    public RegraEscala? RegraEscala { get; set; }
}

public class Barco
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";

    /// <summary>Ex.: PSV, OSRV, AHTS.</summary>
    public string? Tipo { get; set; }

    public string? Observacoes { get; set; }
    public bool Ativo { get; set; } = true;
}

public class Ferias
{
    public int Id { get; set; }
    public int ColaboradorId { get; set; }
    public DateOnly Inicio { get; set; }
    public DateOnly Fim { get; set; }

    public bool Inclui(DateOnly data) => data >= Inicio && data <= Fim;
}
