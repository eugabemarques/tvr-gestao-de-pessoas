using Toveri.Dominio.Cadastros;

namespace Toveri.Testes;

public class CadastrosTests
{
    [Theory]
    [InlineData("529.982.247-25", true)]
    [InlineData("52998224725", true)]
    [InlineData("529.982.247-24", false)]
    [InlineData("111.111.111-11", false)]
    [InlineData("123", false)]
    [InlineData(null, false)]
    public void Valida_cpf(string? cpf, bool valido)
    {
        Assert.Equal(valido, Cpf.Valido(cpf));
    }

    [Fact]
    public void Documentos_pendentes_consideram_o_setor_e_ignoram_opcionais_e_substituidos()
    {
        RequisitoDocumento[] requisitos =
        [
            new() { SetorId = null, TipoDocumentoId = 1 },                       // todos os setores
            new() { SetorId = null, TipoDocumentoId = 5, Obrigatorio = false },  // passaporte, opcional
            new() { SetorId = 1, TipoDocumentoId = 12 },                         // só o Ambiental
        ];
        DocumentoColaborador[] documentos =
        [
            new() { TipoDocumentoId = 1 },
            new() { TipoDocumentoId = 12, SubstituidoEm = DateTimeOffset.UtcNow },  // só versão antiga
        ];

        Assert.Equal([12], Pendencias.DocumentosPendentes(1, admitido: true, requisitos, documentos));
        Assert.Empty(Pendencias.DocumentosPendentes(2, admitido: true, requisitos, documentos));
    }

    [Fact]
    public void Cursos_pendentes_consideram_o_setor()
    {
        RequisitoCurso[] requisitos = [new() { SetorId = 1, TipoCursoId = 1 }, new() { SetorId = 1, TipoCursoId = 2 }];
        CursoColaborador[] cursos = [new() { TipoCursoId = 1, Validade = new(2027, 1, 1) }];

        Assert.Equal([2], Pendencias.CursosPendentes(1, admitido: true, requisitos, cursos));
        Assert.Empty(Pendencias.CursosPendentes(2, admitido: true, requisitos, cursos));
    }

    [Fact]
    public void Aso_e_cobrado_de_todos_os_setores_so_depois_da_admissao()
    {
        RequisitoCurso[] requisitos = [new() { SetorId = null, TipoCursoId = 7, SomenteAposAdmissao = true }];

        Assert.Empty(Pendencias.CursosPendentes(2, admitido: false, requisitos, []));      // standby
        Assert.Equal([7], Pendencias.CursosPendentes(2, admitido: true, requisitos, []));  // contratado
        Assert.Equal([7], Pendencias.CursosPendentes(3, admitido: true, requisitos, []));  // qualquer setor
    }

    [Fact]
    public void Colaborador_sem_admissao_esta_em_standby()
    {
        Assert.True(new Colaborador().EmStandby);
        Assert.False(new Colaborador { DataAdmissao = new(2026, 11, 1) }.EmStandby);
        Assert.False(new Colaborador { DataDesligamento = new(2026, 11, 1) }.EmStandby);
    }
}
