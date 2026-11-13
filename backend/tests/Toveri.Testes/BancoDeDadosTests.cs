using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Toveri.Dominio.Cadastros;
using Toveri.Dominio.Escala;
using Toveri.Infraestrutura;

namespace Toveri.Testes;

/// <summary>
/// Confere o mapeamento do banco num SQLite em memória.
/// Em produção o banco é o Azure SQL; aqui só validamos tabelas, relações e dados iniciais.
/// </summary>
public sealed class BancoDeDadosTests : IDisposable
{
    private readonly SqliteConnection _conexao = new("DataSource=:memory:");

    public BancoDeDadosTests()
    {
        _conexao.Open();
        using var db = Criar();
        db.Database.EnsureCreated();
    }

    private ToveriDbContext Criar() =>
        new(new DbContextOptionsBuilder<ToveriDbContext>().UseSqlite(_conexao).Options);

    public void Dispose() => _conexao.Dispose();

    [Fact]
    public void Dados_iniciais_trazem_a_escala_42x42_e_os_requisitos_do_ambiental()
    {
        using var db = Criar();

        var regra = db.RegrasEscala.Include(r => r.Versoes).Single(r => r.Nome == "42x42");
        Assert.Equal(42, regra.VersaoEm(new DateOnly(2026, 11, 13)).DiasEmbarcado);

        var ambiental = db.Setores.Single(s => s.Nome == "Ambiental");
        Assert.Equal(regra.Id, ambiental.RegraEscalaId);
        Assert.Equal(4, db.RequisitosCurso.Count(r => r.SetorId == ambiental.Id));
        Assert.Equal(2, db.RequisitosDocumento.Count(r => r.SetorId == ambiental.Id));
        Assert.Equal(9, db.RequisitosDocumento.Count(r => r.SetorId == null && r.Obrigatorio));
    }

    [Fact]
    public void Grava_e_le_colaborador_com_endereco_embarque_e_curso()
    {
        int id;
        using (var db = Criar())
        {
            var c = NovoColaborador("52998224725");
            db.Colaboradores.Add(c);
            db.SaveChanges();
            id = c.Id;
            db.Embarques.Add(new Embarque { ColaboradorId = id, Inicio = new(2026, 11, 1), DiasEmbarcado = 42 });
            db.Cursos.Add(new CursoColaborador { ColaboradorId = id, TipoCursoId = 1, Validade = new(2027, 5, 1) });
            db.SaveChanges();
        }

        using (var db = Criar())
        {
            var c = db.Colaboradores.Include(x => x.Setor).Single(x => x.Id == id);
            Assert.Equal("Ambiental", c.Setor!.Nome);
            Assert.Equal("01001000", c.Endereco.Cep);
            Assert.True(c.Ativo);
            Assert.Single(db.Embarques.Where(e => e.ColaboradorId == id));
            Assert.Equal("CBSP", db.Cursos.Include(x => x.TipoCurso).Single(x => x.ColaboradorId == id).TipoCurso!.Nome);
        }
    }

    [Fact]
    public void Cpf_repetido_e_recusado_pelo_banco()
    {
        using var db = Criar();
        db.Colaboradores.Add(NovoColaborador("52998224725"));
        db.SaveChanges();
        db.Colaboradores.Add(NovoColaborador("52998224725"));

        Assert.Throws<DbUpdateException>(() => db.SaveChanges());
    }

    [Fact]
    public void Colaborador_com_historico_nao_pode_ser_apagado()
    {
        int id;
        using (var db = Criar())
        {
            var c = NovoColaborador("52998224725");
            db.Colaboradores.Add(c);
            db.SaveChanges();
            id = c.Id;
            db.Embarques.Add(new Embarque { ColaboradorId = id, Inicio = new(2026, 11, 1), DiasEmbarcado = 42 });
            db.SaveChanges();
        }

        // Contexto novo, sem o embarque carregado: quem barra a exclusão é o próprio banco.
        using (var db = Criar())
        {
            db.Colaboradores.Remove(db.Colaboradores.Single(x => x.Id == id));
            Assert.Throws<DbUpdateException>(() => db.SaveChanges());
        }
    }

    private static Colaborador NovoColaborador(string cpf) => new()
    {
        NomeCompleto = "Pessoa de Teste",
        Cpf = cpf,
        Rg = "123456",
        NomeMae = "Mãe de Teste",
        Email = "teste@exemplo.com",
        Celular = "21999990000",
        ContatoEmergencia = "Contato 21988880000",
        Endereco = new Endereco { Rua = "Rua A", Numero = "1", Cep = "01001000" },
        Cargo = "Técnico",
        SetorId = 1,
        CriadoEm = DateTimeOffset.UtcNow,
        AtualizadoEm = DateTimeOffset.UtcNow,
    };
}
