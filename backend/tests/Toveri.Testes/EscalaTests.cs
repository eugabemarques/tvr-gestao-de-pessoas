using Toveri.Dominio;
using Toveri.Dominio.Escala;

namespace Toveri.Testes;

public class EscalaTests
{
    private static readonly DateOnly Hoje = new(2026, 11, 13);

    internal static RegraEscala Escala42x42() => new()
    {
        Nome = "42x42",
        Versoes = [new VersaoRegraEscala { VigenteDesde = new(2020, 1, 1), DiasEmbarcado = 42, DiasFolga = 42 }],
    };

    internal static Embarque Embarque(DateOnly inicio, int dias = 42, int dobra = 0, int? ida = null, int? volta = null) =>
        new() { Inicio = inicio, DiasEmbarcado = dias, DiasDobra = dobra, DiasTransladoIda = ida, DiasTransladoVolta = volta };

    [Fact]
    public void Embarque_padrao_tem_translado_de_ida_no_dia_anterior_e_volta_no_ultimo_dia_a_bordo()
    {
        var p = CalculadoraEscala.Projetar(Escala42x42(), [Embarque(new(2026, 1, 1))], new(2026, 1, 1)).Single();

        Assert.Equal(new DateOnly(2025, 12, 31), p.InicioDoCiclo);
        Assert.Equal(new DateOnly(2026, 2, 11), p.UltimoDiaABordo);
        Assert.Equal(new DateOnly(2026, 2, 11), p.UltimoDiaTrabalhado);
        Assert.Equal(new DateOnly(2026, 2, 12), p.PrimeiroDiaDeFolga);
        Assert.Equal(42, p.DiasFolga);
        Assert.Equal(new DateOnly(2026, 3, 25), p.UltimoDiaDeFolga);
        // translado de ida em 26/03, embarque em 27/03
        Assert.Equal(new DateOnly(2026, 3, 27), p.ProximoEmbarque);
        Assert.Equal(43, p.DiasTrabalhados);
    }

    // Exemplo do RH: translado 16/11, embarque 17/11, 42 dias.
    [Theory]
    [InlineData("2026-11-15", TipoSituacao.AguardandoPrimeiroEmbarque, null, "2026-11-17")]
    [InlineData("2026-11-16", TipoSituacao.TransladoIda, 1, "2026-11-17")]
    [InlineData("2026-11-17", TipoSituacao.Embarcado, 1, "2027-02-10")]
    [InlineData("2026-12-28", TipoSituacao.Embarcado, 42, "2027-02-10")]
    [InlineData("2026-12-29", TipoSituacao.Folga, 1, "2027-02-10")]
    [InlineData("2027-02-08", TipoSituacao.Folga, 42, "2027-02-10")]
    [InlineData("2027-02-09", TipoSituacao.TransladoIda, 1, "2027-02-10")]
    [InlineData("2027-02-10", TipoSituacao.Embarcado, 1, "2027-05-06")]
    public void Exemplo_do_RH_ciclo_com_translado(string data, TipoSituacao tipo, int? dia, string proximo)
    {
        var s = CalculadoraEscala.SituacaoEm(Escala42x42(), [Embarque(new(2026, 11, 17))], DateOnly.Parse(data));

        Assert.Equal(tipo, s.Tipo);
        Assert.Equal(dia, s.DiaDaFase);
        Assert.Equal(DateOnly.Parse(proximo), s.ProximoEmbarque);
    }

    [Fact]
    public void Translado_de_volta_no_dia_seguinte_e_trabalhado_e_a_folga_comeca_depois()
    {
        Embarque[] e = [Embarque(new(2026, 11, 17), volta: 1)];
        var p = CalculadoraEscala.Projetar(Escala42x42(), e, new(2026, 11, 17)).Single();

        Assert.Equal(new DateOnly(2026, 12, 29), p.UltimoDiaTrabalhado);
        Assert.Equal(new DateOnly(2026, 12, 30), p.PrimeiroDiaDeFolga);
        Assert.Equal(new DateOnly(2027, 2, 9), p.UltimoDiaDeFolga);
        Assert.Equal(new DateOnly(2027, 2, 11), p.ProximoEmbarque);
        Assert.Equal(44, p.DiasTrabalhados);
        Assert.Equal(42, p.DiasFolga);   // o translado não gera folga

        var s = CalculadoraEscala.SituacaoEm(Escala42x42(), e, new(2026, 12, 29));
        Assert.Equal(TipoSituacao.TransladoVolta, s.Tipo);
        Assert.Equal(1, s.DiaDaFase);
        Assert.Equal(1, s.DiasDaFase);
    }

