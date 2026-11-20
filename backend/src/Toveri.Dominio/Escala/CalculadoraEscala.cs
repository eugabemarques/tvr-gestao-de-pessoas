namespace Toveri.Dominio.Escala;

/// <summary>Cálculo de embarques, translados, folgas, compensações e próximos embarques.</summary>
/// <remarks>
/// Cada ciclo tem quatro etapas: translado de ida → a bordo → translado de volta → folga.
/// O translado é dia trabalhado e não gera folga. Embarques sem translado informado usam o padrão
/// da versão da regra (1 dia de ida, volta no próprio último dia a bordo).
/// </remarks>
public static class CalculadoraEscala
{
    /// <summary>
    /// Embarques registrados de um colaborador, em ordem, seguidos dos embarques previstos pela escala
    /// cujo ciclo (translado de ida) começa até a data informada.
    /// </summary>
    /// <remarks>
    /// Cada embarque usa a versão da regra vigente no dia em que começa.
    /// Se o ciclo seguinte registrado (a partir do translado de ida) começa durante a folga do anterior,
    /// a folga restante é contada como não gozada e entra no saldo a compensar. Se o embarque começa
    /// antes do fim do embarque anterior, ou o translado de ida se sobrepõe aos dias trabalhados do
    /// anterior, os dados estão inconsistentes e o cálculo é recusado.
    /// Depois do último embarque registrado, os ciclos previstos seguem a escala padrão, sem dobra:
    /// translado de ida no dia seguinte ao fim da folga e embarque depois dele.
    /// Uma compensação de folga que começa no dia em que um ciclo previsto começaria adia esse ciclo.
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
            var (ida, volta) = Translado(e, versao);
            var folga = versao.FolgaPara(e.DiasEmbarcado, e.DiasDobra);
            var naoGozados = 0;
            DateOnly? proximo = null;

            if (i + 1 < registrados.Count)
            {
                var s = registrados[i + 1];
                var ultimoDiaABordo = e.Inicio.AddDays(e.DiasEmbarcado + e.DiasDobra - 1);
                if (s.Inicio <= ultimoDiaABordo)
                    throw new RegraDeNegocioException(
                        $"O embarque de {s.Inicio:dd/MM/yyyy} começa antes do fim do embarque de {e.Inicio:dd/MM/yyyy}, que vai até {ultimoDiaABordo:dd/MM/yyyy}.");

                var ultimoTrabalhado = ultimoDiaABordo.AddDays(volta);
                var inicioCicloSeguinte = s.Inicio.AddDays(-Translado(s, regra.VersaoEm(s.Inicio)).Ida);
                if (inicioCicloSeguinte <= ultimoTrabalhado)
                    throw new RegraDeNegocioException(
                        $"O translado de ida de {inicioCicloSeguinte:dd/MM/yyyy} (embarque de {s.Inicio:dd/MM/yyyy}) começa antes do fim do translado de volta do embarque de {e.Inicio:dd/MM/yyyy}, em {ultimoTrabalhado:dd/MM/yyyy}.");

                var diasAteOSeguinte = inicioCicloSeguinte.DayNumber - ultimoTrabalhado.DayNumber - 1;
                if (diasAteOSeguinte < folga)
                {
                    naoGozados = folga - diasAteOSeguinte;
                    folga = diasAteOSeguinte;
                }
                proximo = s.Inicio;
            }

