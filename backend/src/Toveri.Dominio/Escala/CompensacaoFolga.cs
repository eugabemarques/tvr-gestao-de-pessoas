namespace Toveri.Dominio.Escala;

/// <summary>
/// Compensação de folga não gozada. O RH escolhe quando compensar, conforme o cronograma do projeto
/// e a disponibilidade. A compensação começa no dia em que o colaborador embarcaria e adia o
/// embarque seguinte.
/// </summary>
public class CompensacaoFolga
{
    public int Id { get; set; }
    public int ColaboradorId { get; set; }
    public DateOnly Inicio { get; set; }
    public int Dias { get; set; }
    public string? Observacao { get; set; }
    public DateTimeOffset RegistradoEm { get; set; }
    public string RegistradoPor { get; set; } = "";

    public DateOnly Fim => Inicio.AddDays(Dias - 1);
    public bool Inclui(DateOnly data) => data >= Inicio && data <= Fim;
}

/// <summary>Folga não gozada acumulada e quanto dela já foi compensado.</summary>
public sealed record SaldoFolga(int NaoGozados, int Compensados)
{
    public int Saldo => NaoGozados - Compensados;
}