    [Fact]
    public void Padrao_de_translado_vem_da_versao_da_regra()
    {
        var regra = Escala42x42();
        regra.Versoes[0].DiasTransladoIda = 2;
        var p = CalculadoraEscala.Projetar(regra, [Embarque(new(2026, 11, 17))], new(2027, 3, 1));

        Assert.Equal(new DateOnly(2026, 11, 15), p[0].InicioDoCiclo);
        // folga até 08/02, translado de 2 dias (09 e 10/02), embarque em 11/02
        Assert.Equal(new DateOnly(2027, 2, 11), p[1].Inicio);
        Assert.Equal(2, p[1].DiasTransladoIda);
    }

    [Fact]
    public void Dobra_gera_um_dia_de_folga_por_dia_e_o_ciclo_seguinte_volta_ao_padrao()
    {
        var periodos = CalculadoraEscala.Projetar(Escala42x42(), [Embarque(new(2026, 1, 1), dobra: 7)], new(2026, 4, 9));

        Assert.Equal(2, periodos.Count);
        var comDobra = periodos[0];
        Assert.Equal(49, comDobra.DiasABordo);
        Assert.Equal(new DateOnly(2026, 2, 18), comDobra.UltimoDiaABordo);
        Assert.Equal(49, comDobra.DiasFolga);
        Assert.Equal(new DateOnly(2026, 4, 8), comDobra.UltimoDiaDeFolga);
        Assert.Equal(new DateOnly(2026, 4, 10), comDobra.ProximoEmbarque);

        var seguinte = periodos[1];
        Assert.Equal(OrigemPeriodo.Previsto, seguinte.Origem);
        Assert.Equal(new DateOnly(2026, 4, 9), seguinte.InicioDoCiclo);
        Assert.Equal(42, seguinte.DiasABordo);
        Assert.Equal(0, seguinte.DiasDobra);
        Assert.Equal(new DateOnly(2026, 7, 4), seguinte.ProximoEmbarque);
    }

    [Theory]
    [InlineData(10, 0, TipoSituacao.Embarcado, 11, 42)]
    [InlineData(36, 7, TipoSituacao.Embarcado, 37, 49)]   // com dobra de 7 dias
    [InlineData(52, 0, TipoSituacao.Folga, 11, 42)]
    [InlineData(80, 0, TipoSituacao.Folga, 39, 42)]
    [InlineData(84, 0, TipoSituacao.TransladoIda, 1, 1)]  // ciclo seguinte, previsto: translado de ida
    [InlineData(85, 0, TipoSituacao.Embarcado, 1, 42)]    // ciclo de 85 dias (1 + 42 + 42)
    [InlineData(90, 0, TipoSituacao.Embarcado, 6, 42)]
    public void Situacao_hoje(int diasDesdeOEmbarque, int dobra, TipoSituacao tipo, int dia, int total)
    {
        var s = CalculadoraEscala.SituacaoEm(Escala42x42(), [Embarque(Hoje.AddDays(-diasDesdeOEmbarque), dobra: dobra)], Hoje);

        Assert.Equal(tipo, s.Tipo);
        Assert.Equal(dia, s.DiaDaFase);
        Assert.Equal(total, s.DiasDaFase);
    }

    [Fact]
    public void Antes_do_primeiro_embarque_mostra_a_data_em_que_vai_embarcar()
    {
        var s = CalculadoraEscala.SituacaoEm(Escala42x42(), [Embarque(Hoje.AddDays(5))], Hoje);

        Assert.Equal(TipoSituacao.AguardandoPrimeiroEmbarque, s.Tipo);
        Assert.Equal(Hoje.AddDays(5), s.ProximoEmbarque);
    }

    [Fact]
    public void Sem_embarques_nao_tem_escala()
    {
        Assert.Equal(TipoSituacao.SemEscala, CalculadoraEscala.SituacaoEm(Escala42x42(), [], Hoje).Tipo);
    }

    [Fact]
    public void Mudanca_de_regra_vale_so_para_embarques_que_comecam_depois_da_vigencia()
    {
        var regra = Escala42x42();
        regra.Versoes.Add(new VersaoRegraEscala { VigenteDesde = new(2026, 6, 1), DiasEmbarcado = 28, DiasFolga = 28 });

        var periodos = CalculadoraEscala.Projetar(regra, [Embarque(new(2026, 1, 1))], new(2026, 6, 19));

        Assert.Equal(3, periodos.Count);
        Assert.Equal(42, periodos[0].DiasABordo);                      // registrado em janeiro: regra antiga
        Assert.Equal(new DateOnly(2026, 3, 27), periodos[1].Inicio);   // começa antes da mudança: regra antiga
        Assert.Equal(42, periodos[1].DiasABordo);
        Assert.Equal(new DateOnly(2026, 6, 20), periodos[2].Inicio);   // começa depois da mudança: regra nova
        Assert.Equal(28, periodos[2].DiasABordo);
        Assert.Equal(28, periodos[2].DiasFolga);
        Assert.Equal(new DateOnly(2026, 6, 1), periodos[2].RegraVigenteDesde);
    }

