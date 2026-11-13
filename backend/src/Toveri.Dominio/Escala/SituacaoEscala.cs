namespace Toveri.Dominio.Escala;

public enum TipoSituacao
{
    /// <summary>Nenhum embarque registrado.</summary>
    SemEscala,

    /// <summary>O primeiro embarque ainda não começou.</summary>
    AguardandoPrimeiroEmbarque,

    Embarcado,
    Folga,

    /// <summary>Compensando folga não gozada de embarques anteriores.</summary>
    FolgaCompensatoria,

    /// <summary>Folga terminou e o próximo embarque registrado começa depois do previsto.</summary>
    AguardandoEmbarque,
}

/// <summary>Onde o colaborador está na escala numa data.</summary>
/// <param name="DiaDaFase">Dia a bordo ou dia de folga (o primeiro dia é 1).</param>
/// <param name="DiasDaFase">Total de dias a bordo ou de folga do período.</param>
public sealed record SituacaoEscala(
    TipoSituacao Tipo,
    PeriodoEscala? Periodo,
    int? DiaDaFase,
    int? DiasDaFase,
    DateOnly? ProximoEmbarque)
{
    public static readonly SituacaoEscala SemEscala = new(TipoSituacao.SemEscala, null, null, null, null);
}
