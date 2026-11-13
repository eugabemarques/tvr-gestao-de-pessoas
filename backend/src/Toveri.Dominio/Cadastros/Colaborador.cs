namespace Toveri.Dominio.Cadastros;

public class Colaborador
{
    public int Id { get; set; }
    public string NomeCompleto { get; set; } = "";

    /// <summary>Só os 11 dígitos.</summary>
    public string Cpf { get; set; } = "";

    public string Rg { get; set; } = "";
    public string? Pis { get; set; }
    public string? Passaporte { get; set; }
    public string NomeMae { get; set; } = "";
    public string? NomePai { get; set; }
    public string Email { get; set; } = "";
    public string Celular { get; set; } = "";
    public string? Celular2 { get; set; }
    public string ContatoEmergencia { get; set; } = "";
    public Endereco Endereco { get; set; } = new();
    public string? TituloEleitor { get; set; }
    public string? Ctps { get; set; }
    public string? Escolaridade { get; set; }
    public string? CtfIbama { get; set; }
    public string Cargo { get; set; } = "";

    public int SetorId { get; set; }
    public Setor? Setor { get; set; }

    /// <summary>Barco habitual, sugerido ao registrar um embarque.</summary>
    public int? BarcoId { get; set; }

    public DateOnly? DataAdmissao { get; set; }

    /// <summary>
    /// Preenchida no desligamento. O cadastro nunca é apagado: o RH precisa manter o histórico
    /// pelos prazos legais.
    /// </summary>
    public DateOnly? DataDesligamento { get; set; }

    public bool Ativo => DataDesligamento is null;

    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
}

public class Endereco
{
    public string Rua { get; set; } = "";
    public string Numero { get; set; } = "";
    public string? Complemento { get; set; }
    public string? Bairro { get; set; }
    public string? Cidade { get; set; }
    public string? Uf { get; set; }

    /// <summary>Só os 8 dígitos.</summary>
    public string Cep { get; set; } = "";
}
