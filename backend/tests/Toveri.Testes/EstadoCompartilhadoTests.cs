using System.Text.Json.Nodes;
using Toveri.Api.Compartilhado;

namespace Toveri.Testes;

public class EstadoCompartilhadoTests
{
    private static JsonArray Ops(string json) => JsonNode.Parse(json)!.AsArray();

    [Fact]
    public void Inclui_altera_e_remove_registro_a_registro()
    {
        var e = EstadoCompartilhado.Vazio();
        EstadoCompartilhado.Aplicar(e, Ops("""[{"c":"people","k":"7","v":{"id":7,"name":"A"}},{"c":"people","k":"8","v":{"id":8,"name":"B"}}]"""));
        EstadoCompartilhado.Aplicar(e, Ops("""[{"c":"people","k":"7","v":{"id":7,"name":"A2"}},{"c":"people","k":"8","v":null}]"""));
        var p = e["people"]!.AsArray();
        Assert.Single(p);
        Assert.Equal("A2", p[0]!["name"]!.GetValue<string>());
    }

    [Fact]
    public void Chaves_compostas_iguais_as_das_telas()
    {
        var e = EstadoCompartilhado.Vazio();
        EstadoCompartilhado.Aplicar(e, Ops("""[{"c":"courses","k":"3|ASO","v":{"pid":3,"name":"ASO","valid":100}}]"""));
        EstadoCompartilhado.Aplicar(e, Ops("""[{"c":"courses","k":"3|ASO","v":{"pid":3,"name":"ASO","valid":200}},{"c":"hist","k":"3|20000","v":{"pid":3,"ini":20000}}]"""));
        Assert.Single(e["courses"]!.AsArray());
        Assert.Equal(200, e["courses"]![0]!["valid"]!.GetValue<int>());
        Assert.Single(e["hist"]!.AsArray());
    }

    [Fact]
    public void Colecao_sem_chave_ou_w_substitui_inteira_e_ignora_internas()
    {
        var e = EstadoCompartilhado.Vazio();
        EstadoCompartilhado.Aplicar(e, Ops("""[{"c":"log","w":1,"v":[1,2]},{"c":"config","v":{"x":1}},{"c":"_x","v":1}]"""));
        Assert.Equal(2, e["log"]!.AsArray().Count);
        Assert.Equal(1, e["config"]!["x"]!.GetValue<int>());
        Assert.False(e.ContainsKey("_x"));
    }

    [Fact]
    public async Task Grava_versao_e_persiste_no_disco()
    {
        var pasta = Path.Combine(Path.GetTempPath(), "toveri-teste-" + Guid.NewGuid().ToString("N"));
        try
        {
            var a = new EstadoCompartilhado(pasta);
            Assert.Null(a.Ler().Dados);
            var (_, v, _) = await a.GravarPatch(Ops("""[{"c":"people","k":"1","v":{"id":1}}]"""), "teste");
            Assert.Equal(1, v);
            var b = new EstadoCompartilhado(pasta);
            Assert.Equal(1, b.Versao());
            Assert.Single(b.Ler().Dados!["people"]!.AsArray());
        }
        finally
        {
            Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
            try { Directory.Delete(pasta, true); } catch (IOException) { }
        }
    }
}

public class EnvioSharePointTests
{
    [Fact]
    public void Nome_do_documento_usa_o_campo_e_nao_sobrescreve_frente_e_verso()
    {
        var d = System.Text.Json.Nodes.JsonNode.Parse("""{"campo":"RG / CPF / CNH","name":"foto.JPG","fid":"abcdef123456abcdef123456"}""")!.AsObject();
        Assert.Equal("RG - CPF - CNH (abcdef).jpg", EnvioSharePoint.NomeDocumento(d));
        var c = System.Text.Json.Nodes.JsonNode.Parse("""{"campo":"Curso: NR-35","name":"a.pdf","fid":"111111aaaaaa111111aaaaaa"}""")!.AsObject();
        Assert.Equal("Curso - NR-35 (111111).pdf", EnvioSharePoint.NomeDocumento(c));
    }

