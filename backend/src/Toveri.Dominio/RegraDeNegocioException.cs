namespace Toveri.Dominio;

/// <summary>Erro de regra de negócio, com mensagem pronta para mostrar ao usuário.</summary>
public class RegraDeNegocioException(string mensagem) : Exception(mensagem);
