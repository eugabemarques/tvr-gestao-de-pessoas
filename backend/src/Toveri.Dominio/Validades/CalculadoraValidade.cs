namespace Toveri.Dominio.Validades;

public enum FaixaValidade
{
    Vencido,

    /// <summary>Vence em até <see cref="ConfiguracaoValidade.DiasUrgente"/> dias.</summary>
    Urgente,

    /// <summary>Vence em até <see cref="ConfiguracaoValidade.DiasAtencao"/> dias.</summary>
    Atencao,

    EmDia,
}

/// <summary>Prazos de aviso de vencimento de cursos e ASO. Ajustáveis pelo RH.</summary>
public sealed record ConfiguracaoValidade(int DiasUrgente = 60, int DiasAtencao = 90);

/// <param name="DiasRestantes">Dias até a validade. Negativo quando já venceu.</param>
public sealed record ResultadoValidade(FaixaValidade Faixa, int DiasRestantes);

public static class CalculadoraValidade
{
    /// <summary>A data de validade é o último dia válido: no próprio dia ainda não está vencido.</summary>
    public static ResultadoValidade Avaliar(DateOnly validade, DateOnly hoje, ConfiguracaoValidade? configuracao = null)
    {
        configuracao ??= new ConfiguracaoValidade();
        var dias = validade.DayNumber - hoje.DayNumber;
        var faixa = dias < 0 ? FaixaValidade.Vencido
            : dias <= configuracao.DiasUrgente ? FaixaValidade.Urgente
            : dias <= configuracao.DiasAtencao ? FaixaValidade.Atencao
            : FaixaValidade.EmDia;
        return new ResultadoValidade(faixa, dias);
    }
}
