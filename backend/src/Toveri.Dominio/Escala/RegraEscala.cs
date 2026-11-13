namespace Toveri.Dominio.Escala;

/// <summary>
/// Uma escala de trabalho, por exemplo "42x42".
/// Os números da escala ficam em versões com data de início de vigência: quando a regra muda,
/// cria-se uma versão nova e os embarques que começaram antes continuam calculados pela versão antiga.
/// </summary>
public class RegraEscala
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public List<VersaoRegraEscala> Versoes { get; set; } = [];

    /// <summary>Versão que vale para um embarque que começa na data informada.</summary>
    public VersaoRegraEscala VersaoEm(DateOnly data) =>
        Versoes.Where(v => v.VigenteDesde <= data).OrderByDescending(v => v.VigenteDesde).FirstOrDefault()
        ?? throw new RegraDeNegocioException($"A escala \"{Nome}\" não tem regra vigente em {data:dd/MM/yyyy}.");
}

/// <summary>Os números de uma escala a partir de uma data.</summary>
public class VersaoRegraEscala
{
    public int Id { get; set; }
    public int RegraEscalaId { get; set; }

    /// <summary>Vale para embarques que começam nesta data ou depois.</summary>
    public DateOnly VigenteDesde { get; set; }

    /// <summary>Dias a bordo de um embarque padrão (42 na escala 42x42).</summary>
    public int DiasEmbarcado { get; set; }

    /// <summary>Dias de folga de um embarque padrão (42 na escala 42x42).</summary>
    public int DiasFolga { get; set; }

    /// <summary>Dias de folga gerados por dia de dobra (1 = um dia de folga por dia de dobra).</summary>
    public decimal FolgaPorDiaDeDobra { get; set; } = 1m;

    /// <summary>
    /// Folga conquistada por um embarque. Os dias embarcados geram folga na proporção da escala
    /// (DiasFolga / DiasEmbarcado) e os dias de dobra, na proporção FolgaPorDiaDeDobra.
    /// O resultado é arredondado para o dia mais próximo.
    /// </summary>
    public int FolgaPara(int diasEmbarcado, int diasDobra)
    {
        if (diasEmbarcado < 1)
            throw new RegraDeNegocioException("O embarque precisa ter pelo menos 1 dia.");
        if (diasDobra < 0)
            throw new RegraDeNegocioException("Os dias de dobra não podem ser negativos.");
        if (DiasEmbarcado < 1)
            throw new RegraDeNegocioException("A escala precisa ter pelo menos 1 dia embarcado.");

        var folga = diasEmbarcado * (decimal)DiasFolga / DiasEmbarcado + diasDobra * FolgaPorDiaDeDobra;
        return (int)Math.Round(folga, MidpointRounding.AwayFromZero);
    }

    /// <summary>Problemas de preenchimento, para mostrar ao RH antes de salvar.</summary>
    public IEnumerable<string> Validar()
    {
        if (DiasEmbarcado < 1) yield return "Informe pelo menos 1 dia embarcado.";
        if (DiasFolga < 0) yield return "Os dias de folga não podem ser negativos.";
        if (FolgaPorDiaDeDobra < 0) yield return "A folga por dia de dobra não pode ser negativa.";
    }
}
