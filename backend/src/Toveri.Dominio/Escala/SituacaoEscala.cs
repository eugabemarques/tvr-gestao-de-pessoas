namespace Toveri.Dominio.Escala;

public enum TipoSituacao
{
    /// <summary>Nenhum embarque registrado.</summary>
    SemEscala,

    /// <summary>O primeiro embarque ainda não começou.</summary>
    AguardandoPrimeiroEmbarque,

    /// <summary>Viajando para o embarque (dia trabalhado, sem folga).</summary>
    TransladoIda,

    Embarcado,

    /// <summary>Voltando do embarque (dia trabalhado, sem folga).</summary>
    TransladoVolta,

    Folga,

    /// <summary>Compensando folga não gozada de embarques anteriores.</summary>
    FolgaCompensatoria,

    /// <summary>Folga terminou e o próximo embarque registrado começa depois do previsto.</summary>
    AguardandoEmbarque,
}

/// <summary>Onde o colaborador está na escala numa data.</summary>
/// <param name="DiaDaFase">Dia de translado, a bordo ou de folga (o primeiro dia é 1).</param>
/// <param name="DiasDaFase">Total de dias de translado, a bordo ou de folga do período.</param>
public sealed record SituacaoEscala(
    TipoSituacao Tipo,
    PeriodoEscala? Periodo,
    int? DiaDaFase,
    int? DiasDaFase,
    DateOnly? ProximoEmbarque)
{
    public static readonly SituacaoEscala SemEscala = new(TipoSituacao.SemEscala, null, null, null, null);
}
