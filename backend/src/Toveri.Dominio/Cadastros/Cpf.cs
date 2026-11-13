namespace Toveri.Dominio.Cadastros;

public static class Cpf
{
    public static string SomenteDigitos(string? texto) => new((texto ?? "").Where(char.IsAsciiDigit).ToArray());

    /// <summary>Confere os 11 dígitos e os dois dígitos verificadores.</summary>
    public static bool Valido(string? cpf)
    {
        var d = SomenteDigitos(cpf);
        if (d.Length != 11 || d.Distinct().Count() == 1)
            return false;

        int Verificador(int quantidade)
        {
            var soma = 0;
            for (var i = 0; i < quantidade; i++)
                soma += (d[i] - '0') * (quantidade + 1 - i);
            var resto = soma % 11;
            return resto < 2 ? 0 : 11 - resto;
        }

        return Verificador(9) == d[9] - '0' && Verificador(10) == d[10] - '0';
    }
}
