using Microsoft.EntityFrameworkCore;
using Toveri.Dominio.Cadastros;
using Toveri.Dominio.Escala;

namespace Toveri.Infraestrutura;

public class ToveriDbContext(DbContextOptions<ToveriDbContext> options) : DbContext(options)
{
    public DbSet<Colaborador> Colaboradores => Set<Colaborador>();
    public DbSet<Setor> Setores => Set<Setor>();
    public DbSet<Barco> Barcos => Set<Barco>();
    public DbSet<Ferias> Ferias => Set<Ferias>();
    public DbSet<RegraEscala> RegrasEscala => Set<RegraEscala>();
    public DbSet<VersaoRegraEscala> VersoesRegraEscala => Set<VersaoRegraEscala>();
    public DbSet<Embarque> Embarques => Set<Embarque>();
    public DbSet<CompensacaoFolga> CompensacoesFolga => Set<CompensacaoFolga>();
    public DbSet<TipoDocumento> TiposDocumento => Set<TipoDocumento>();
    public DbSet<RequisitoDocumento> RequisitosDocumento => Set<RequisitoDocumento>();
    public DbSet<DocumentoColaborador> Documentos => Set<DocumentoColaborador>();
    public DbSet<TipoCurso> TiposCurso => Set<TipoCurso>();
    public DbSet<RequisitoCurso> RequisitosCurso => Set<RequisitoCurso>();
    public DbSet<CursoColaborador> Cursos => Set<CursoColaborador>();
    public DbSet<AvisoResolvido> AvisosResolvidos => Set<AvisoResolvido>();
    public DbSet<RegistroAuditoria> Auditoria => Set<RegistroAuditoria>();

    protected override void OnModelCreating(ModelBuilder m)
    {
        // Todas as relações usam Restrict: nada é apagado em cascata, para preservar o histórico do RH.
        m.Entity<Colaborador>(e =>
        {
            e.ToTable("Colaboradores");
            e.Property(x => x.NomeCompleto).HasMaxLength(200);
            e.Property(x => x.Cpf).HasMaxLength(11).IsFixedLength();
            e.HasIndex(x => x.Cpf).IsUnique();
            e.Property(x => x.Rg).HasMaxLength(20);
            e.Property(x => x.Pis).HasMaxLength(11);
            e.Property(x => x.Passaporte).HasMaxLength(20);
            e.Property(x => x.NomeMae).HasMaxLength(200);
            e.Property(x => x.NomePai).HasMaxLength(200);
            e.Property(x => x.Email).HasMaxLength(254);
            e.Property(x => x.Celular).HasMaxLength(20);
            e.Property(x => x.Celular2).HasMaxLength(20);
            e.Property(x => x.ContatoEmergencia).HasMaxLength(200);
            e.Property(x => x.TituloEleitor).HasMaxLength(20);
            e.Property(x => x.Ctps).HasMaxLength(30);
            e.Property(x => x.Escolaridade).HasMaxLength(50);
            e.Property(x => x.CtfIbama).HasMaxLength(30);
            e.Property(x => x.Cargo).HasMaxLength(100);
            e.Ignore(x => x.Ativo);
            e.Ignore(x => x.EmStandby);
            e.OwnsOne(x => x.Endereco, end =>
            {
                end.Property(x => x.Rua).HasMaxLength(200);
                end.Property(x => x.Numero).HasMaxLength(20);
                end.Property(x => x.Complemento).HasMaxLength(100);
                end.Property(x => x.Bairro).HasMaxLength(100);
                end.Property(x => x.Cidade).HasMaxLength(100);
                end.Property(x => x.Uf).HasMaxLength(2).IsFixedLength();
                end.Property(x => x.Cep).HasMaxLength(8).IsFixedLength();
            });
            e.HasOne(x => x.Setor).WithMany().HasForeignKey(x => x.SetorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Barco>().WithMany().HasForeignKey(x => x.BarcoId).OnDelete(DeleteBehavior.Restrict);
        });

        m.Entity<Setor>(e =>
        {
            e.ToTable("Setores");
            e.Property(x => x.Nome).HasMaxLength(100);
            e.HasIndex(x => x.Nome).IsUnique();
            e.HasOne(x => x.RegraEscala).WithMany().HasForeignKey(x => x.RegraEscalaId).OnDelete(DeleteBehavior.Restrict);
        });

        m.Entity<Barco>(e =>
        {
            e.ToTable("Barcos");
            e.Property(x => x.Nome).HasMaxLength(100);
            e.HasIndex(x => x.Nome).IsUnique();
            e.Property(x => x.Tipo).HasMaxLength(30);
            e.Property(x => x.Observacoes).HasMaxLength(500);
        });

        m.Entity<Ferias>(e =>
        {
            e.ToTable("Ferias");
            e.HasOne<Colaborador>().WithMany().HasForeignKey(x => x.ColaboradorId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.ColaboradorId, x.Inicio });
        });

        m.Entity<RegraEscala>(e =>
        {
            e.ToTable("RegrasEscala");
            e.Property(x => x.Nome).HasMaxLength(50);
            e.HasIndex(x => x.Nome).IsUnique();
            e.HasMany(x => x.Versoes).WithOne().HasForeignKey(x => x.RegraEscalaId).OnDelete(DeleteBehavior.Restrict);
        });

        m.Entity<VersaoRegraEscala>(e =>
        {
            e.ToTable("VersoesRegraEscala");
            e.Property(x => x.FolgaPorDiaDeDobra).HasPrecision(5, 2);
            e.HasIndex(x => new { x.RegraEscalaId, x.VigenteDesde }).IsUnique();
        });

        m.Entity<Embarque>(e =>
        {
            e.ToTable("Embarques");
            e.HasOne<Colaborador>().WithMany().HasForeignKey(x => x.ColaboradorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Barco>().WithMany().HasForeignKey(x => x.BarcoId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.ColaboradorId, x.Inicio }).IsUnique();
        });

        m.Entity<CompensacaoFolga>(e =>
        {
            e.ToTable("CompensacoesFolga");
            e.Property(x => x.Observacao).HasMaxLength(500);
            e.Property(x => x.RegistradoPor).HasMaxLength(254);
            e.Ignore(x => x.Fim);
            e.HasOne<Colaborador>().WithMany().HasForeignKey(x => x.ColaboradorId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.ColaboradorId, x.Inicio }).IsUnique();
        });

