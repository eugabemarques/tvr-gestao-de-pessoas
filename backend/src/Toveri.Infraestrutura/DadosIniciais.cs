using Microsoft.EntityFrameworkCore;
using Toveri.Dominio.Cadastros;
using Toveri.Dominio.Escala;

namespace Toveri.Infraestrutura;

/// <summary>
/// Cadastros com que o sistema começa, tirados das regras do protótipo.
/// Depois da implantação, o RH ajusta tudo isso pelas telas.
/// </summary>
internal static class DadosIniciais
{
    public static class Ids
    {
        public const int Escala42x42 = 1;
        public const int SetorAmbiental = 1, SetorAdministrativo = 2, SetorManutencaoOffshore = 3;
    }

    public static void Aplicar(ModelBuilder m)
    {
        m.Entity<RegraEscala>().HasData(new RegraEscala { Id = Ids.Escala42x42, Nome = "42x42" });
        m.Entity<VersaoRegraEscala>().HasData(new VersaoRegraEscala
        {
            Id = 1,
            RegraEscalaId = Ids.Escala42x42,
            VigenteDesde = new DateOnly(2020, 1, 1),
            DiasEmbarcado = 42,
            DiasFolga = 42,
            FolgaPorDiaDeDobra = 1m,
        });

        m.Entity<Setor>().HasData(
            new Setor { Id = Ids.SetorAmbiental, Nome = "Ambiental", RegraEscalaId = Ids.Escala42x42 },
            new Setor { Id = Ids.SetorAdministrativo, Nome = "Administrativo" },
            new Setor { Id = Ids.SetorManutencaoOffshore, Nome = "Manutenção Offshore" });

        m.Entity<TipoCurso>().HasData(
            new TipoCurso { Id = 1, Nome = "CBSP" },
            new TipoCurso { Id = 2, Nome = "THUET / BOSIET / FOET" },
            new TipoCurso { Id = 3, Nome = "Norueguês / OEUK / ENG1" },
            new TipoCurso { Id = 4, Nome = "Certificado PAM" },
            new TipoCurso { Id = 5, Nome = "MMO - Observação de Mamíferos Marinhos" },
            new TipoCurso { Id = 6, Nome = "MAP - Monitoramento Acústico Passivo" },
            new TipoCurso { Id = 7, Nome = "ASO", EhAso = true });

        m.Entity<RequisitoCurso>().HasData(
            new RequisitoCurso { Id = 1, SetorId = Ids.SetorAmbiental, TipoCursoId = 1 },
            new RequisitoCurso { Id = 2, SetorId = Ids.SetorAmbiental, TipoCursoId = 2 },
            new RequisitoCurso { Id = 3, SetorId = Ids.SetorAmbiental, TipoCursoId = 3 },
            new RequisitoCurso { Id = 4, SetorId = Ids.SetorAmbiental, TipoCursoId = 4 });

        m.Entity<TipoDocumento>().HasData(
            new TipoDocumento { Id = 1, Nome = "RG / CPF / CNH", Categoria = CategoriaDocumento.Pessoal },
            new TipoDocumento { Id = 2, Nome = "Certidão de nascimento ou casamento", Categoria = CategoriaDocumento.Pessoal },
            new TipoDocumento { Id = 3, Nome = "Título de eleitor", Categoria = CategoriaDocumento.Pessoal },
            new TipoDocumento { Id = 4, Nome = "CTPS (física ou digital)", Categoria = CategoriaDocumento.Pessoal },
            new TipoDocumento { Id = 5, Nome = "Passaporte", Categoria = CategoriaDocumento.Pessoal },
            new TipoDocumento { Id = 6, Nome = "PIS", Categoria = CategoriaDocumento.Pessoal },
            new TipoDocumento { Id = 7, Nome = "Comprovante de residência", Categoria = CategoriaDocumento.Pessoal },
            new TipoDocumento { Id = 8, Nome = "Comprovante de escolaridade", Categoria = CategoriaDocumento.Pessoal },
            new TipoDocumento { Id = 9, Nome = "Vacina: Covid-19", Categoria = CategoriaDocumento.Vacina },
            new TipoDocumento { Id = 10, Nome = "Vacina: DT (difteria e tétano)", Categoria = CategoriaDocumento.Vacina },
            new TipoDocumento { Id = 11, Nome = "Vacina: Febre amarela", Categoria = CategoriaDocumento.Vacina },
            new TipoDocumento { Id = 12, Nome = "CTF Ibama (atualizado)", Categoria = CategoriaDocumento.Pessoal },
            new TipoDocumento { Id = 13, Nome = "Work Citation", Categoria = CategoriaDocumento.Outro });

        // Todos os setores: documentos 1 a 11 (passaporte e PIS só se o colaborador tiver).
        var todos = Enumerable.Range(1, 11).Select(t => new RequisitoDocumento
        {
            Id = t,
            SetorId = null,
            TipoDocumentoId = t,
            Obrigatorio = t is not (5 or 6),
        });
        var ambiental = new[]
        {
            new RequisitoDocumento { Id = 12, SetorId = Ids.SetorAmbiental, TipoDocumentoId = 12 },
            new RequisitoDocumento { Id = 13, SetorId = Ids.SetorAmbiental, TipoDocumentoId = 13 },
        };
        m.Entity<RequisitoDocumento>().HasData(todos.Concat(ambiental).ToArray());
    }
}