    [Theory]
    [InlineData(14, 0, 21)]
    [InlineData(10, 0, 15)]
    [InlineData(14, 2, 24)]
    [InlineData(15, 0, 23)]  // 22,5 arredonda para 23
    public void Folga_e_proporcional_a_escala(int dias, int dobra, int folgaEsperada)
    {
        var versao = new VersaoRegraEscala { DiasEmbarcado = 14, DiasFolga = 21, FolgaPorDiaDeDobra = 1.5m };

        Assert.Equal(folgaEsperada, versao.FolgaPara(dias, dobra));
    }

    [Fact]
    public void Ciclo_que_comeca_durante_a_folga_registra_os_dias_nao_gozados()
    {
        // Folga de 12/02 a 25/03; translado de ida do embarque de 16/03 em 15/03: sobram 31 dias de folga.
        var periodos = CalculadoraEscala.Projetar(Escala42x42(),
            [Embarque(new(2026, 1, 1)), Embarque(new(2026, 3, 16))], new(2026, 3, 16));

        Assert.Equal(31, periodos[0].DiasFolga);
        Assert.Equal(11, periodos[0].DiasFolgaNaoGozados);
        Assert.Equal(new DateOnly(2026, 3, 14), periodos[0].UltimoDiaDeFolga);
        Assert.Equal(new DateOnly(2026, 3, 16), periodos[0].ProximoEmbarque);
    }

    [Fact]
    public void Embarque_que_comeca_durante_outro_embarque_e_recusado()
    {
        var erro = Assert.Throws<RegraDeNegocioException>(() => CalculadoraEscala.Projetar(Escala42x42(),
            [Embarque(new(2026, 1, 1)), Embarque(new(2026, 2, 1))], new(2026, 3, 1)));

        Assert.Contains("01/02/2026", erro.Message);
    }

    [Fact]
    public void Translado_de_ida_sobre_o_translado_de_volta_anterior_e_recusado()
    {
        // Volta em 12/02 (dia seguinte ao último dia a bordo); o embarque de 13/02 teria translado em 12/02.
        var erro = Assert.Throws<RegraDeNegocioException>(() => CalculadoraEscala.Projetar(Escala42x42(),
            [Embarque(new(2026, 1, 1), volta: 1), Embarque(new(2026, 2, 13))], new(2026, 3, 1)));

        Assert.Contains("translado", erro.Message);

        // Sem a volta extra, o translado em 12/02 é logo depois do último dia trabalhado: aceito, sem folga.
        var p = CalculadoraEscala.Projetar(Escala42x42(), [Embarque(new(2026, 1, 1)), Embarque(new(2026, 2, 13))], new(2026, 3, 1));
        Assert.Equal(0, p[0].DiasFolga);
        Assert.Equal(42, p[0].DiasFolgaNaoGozados);
    }

    [Fact]
    public void Entre_a_folga_e_um_embarque_atrasado_fica_aguardando()
    {
        var s = CalculadoraEscala.SituacaoEm(Escala42x42(),
            [Embarque(new(2026, 1, 1)), Embarque(new(2026, 4, 10))], new(2026, 4, 1));

        Assert.Equal(TipoSituacao.AguardandoEmbarque, s.Tipo);
        Assert.Equal(new DateOnly(2026, 4, 10), s.ProximoEmbarque);
    }

    // Convocação antecipada: translado em 15/03 e embarque em 16/03, 11 dias antes do fim da folga (25/03).
    // O ciclo de 16/03 termina a folga em 07/06; o seguinte começaria em 08/06 (translado) com embarque em 09/06.
    private static Embarque[] ComFolgaNaoGozada() => [Embarque(new(2026, 1, 1)), Embarque(new(2026, 3, 16))];

    private static CompensacaoFolga Compensacao(DateOnly inicio, int dias) => new() { Inicio = inicio, Dias = dias };

