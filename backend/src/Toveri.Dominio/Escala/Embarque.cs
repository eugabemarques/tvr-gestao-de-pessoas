namespace Toveri.Dominio.Escala;

/// <summary>Um embarque registrado pelo RH.</summary>
public class Embarque
{
    public int Id { get; set; }
    public int ColaboradorId { get; set; }
    public int? BarcoId { get; set; }

    /// <summary>Dia do embarque. Ele conta como o dia 1 a bordo.</summary>
    public DateOnly Inicio { get; set; }

    /// <summary>Dias a bordo previstos, sem contar a dobra.</summary>
    public int DiasEmbarcado { get; set; }

    /// <summary>Dias extras a bordo (dobra), somados ao fim do embarque.</summary>
    public int DiasDobra { get; set; }

    /// <summary>
    /// Dias de translado de ida antes do embarque (1 = o dia anterior). Vazio: o padrão da regra.
    /// Dia trabalhado que não gera folga.
    /// </summary>
    public int? DiasTransladoIda { get; set; }

    /// <summary>
    /// Dias de translado de volta depois do último dia a bordo (0 = volta no próprio último dia).
    /// Vazio: o padrão da regra. Dia trabalhado que não gera folga.
    /// </summary>
    public int? DiasTransladoVolta { get; set; }
}
