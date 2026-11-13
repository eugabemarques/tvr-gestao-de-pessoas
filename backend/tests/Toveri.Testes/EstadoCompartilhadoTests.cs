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
            var (_, v) = await a.GravarPatch(Ops("""[{"c":"people","k":"1","v":{"id":1}}]"""), "teste");
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
