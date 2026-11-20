namespace Toveri.Dominio.Escala;

public enum OrigemPeriodo
{
    /// <summary>Embarque lançado pelo RH.</summary>
    Registrado,

    /// <summary>Embarque calculado pela escala padrão, ainda não confirmado.</summary>
    Previsto,
}

/// <summary>
/// Um ciclo de embarque: translado de ida → a bordo → translado de volta → folga.
/// O translado é dia trabalhado e não gera folga.
/// </summary>
/// <param name="DiasFolga">Folga efetivamente gozada antes do próximo ciclo.</param>
/// <param name="DiasFolgaNaoGozados">Folga que deixou de ser gozada porque o ciclo seguinte começou antes.</param>
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
    private readonly DateOnly? _proximoEmbarque;

    /// <summary>Dias de translado de ida antes do embarque.</summary>
    public int DiasTransladoIda { get; init; } = VersaoRegraEscala.TransladoIdaPadrao;

    /// <summary>Dias de translado de volta depois do último dia a bordo (0 = volta no último dia a bordo).</summary>
    public int DiasTransladoVolta { get; init; } = VersaoRegraEscala.TransladoVoltaPadrao;

    public int DiasABordo => DiasEmbarcado + DiasDobra;
    public int DiasTranslado => DiasTransladoIda + DiasTransladoVolta;

    /// <summary>Dias trabalhados no ciclo: a bordo + translado.</summary>
    public int DiasTrabalhados => DiasABordo + DiasTranslado;

    /// <summary>Primeiro dia do ciclo: o translado de ida (ou o embarque, sem translado).</summary>
    public DateOnly InicioDoCiclo => Inicio.AddDays(-DiasTransladoIda);
    public DateOnly UltimoDiaABordo => Inicio.AddDays(DiasABordo - 1);

    /// <summary>Último dia trabalhado: o último dia a bordo ou o último dia do translado de volta.</summary>
    public DateOnly UltimoDiaTrabalhado => UltimoDiaABordo.AddDays(DiasTransladoVolta);
    public DateOnly PrimeiroDiaDeFolga => UltimoDiaTrabalhado.AddDays(1);
    public DateOnly UltimoDiaDeFolga => PrimeiroDiaDeFolga.AddDays(DiasFolga - 1);

    /// <summary>
    /// Embarque seguinte: o registrado ou o previsto (translado de ida no dia seguinte ao fim da folga,
    /// embarque depois dele). Preenchido pela calculadora; sem ele, supõe o mesmo translado de ida.
    /// </summary>
    public DateOnly ProximoEmbarque
    {
        get => _proximoEmbarque ?? UltimoDiaDeFolga.AddDays(1 + DiasTransladoIda);
        init => _proximoEmbarque = value;
    }

    public bool EstaABordoEm(DateOnly data) => data >= Inicio && data <= UltimoDiaABordo;
    public bool EstaEmTransladoDeIdaEm(DateOnly data) => data >= InicioDoCiclo && data < Inicio;
    public bool EstaEmTransladoDeVoltaEm(DateOnly data) => data > UltimoDiaABordo && data <= UltimoDiaTrabalhado;
    public bool EstaDeFolgaEm(DateOnly data) => data >= PrimeiroDiaDeFolga && data <= UltimoDiaDeFolga;
}