    [Fact]
    public void Ficha_tem_os_dados_e_decodifica_texto()
    {
        var p = System.Text.Json.Nodes.JsonNode.Parse("""{"id":1,"name":"Jo&#39;ao D&amp;Silva","setor":"manutencao","cpf":"529.982.247-25","docs":[{"campo":"ASO","name":"aso.pdf","fid":"x"}]}""")!.AsObject();
        var f = EnvioSharePoint.Ficha(p);
        Assert.Contains("Nome completo: Jo'ao D&Silva", f);
        Assert.Contains("Setor: Manutenção Offshore", f);
        Assert.Contains("CPF: 529.982.247-25", f);
        Assert.Contains("- ASO: aso.pdf", f);
    }
}

/// <summary>Só o Admin RH corrige ou apaga embarques já registrados.</summary>
public class HistoricoProtegidoTests
{
    private static JsonArray Ops(string json) => JsonNode.Parse(json)!.AsArray();

    private static JsonObject ComDoisEmbarques()
    {
        var e = EstadoCompartilhado.Vazio();
        EstadoCompartilhado.Aplicar(e, Ops("""[{"c":"hist","k":"3|100","v":{"pid":3,"ini":100,"dias":42}},{"c":"hist","k":"3|185","v":{"pid":3,"ini":185,"dias":42}}]"""));
        return e;
    }

    [Fact]
    public void RH_inclui_embarque_novo_e_ajusta_o_mais_recente()
    {
        var e = ComDoisEmbarques();
        var (ok, bloq, corr) = EstadoCompartilhado.FiltrarHistorico(e, Ops("""
            [{"c":"hist","k":"3|270","v":{"pid":3,"ini":270,"dias":42}},
             {"c":"hist","k":"3|185","v":{"pid":3,"ini":185,"dias":42,"dobra":5}},
             {"c":"people","k":"3","v":{"id":3}}]
            """), podeCorrigir: false);
        Assert.Equal(3, ok.Count);
        Assert.Empty(bloq);
        Assert.Single(corr); // a dobra no mais recente fica na auditoria
    }

    [Fact]
    public void RH_nao_altera_embarque_antigo_nem_apaga()
    {
        var e = ComDoisEmbarques();
        var (ok, bloq, _) = EstadoCompartilhado.FiltrarHistorico(e, Ops("""
            [{"c":"hist","k":"3|100","v":{"pid":3,"ini":100,"dias":30}},
             {"c":"hist","k":"3|185","v":null},
             {"c":"hist","w":1,"v":[]},
             {"c":"people","k":"3","v":{"id":3}}]
            """), podeCorrigir: false);
        Assert.Single(ok);
        Assert.Equal(3, bloq.Count);
    }

    [Fact]
    public void Admin_RH_corrige_e_apaga_com_antes_e_depois_na_auditoria()
    {
        var e = ComDoisEmbarques();
        var (ok, bloq, corr) = EstadoCompartilhado.FiltrarHistorico(e, Ops("""
            [{"c":"hist","k":"3|100","v":null},{"c":"hist","k":"3|101","v":{"pid":3,"ini":101,"dias":42}}]
            """), podeCorrigir: true);
        Assert.Equal(2, ok.Count);
        Assert.Empty(bloq);
        var c = Assert.Single(corr);
        Assert.Equal(100, c["antes"]!["ini"]!.GetValue<int>());
        Assert.Null(c["depois"]);
    }

    [Fact]
    public async Task Gravacao_de_quem_nao_e_admin_descarta_so_a_correcao()
    {
        var pasta = Path.Combine(Path.GetTempPath(), "toveri-teste-" + Guid.NewGuid().ToString("N"));
        try
        {
            var a = new EstadoCompartilhado(pasta);
            await a.GravarPatch(Ops("""[{"c":"hist","k":"3|100","v":{"pid":3,"ini":100,"dias":42}},{"c":"hist","k":"3|185","v":{"pid":3,"ini":185,"dias":42}}]"""), "admin");
            var (dados, _, bloq) = await a.GravarPatch(Ops("""[{"c":"hist","k":"3|100","v":null},{"c":"people","k":"3","v":{"id":3}}]"""), "rh", false);
            Assert.Equal(1, bloq);
            Assert.Equal(2, dados["hist"]!.AsArray().Count);
            Assert.Single(dados["people"]!.AsArray());
        }
        finally
        {
            Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
            try { Directory.Delete(pasta, true); } catch (IOException) { }
        }
    }
}