        m.Entity<TipoDocumento>(e =>
        {
            e.ToTable("TiposDocumento");
            e.Property(x => x.Nome).HasMaxLength(100);
            e.HasIndex(x => x.Nome).IsUnique();
            e.Property(x => x.Categoria).HasConversion<string>().HasMaxLength(20);
        });

        m.Entity<RequisitoDocumento>(e =>
        {
            e.ToTable("RequisitosDocumento");
            e.HasOne<Setor>().WithMany().HasForeignKey(x => x.SetorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<TipoDocumento>().WithMany().HasForeignKey(x => x.TipoDocumentoId).OnDelete(DeleteBehavior.Restrict);
        });

        m.Entity<DocumentoColaborador>(e =>
        {
            e.ToTable("Documentos");
            e.Property(x => x.NomeArquivo).HasMaxLength(255);
            e.Property(x => x.TipoConteudo).HasMaxLength(100);
            e.Property(x => x.SharePointItemId).HasMaxLength(200);
            e.Property(x => x.EnviadoPor).HasMaxLength(254);
            e.Ignore(x => x.Vigente);
            e.HasOne<Colaborador>().WithMany().HasForeignKey(x => x.ColaboradorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<TipoDocumento>().WithMany().HasForeignKey(x => x.TipoDocumentoId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.ColaboradorId, x.TipoDocumentoId });
        });

        m.Entity<TipoCurso>(e =>
        {
            e.ToTable("TiposCurso");
            e.Property(x => x.Nome).HasMaxLength(100);
            e.HasIndex(x => x.Nome).IsUnique();
        });

        m.Entity<RequisitoCurso>(e =>
        {
            e.ToTable("RequisitosCurso");
            e.HasOne<Setor>().WithMany().HasForeignKey(x => x.SetorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<TipoCurso>().WithMany().HasForeignKey(x => x.TipoCursoId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.SetorId, x.TipoCursoId }).IsUnique();
        });

        m.Entity<CursoColaborador>(e =>
        {
            e.ToTable("Cursos");
            e.HasOne<Colaborador>().WithMany().HasForeignKey(x => x.ColaboradorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.TipoCurso).WithMany().HasForeignKey(x => x.TipoCursoId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<DocumentoColaborador>().WithMany().HasForeignKey(x => x.DocumentoId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.ColaboradorId, x.TipoCursoId }).IsUnique();
            e.HasIndex(x => x.Validade);
        });

        m.Entity<AvisoResolvido>(e =>
        {
            e.ToTable("AvisosResolvidos");
            e.Property(x => x.Chave).HasMaxLength(200);
            e.HasIndex(x => x.Chave).IsUnique();
            e.Property(x => x.ResolvidoPor).HasMaxLength(254);
        });

        m.Entity<RegistroAuditoria>(e =>
        {
            e.ToTable("Auditoria");
            e.Property(x => x.Usuario).HasMaxLength(254);
            e.Property(x => x.Acao).HasMaxLength(50);
            e.Property(x => x.Entidade).HasMaxLength(50);
            e.Property(x => x.EntidadeId).HasMaxLength(50);
            e.Property(x => x.Ip).HasMaxLength(45);
            e.HasIndex(x => x.Quando);
            e.HasIndex(x => new { x.Entidade, x.EntidadeId });
        });

        DadosIniciais.Aplicar(m);
    }
}