            var p = new PeriodoEscala(e.Inicio, e.DiasEmbarcado, e.DiasDobra, folga, naoGozados,
                e.BarcoId, OrigemPeriodo.Registrado, versao.VigenteDesde)
            { DiasTransladoIda = ida, DiasTransladoVolta = volta };
            periodos.Add(proximo is { } px ? p with { ProximoEmbarque = px } : p);
        }

        if (periodos.Count == 0)
            return periodos;

        var ultimo = periodos[^1];
        var inicioCiclo = DepoisDasCompensacoes(ultimo.UltimoDiaDeFolga.AddDays(1), comps);
        var (embarque, versaoSeguinte) = CicloQueComecaEm(regra, inicioCiclo);
        periodos[^1] = ultimo with { ProximoEmbarque = embarque };

        while (inicioCiclo <= ate)
        {
            var v = versaoSeguinte;
            var previsto = new PeriodoEscala(embarque, v.DiasEmbarcado, 0, v.FolgaPara(v.DiasEmbarcado, 0), 0,
                ultimo.BarcoId, OrigemPeriodo.Previsto, v.VigenteDesde)
            { DiasTransladoIda = embarque.DayNumber - inicioCiclo.DayNumber, DiasTransladoVolta = v.DiasTransladoVolta };

            inicioCiclo = DepoisDasCompensacoes(previsto.UltimoDiaDeFolga.AddDays(1), comps);
            (embarque, versaoSeguinte) = CicloQueComecaEm(regra, inicioCiclo);
            periodos.Add(previsto with { ProximoEmbarque = embarque });
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

        if (data < periodos[0].InicioDoCiclo)
            return new SituacaoEscala(TipoSituacao.AguardandoPrimeiroEmbarque, periodos[0], null, null, periodos[0].Inicio);

        foreach (var p in periodos)
        {
            if (p.EstaEmTransladoDeIdaEm(data))
                return new SituacaoEscala(TipoSituacao.TransladoIda, p, data.DayNumber - p.InicioDoCiclo.DayNumber + 1, p.DiasTransladoIda, p.Inicio);
            if (p.EstaABordoEm(data))
                return new SituacaoEscala(TipoSituacao.Embarcado, p, data.DayNumber - p.Inicio.DayNumber + 1, p.DiasABordo, p.ProximoEmbarque);
            if (p.EstaEmTransladoDeVoltaEm(data))
                return new SituacaoEscala(TipoSituacao.TransladoVolta, p, data.DayNumber - p.UltimoDiaABordo.DayNumber, p.DiasTransladoVolta, p.ProximoEmbarque);
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
    /// que o colaborador estaria aguardando ou começaria um ciclo previsto pela escala (o translado de
    /// ida), sem cobrir nenhum ciclo já registrado.
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
            || situacao is { Tipo: TipoSituacao.TransladoIda, DiaDaFase: 1, Periodo.Origem: OrigemPeriodo.Previsto }
            || situacao is { Tipo: TipoSituacao.Embarcado, DiaDaFase: 1, Periodo: { Origem: OrigemPeriodo.Previsto, DiasTransladoIda: 0 } };
        if (!podeComecar)
            throw new RegraDeNegocioException(
                $"Em {nova.Inicio:dd/MM/yyyy} o colaborador não está aguardando embarque nem começa um ciclo previsto. A compensação começa no dia em que ele iniciaria o translado de ida.");

        var conflito = lista.FirstOrDefault(e =>
        {
            var inicioCiclo = e.Inicio.AddDays(-Translado(e, regra.VersaoEm(e.Inicio)).Ida);
            return inicioCiclo <= nova.Fim && e.Inicio >= nova.Inicio;
        });
        if (conflito is not null)
            throw new RegraDeNegocioException(
                $"A compensação até {nova.Fim:dd/MM/yyyy} cobre o embarque registrado de {conflito.Inicio:dd/MM/yyyy} (com o translado de ida).");
    }

    /// <summary>Dias de translado de um embarque: o informado ou o padrão da versão da regra.</summary>
    private static (int Ida, int Volta) Translado(Embarque e, VersaoRegraEscala versao)
    {
        var ida = e.DiasTransladoIda ?? versao.DiasTransladoIda;
        var volta = e.DiasTransladoVolta ?? versao.DiasTransladoVolta;
        if (ida < 0 || volta < 0)
            throw new RegraDeNegocioException($"O translado do embarque de {e.Inicio:dd/MM/yyyy} não pode ter dias negativos.");
        return (ida, volta);
    }

    /// <summary>
    /// Ciclo previsto que começa (translado de ida) na data informada: o dia do embarque e a versão da
    /// regra vigente nele. Os dias de translado de ida vêm da versão vigente no início do ciclo.
    /// </summary>
    private static (DateOnly Embarque, VersaoRegraEscala Versao) CicloQueComecaEm(RegraEscala regra, DateOnly inicioCiclo)
    {
        var embarque = inicioCiclo.AddDays(regra.VersaoEm(inicioCiclo).DiasTransladoIda);
        return (embarque, regra.VersaoEm(embarque));
    }

    private static DateOnly DepoisDasCompensacoes(DateOnly data, List<CompensacaoFolga> compensacoes)
    {
        for (var c = compensacoes.FirstOrDefault(x => x.Inicio == data); c is not null;
             c = compensacoes.FirstOrDefault(x => x.Inicio == data))
            data = c.Fim.AddDays(1);
        return data;
    }
}
