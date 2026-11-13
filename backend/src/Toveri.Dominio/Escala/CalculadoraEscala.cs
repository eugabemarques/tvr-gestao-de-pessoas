namespace Toveri.Dominio.Escala;

/// <summary>Cálculo de embarques, folgas, compensações e próximos embarques.</summary>
public static class CalculadoraEscala
{
    /// <summary>
    /// Embarques registrados de um colaborador, em ordem, seguidos dos embarques previstos pela escala
    /// até a data informada.
    /// </summary>
    /// <remarks>
    /// Cada embarque usa a versão da regra vigente no dia em que começa.
    /// Se um embarque registrado começa durante a folga do anterior, a folga restante é contada como
    /// não gozada e entra no saldo a compensar. Se começa antes do fim do embarque anterior, os dados
    /// estão inconsistentes e o cálculo é recusado.
    /// Depois do último embarque registrado, os ciclos previstos seguem a escala padrão, sem dobra.
    /// Uma compensação de folga que começa no dia de um embarque previsto adia esse embarque.
    /// </remarks>
    public static IReadOnlyList<PeriodoEscala> Projetar(
        RegraEscala regra,
        IEnumerable<Embarque> embarques,
        DateOnly ate,
        IEnumerable<CompensacaoFolga>? compensacoes = null)
    {
        var registrados = embarques.OrderBy(e => e.Inicio).ToList();
        var comps = (compensacoes ?? []).Where(c => c.Dias > 0).ToList();
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
        var proximo = DepoisDasCompensacoes(ultimo.ProximoEmbarque, comps);
        while (proximo <= ate)
        {
            var versao = regra.VersaoEm(proximo);
            var previsto = new PeriodoEscala(proximo, versao.DiasEmbarcado, 0, versao.FolgaPara(versao.DiasEmbarcado, 0), 0,
                ultimo.BarcoId, OrigemPeriodo.Previsto, versao.VigenteDesde);
            periodos.Add(previsto);
            proximo = DepoisDasCompensacoes(previsto.ProximoEmbarque, comps);
        }

        return periodos;
    }

    /// <summary>Situação do colaborador na escala numa data.</summary>
    public static SituacaoEscala SituacaoEm(
        RegraEscala regra,
        IEnumerable<Embarque> embarques,
        DateOnly data,
        IEnumerable<CompensacaoFolga>? compensacoes = null)
    {
        var comps = (compensacoes ?? []).ToList();
        var periodos = Projetar(regra, embarques, data, comps);
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

        // Depois da última data projetada pode haver um embarque previsto ainda não calculado.
        var seguinte = Projetar(regra, embarques, data.AddDays(366), comps).FirstOrDefault(p => p.Inicio > data)?.Inicio;

        var compensacao = comps.FirstOrDefault(c => c.Inclui(data));
        if (compensacao is not null)
            return new SituacaoEscala(TipoSituacao.FolgaCompensatoria, null,
                data.DayNumber - compensacao.Inicio.DayNumber + 1, compensacao.Dias, seguinte);

        return new SituacaoEscala(TipoSituacao.AguardandoEmbarque, null, null, null, seguinte);
    }

    /// <summary>Folga não gozada acumulada nos embarques registrados, menos o que já foi compensado.</summary>
    public static SaldoFolga Saldo(
        RegraEscala regra, IEnumerable<Embarque> embarques, IEnumerable<CompensacaoFolga> compensacoes)
    {
        var lista = embarques.ToList();
        var ate = lista.Count == 0 ? DateOnly.MinValue : lista.Max(e => e.Inicio);
        var naoGozados = Projetar(regra, lista, ate).Where(p => p.Origem == OrigemPeriodo.Registrado)
            .Sum(p => p.DiasFolgaNaoGozados);
        return new SaldoFolga(naoGozados, compensacoes.Sum(c => c.Dias));
    }

    /// <summary>
    /// Confere uma compensação nova antes de salvar. Ela precisa caber no saldo e começar num dia em
    /// que o colaborador estaria aguardando ou embarcaria por previsão da escala, sem cobrir nenhum
    /// embarque já registrado.
    /// </summary>
    public static void ValidarCompensacao(
        RegraEscala regra,
        IEnumerable<Embarque> embarques,
        IEnumerable<CompensacaoFolga> existentes,
        CompensacaoFolga nova)
    {
        if (nova.Dias < 1)
            throw new RegraDeNegocioException("A compensação precisa ter pelo menos 1 dia.");

        var lista = embarques.ToList();
        var anteriores = existentes.ToList();
        var saldo = Saldo(regra, lista, anteriores).Saldo;
        if (nova.Dias > saldo)
            throw new RegraDeNegocioException(
                $"O colaborador tem {saldo} {(saldo == 1 ? "dia" : "dias")} de folga a compensar, menos que os {nova.Dias} informados.");

        var situacao = SituacaoEm(regra, lista, nova.Inicio, anteriores);
        var podeComecar = situacao.Tipo == TipoSituacao.AguardandoEmbarque
            || situacao is { Tipo: TipoSituacao.Embarcado, DiaDaFase: 1, Periodo.Origem: OrigemPeriodo.Previsto };
        if (!podeComecar)
            throw new RegraDeNegocioException(
                $"Em {nova.Inicio:dd/MM/yyyy} o colaborador não está aguardando embarque nem tem embarque previsto. A compensação começa no dia em que ele embarcaria.");

        var conflito = lista.FirstOrDefault(e => e.Inicio >= nova.Inicio && e.Inicio <= nova.Fim);
        if (conflito is not null)
            throw new RegraDeNegocioException(
                $"A compensação até {nova.Fim:dd/MM/yyyy} cobre o embarque registrado de {conflito.Inicio:dd/MM/yyyy}.");
    }

    private static DateOnly DepoisDasCompensacoes(DateOnly data, List<CompensacaoFolga> compensacoes)
    {
        for (var c = compensacoes.FirstOrDefault(x => x.Inicio == data); c is not null;
             c = compensacoes.FirstOrDefault(x => x.Inicio == data))
            data = c.Fim.AddDays(1);
        return data;
    }
}