    [Fact]
    public void Folga_nao_gozada_vira_saldo_e_a_compensacao_desconta()
    {
        Assert.Equal(11, CalculadoraEscala.Saldo(Escala42x42(), ComFolgaNaoGozada(), []).Saldo);

        var saldo = CalculadoraEscala.Saldo(Escala42x42(), ComFolgaNaoGozada(), [Compensacao(new(2026, 6, 8), 6)]);
        Assert.Equal(11, saldo.NaoGozados);
        Assert.Equal(6, saldo.Compensados);
        Assert.Equal(5, saldo.Saldo);
    }

    [Fact]
    public void Compensacao_adia_o_proximo_ciclo_previsto()
    {
        // Compensando 6 dias a partir de 08/06, o translado passa para 14/06 e o embarque para 15/06.
        CompensacaoFolga[] compensacoes = [Compensacao(new(2026, 6, 8), 6)];

        var periodos = CalculadoraEscala.Projetar(Escala42x42(), ComFolgaNaoGozada(), new(2026, 6, 30), compensacoes);
        Assert.Equal(new DateOnly(2026, 6, 15), periodos[2].Inicio);
        Assert.Equal(new DateOnly(2026, 6, 14), periodos[2].InicioDoCiclo);
        Assert.Equal(new DateOnly(2026, 6, 15), periodos[1].ProximoEmbarque);

        var s = CalculadoraEscala.SituacaoEm(Escala42x42(), ComFolgaNaoGozada(), new(2026, 6, 10), compensacoes);
        Assert.Equal(TipoSituacao.FolgaCompensatoria, s.Tipo);
        Assert.Equal(3, s.DiaDaFase);
        Assert.Equal(6, s.DiasDaFase);
        Assert.Equal(new DateOnly(2026, 6, 15), s.ProximoEmbarque);
    }

    [Fact]
    public void Compensacao_no_dia_do_translado_de_ida_previsto_e_aceita()
    {
        CalculadoraEscala.ValidarCompensacao(Escala42x42(), ComFolgaNaoGozada(), [], Compensacao(new(2026, 6, 8), 10));
    }

    [Fact]
    public void Compensacao_maior_que_o_saldo_e_recusada()
    {
        var erro = Assert.Throws<RegraDeNegocioException>(() =>
            CalculadoraEscala.ValidarCompensacao(Escala42x42(), ComFolgaNaoGozada(),
                [Compensacao(new(2026, 6, 8), 6)], Compensacao(new(2026, 7, 26), 6)));

        Assert.Contains("5 dias", erro.Message);
    }

    [Fact]
    public void Compensacao_no_meio_da_folga_ou_no_dia_do_embarque_e_recusada()
    {
        Assert.Throws<RegraDeNegocioException>(() =>
            CalculadoraEscala.ValidarCompensacao(Escala42x42(), ComFolgaNaoGozada(), [], Compensacao(new(2026, 5, 10), 3)));
        // 09/06 é o embarque previsto; o ciclo começa no translado, em 08/06.
        Assert.Throws<RegraDeNegocioException>(() =>
            CalculadoraEscala.ValidarCompensacao(Escala42x42(), ComFolgaNaoGozada(), [], Compensacao(new(2026, 6, 9), 3)));
    }

    [Fact]
    public void Compensacao_que_cobre_um_embarque_registrado_ou_seu_translado_e_recusada()
    {
        // Aguardando de 08/06 a 10/06; translado em 11/06 e embarque registrado em 12/06.
        Embarque[] embarques = [.. ComFolgaNaoGozada(), Embarque(new(2026, 6, 12))];

        CalculadoraEscala.ValidarCompensacao(Escala42x42(), embarques, [], Compensacao(new(2026, 6, 8), 3));
        var erro = Assert.Throws<RegraDeNegocioException>(() =>
            CalculadoraEscala.ValidarCompensacao(Escala42x42(), embarques, [], Compensacao(new(2026, 6, 8), 4)));
        Assert.Contains("12/06/2026", erro.Message);
    }

    [Fact]
    public void Embarque_anterior_a_qualquer_regra_vigente_e_recusado()
    {
        var regra = new RegraEscala
        {
            Nome = "42x42",
            Versoes = [new VersaoRegraEscala { VigenteDesde = new(2025, 1, 1), DiasEmbarcado = 42, DiasFolga = 42 }],
        };

        Assert.Throws<RegraDeNegocioException>(() =>
            CalculadoraEscala.Projetar(regra, [Embarque(new(2024, 6, 1))], new(2024, 6, 1)));
    }

    [Fact]
    public void Translado_fora_dos_limites_e_apontado_na_regra()
    {
        var v = new VersaoRegraEscala { DiasEmbarcado = 42, DiasFolga = 42, DiasTransladoIda = -1, DiasTransladoVolta = 11 };

        Assert.Equal(2, v.Validar().Count(m => m.Contains("translado")));
    }
}
