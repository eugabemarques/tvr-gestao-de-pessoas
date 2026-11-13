using Toveri.Dominio.Avisos;
using Toveri.Dominio.Validades;
using static Toveri.Testes.EscalaTests;

namespace Toveri.Testes;

public class ValidadeEAvisosTests
{
    private static readonly DateOnly Hoje = new(2026, 11, 13);

    [Theory]
    [InlineData(-1, FaixaValidade.Vencido)]
    [InlineData(0, FaixaValidade.Urgente)]   // o dia da validade ainda vale
    [InlineData(60, FaixaValidade.Urgente)]
    [InlineData(61, FaixaValidade.Atencao)]
    [InlineData(90, FaixaValidade.Atencao)]
    [InlineData(91, FaixaValidade.EmDia)]
    public void Faixas_de_validade_padrao(int diasAteVencer, FaixaValidade esperada)
    {
        var r = CalculadoraValidade.Avaliar(Hoje.AddDays(diasAteVencer), Hoje);

        Assert.Equal(esperada, r.Faixa);
        Assert.Equal(diasAteVencer, r.DiasRestantes);
    }

    [Fact]
    public void Faixas_de_validade_podem_ser_ajustadas()
    {
        var cfg = new ConfiguracaoValidade(DiasUrgente: 30, DiasAtencao: 45);

        Assert.Equal(FaixaValidade.Atencao, CalculadoraValidade.Avaliar(Hoje.AddDays(31), Hoje, cfg).Faixa);
        Assert.Equal(FaixaValidade.EmDia, CalculadoraValidade.Avaliar(Hoje.AddDays(46), Hoje, cfg).Faixa);
    }

    [Fact]
    public void Embarcado_avisa_o_que_vence_ate_o_fim_do_embarque()
    {
        // Embarcou há 10 dias: fica a bordo até Hoje+31.
        var avisos = AvisosDeEmbarque.Gerar(Escala42x42(), [Embarque(Hoje.AddDays(-10))],
        [
            new ItemComValidade("HUET", Hoje.AddDays(20)),
            new ItemComValidade("CBSP", Hoje.AddDays(40)),
            new ItemComValidade("ASO", Hoje.AddDays(-1)),
        ], Hoje);

        Assert.Collection(avisos,
            a => { Assert.Equal("ASO", a.Item.Descricao); Assert.Equal(GravidadeAviso.Critico, a.Gravidade); },
            a => { Assert.Equal("HUET", a.Item.Descricao); Assert.Equal(GravidadeAviso.Atencao, a.Gravidade); });
    }

    [Fact]
    public void De_folga_avisa_o_que_vence_antes_ou_durante_o_proximo_embarque()
    {
        // Próximo embarque em Hoje+20, a bordo até Hoje+61.
        var avisos = AvisosDeEmbarque.Gerar(Escala42x42(), [Embarque(Hoje.AddDays(-64))],
        [
            new ItemComValidade("CBSP", Hoje.AddDays(10)),
            new ItemComValidade("HUET", Hoje.AddDays(30)),
            new ItemComValidade("ASO", Hoje.AddDays(70)),
        ], Hoje);

        Assert.Collection(avisos,
            a => { Assert.Equal("CBSP", a.Item.Descricao); Assert.Equal(GravidadeAviso.Critico, a.Gravidade); },
            a => { Assert.Equal("HUET", a.Item.Descricao); Assert.Equal(GravidadeAviso.Atencao, a.Gravidade); });
    }

    [Fact]
    public void Embarque_daqui_a_mais_de_30_dias_ainda_nao_gera_aviso()
    {
        // Próximo embarque em Hoje+40.
        var avisos = AvisosDeEmbarque.Gerar(Escala42x42(), [Embarque(Hoje.AddDays(-44))],
            [new ItemComValidade("CBSP", Hoje.AddDays(45))], Hoje);

        Assert.Empty(avisos);
    }

    [Fact]
    public void Primeiro_embarque_proximo_tambem_gera_aviso()
    {
        var avisos = AvisosDeEmbarque.Gerar(Escala42x42(), [Embarque(Hoje.AddDays(10))],
            [new ItemComValidade("ASO", Hoje.AddDays(5))], Hoje);

        Assert.Equal(GravidadeAviso.Critico, Assert.Single(avisos).Gravidade);
    }
}
