using Toveri.Dominio.Escala;

namespace Toveri.Dominio.Avisos;

/// <summary>Um curso, ASO ou documento com data de validade.</summary>
public sealed record ItemComValidade(string Descricao, DateOnly Validade);

public enum GravidadeAviso
{
    /// <summary>Vence durante o embarque.</summary>
    Atencao,

    /// <summary>Já venceu ou vence antes de o colaborador embarcar.</summary>
    Critico,
}

public sealed record AvisoDeEmbarque(ItemComValidade Item, PeriodoEscala Embarque, GravidadeAviso Gravidade);

/// <summary>Cursos e ASO que vencem antes do fim de um embarque em andamento ou próximo.</summary>
public static class AvisosDeEmbarque
{
    /// <param name="diasDeAntecedencia">Quantos dias antes de um embarque os avisos começam a aparecer.</param>
    public static IReadOnlyList<AvisoDeEmbarque> Gerar(
        RegraEscala regra,
        IEnumerable<Embarque> embarques,
        IEnumerable<ItemComValidade> itens,
        DateOnly hoje,
        int diasDeAntecedencia = 30)
    {
        var periodos = CalculadoraEscala.Projetar(regra, embarques, hoje.AddDays(diasDeAntecedencia));
        var atual = periodos.FirstOrDefault(p => p.EstaABordoEm(hoje));
        var alvo = atual ?? periodos.FirstOrDefault(p =>
            p.Inicio > hoje && p.Inicio.DayNumber - hoje.DayNumber <= diasDeAntecedencia);
        if (alvo is null)
            return [];

        var aBordo = atual is not null;
        return itens
            .Where(i => i.Validade <= alvo.UltimoDiaABordo)
            .Select(i => new AvisoDeEmbarque(i, alvo,
                i.Validade < hoje || (!aBordo && i.Validade < alvo.Inicio) ? GravidadeAviso.Critico : GravidadeAviso.Atencao))
            .OrderByDescending(a => a.Gravidade)
            .ThenBy(a => a.Item.Validade)
            .ToList();
    }
}
