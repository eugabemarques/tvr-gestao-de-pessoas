using Toveri.Api.Compartilhado;
using Xunit;

namespace Toveri.Testes;

public class LeituraIATests
{
    [Fact]
    public void Custo_por_modelo()
    {
        // Haiku 5.5: US$ 0,10 por milhão de tokens de entrada e US$ 0,50 de saída
        Assert.Equal(0.00055, LeituraIA.Custo("claude-haiku-5-5", 3000, 500), 9);
        // modelo desconhecido: preço do Opus (estimativa por cima)
        Assert.Equal(0.022, LeituraIA.Custo("outro", 3000, 500), 9);
    }

    [Fact]
    public void Tipo_do_arquivo_pela_extensao()
    {
        Assert.Equal("application/pdf", LeituraIA.TipoDoArquivo("rg.PDF"));
        Assert.Equal("image/jpeg", LeituraIA.TipoDoArquivo("foto.jpeg"));
        Assert.Null(LeituraIA.TipoDoArquivo("planilha.xlsx"));
    }
}
