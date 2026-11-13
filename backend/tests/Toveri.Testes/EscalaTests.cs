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

    internal static Embarque Embarque(DateOnly inicio, int dias = 42, int dobra = 0) =>
        new() { Inicio = inicio, DiasEmbarcado = dias, DiasDobra = dobra };

    [Fact]
    public void Embarque_padrao_conta_o_dia_do_embarque_como_dia_1()
    {
        var p = CalculadoraEscala.Projetar(Escala42x42(), [Embarque(new(2026, 1, 1))], new(2026, 1, 1)).Single();

        Assert.Equal(new DateOnly(2026, 2, 11), p.UltimoDiaABordo);
        Assert.Equal(new DateOnly(2026, 2, 12), p.PrimeiroDiaDeFolga);
        Assert.Equal(42, p.DiasFolga);
        Assert.Equal(new DateOnly(2026, 3, 25), p.UltimoDiaDeFolga);
        Assert.Equal(new DateOnly(2026, 3, 26), p.ProximoEmbarque);
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
        Assert.Equal(new DateOnly(2026, 4, 9), comDobra.ProximoEmbarque);

        var seguinte = periodos[1];
        Assert.Equal(OrigemPeriodo.Previsto, seguinte.Origem);
        Assert.Equal(42, seguinte.DiasABordo);
        Assert.Equal(0, seguinte.DiasDobra);
        Assert.Equal(new DateOnly(2026, 7, 2), seguinte.ProximoEmbarque);
    }

    // Mesmos colaboradores de exemplo do protótipo.
    [Theory]
    [InlineData(10, 0, TipoSituacao.Embarcado, 11, 42)]   // Ana
    [InlineData(36, 7, TipoSituacao.Embarcado, 37, 49)]   // Bruno, com dobra de 7 dias
    [InlineData(52, 0, TipoSituacao.Folga, 11, 42)]       // Carla
    [InlineData(80, 0, TipoSituacao.Folga, 39, 42)]       // Diego
    [InlineData(90, 0, TipoSituacao.Embarcado, 7, 42)]    // segundo ciclo, previsto
    public void Situacao_hoje_bate_com_o_prototipo(int diasDesdeOEmbarque, int dobra, TipoSituacao tipo, int dia, int total)
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

        var periodos = CalculadoraEscala.Projetar(regra, [Embarque(new(2026, 1, 1))], new(2026, 6, 18));

        Assert.Equal(3, periodos.Count);
        Assert.Equal(42, periodos[0].DiasABordo);                      // registrado em janeiro: regra antiga
        Assert.Equal(new DateOnly(2026, 3, 26), periodos[1].Inicio);   // começa antes da mudança: regra antiga
        Assert.Equal(42, periodos[1].DiasABordo);
        Assert.Equal(new DateOnly(2026, 6, 18), periodos[2].Inicio);   // começa depois da mudança: regra nova
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
    public void Embarque_que_comeca_durante_a_folga_registra_os_dias_nao_gozados()
    {
        var periodos = CalculadoraEscala.Projetar(Escala42x42(),
            [Embarque(new(2026, 1, 1)), Embarque(new(2026, 3, 16))], new(2026, 3, 16));

        Assert.Equal(32, periodos[0].DiasFolga);
        Assert.Equal(10, periodos[0].DiasFolgaNaoGozados);
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
    public void Entre_a_folga_e_um_embarque_atrasado_fica_fora_da_escala()
    {
        var s = CalculadoraEscala.SituacaoEm(Escala42x42(),
            [Embarque(new(2026, 1, 1)), Embarque(new(2026, 4, 10))], new(2026, 4, 1));

        Assert.Equal(TipoSituacao.ForaDaEscala, s.Tipo);
        Assert.Equal(new DateOnly(2026, 4, 10), s.ProximoEmbarque);
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
}
