namespace Toveri.Dominio.Escala;

/// <summary>Cálculo de embarques, folgas e próximos embarques.</summary>
public static class CalculadoraEscala
{
    /// <summary>
    /// Embarques registrados de um colaborador, em ordem, seguidos dos embarques previstos pela escala
    /// até a data informada.
    /// </summary>
    /// <remarks>
    /// Cada embarque usa a versão da regra vigente no dia em que começa.
    /// Se um embarque registrado começa durante a folga do anterior, a folga restante é contada como
    /// não gozada. Se começa antes do fim do embarque anterior, os dados estão inconsistentes e o
    /// cálculo é recusado.
    /// Depois do último embarque registrado, os ciclos previstos seguem a escala padrão, sem dobra.
    /// </remarks>
    public static IReadOnlyList<PeriodoEscala> Projetar(RegraEscala regra, IEnumerable<Embarque> embarques, DateOnly ate)
    {
        var registrados = embarques.OrderBy(e => e.Inicio).ToList();
        var periodos = new List<PeriodoEscala>(registrados.Count);

        for (var i = 0; i < registrados.Count; i++)
        {
            var e = registrados[i];
            var versao = regra.VersaoEm(e.Inicio);
            var folga = versao.FolgaPara(e.DiasEmbarcado, e.DiasDobra);
            var naoGozados = 0;

            if (i + 1 < registrados.Count)
            {
                var seguinte = registrados[i + 1].Inicio;
                var ultimoDiaABordo = e.Inicio.AddDays(e.DiasEmbarcado + e.DiasDobra - 1);
                if (seguinte <= ultimoDiaABordo)
                    throw new RegraDeNegocioException(
                        $"O embarque de {seguinte:dd/MM/yyyy} começa antes do fim do embarque de {e.Inicio:dd/MM/yyyy}, que vai até {ultimoDiaABordo:dd/MM/yyyy}.");

                var diasAteOSeguinte = seguinte.DayNumber - ultimoDiaABordo.DayNumber - 1;
                if (diasAteOSeguinte < folga)
                {
                    naoGozados = folga - diasAteOSeguinte;
                    folga = diasAteOSeguinte;
                }
            }

            periodos.Add(new PeriodoEscala(e.Inicio, e.DiasEmbarcado, e.DiasDobra, folga, naoGozados,
                e.BarcoId, OrigemPeriodo.Registrado, versao.VigenteDesde));
        }

        if (periodos.Count == 0)
            return periodos;

        var ultimo = periodos[^1];
        var proximo = ultimo.ProximoEmbarque;
        while (proximo <= ate)
        {
            var versao = regra.VersaoEm(proximo);
            var previsto = new PeriodoEscala(proximo, versao.DiasEmbarcado, 0, versao.FolgaPara(versao.DiasEmbarcado, 0), 0,
                ultimo.BarcoId, OrigemPeriodo.Previsto, versao.VigenteDesde);
            periodos.Add(previsto);
            proximo = previsto.ProximoEmbarque;
        }

        return periodos;
    }

    /// <summary>Situação do colaborador na escala numa data.</summary>
    public static SituacaoEscala SituacaoEm(RegraEscala regra, IEnumerable<Embarque> embarques, DateOnly data)
    {
        var periodos = Projetar(regra, embarques, data);
        if (periodos.Count == 0)
            return SituacaoEscala.SemEscala;

        if (data < periodos[0].Inicio)
            return new SituacaoEscala(TipoSituacao.AguardandoPrimeiroEmbarque, periodos[0], null, null, periodos[0].Inicio);

        foreach (var p in periodos)
        {
            if (p.EstaABordoEm(data))
                return new SituacaoEscala(TipoSituacao.Embarcado, p, data.DayNumber - p.Inicio.DayNumber + 1, p.DiasABordo, p.ProximoEmbarque);
            if (p.EstaDeFolgaEm(data))
                return new SituacaoEscala(TipoSituacao.Folga, p, data.DayNumber - p.PrimeiroDiaDeFolga.DayNumber + 1, p.DiasFolga, p.ProximoEmbarque);
        }

        var seguinte = periodos.FirstOrDefault(p => p.Inicio > data);
        return new SituacaoEscala(TipoSituacao.ForaDaEscala, null, null, null, seguinte?.Inicio);
    }
}
