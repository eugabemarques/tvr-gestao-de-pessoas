namespace Toveri.Dominio.Escala;

public enum OrigemPeriodo
{
    /// <summary>Embarque lançado pelo RH.</summary>
    Registrado,

    /// <summary>Embarque calculado pela escala padrão, ainda não confirmado.</summary>
    Previsto,
}

/// <summary>Um embarque com a folga que ele gera.</summary>
/// <param name="DiasFolga">Folga efetivamente gozada antes do próximo embarque.</param>
/// <param name="DiasFolgaNaoGozados">Folga que deixou de ser gozada porque o embarque seguinte começou antes.</param>
/// <param name="RegraVigenteDesde">Início de vigência da versão da regra usada no cálculo.</param>
public sealed record PeriodoEscala(
    DateOnly Inicio,
    int DiasEmbarcado,
    int DiasDobra,
    int DiasFolga,
    int DiasFolgaNaoGozados,
    int? BarcoId,
    OrigemPeriodo Origem,
    DateOnly RegraVigenteDesde)
{
    public int DiasABordo => DiasEmbarcado + DiasDobra;
    public DateOnly UltimoDiaABordo => Inicio.AddDays(DiasABordo - 1);
    public DateOnly PrimeiroDiaDeFolga => Inicio.AddDays(DiasABordo);
    public DateOnly UltimoDiaDeFolga => PrimeiroDiaDeFolga.AddDays(DiasFolga - 1);
    public DateOnly ProximoEmbarque => PrimeiroDiaDeFolga.AddDays(DiasFolga);

    public bool EstaABordoEm(DateOnly data) => data >= Inicio && data <= UltimoDiaABordo;
    public bool EstaDeFolgaEm(DateOnly data) => data >= PrimeiroDiaDeFolga && data < ProximoEmbarque;
}
