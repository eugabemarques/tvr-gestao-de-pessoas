using Microsoft.EntityFrameworkCore;
using Toveri.Dominio;
using Toveri.Dominio.Escala;
using Toveri.Infraestrutura;

var builder = WebApplication.CreateBuilder(args);

var conexao = builder.Configuration.GetConnectionString("Toveri");
if (!string.IsNullOrWhiteSpace(conexao))
    builder.Services.AddDbContext<ToveriDbContext>(o => o.UseSqlServer(conexao));

var app = builder.Build();

app.UseHttpsRedirection();

// Etapa 2: login com Microsoft Entra ID e perfis de acesso.
// Até lá, a API só tem rotas que não envolvem dados pessoais.

app.MapGet("/api/saude", () => Results.Ok(new { status = "ok" }));

// Mesmo cálculo da tela "Registrar embarque" do protótipo.
app.MapPost("/api/escala/simular", (SimulacaoEmbarque s) =>
{
    var regra = new RegraEscala
    {
        Nome = "simulação",
        Versoes =
        [
            new VersaoRegraEscala
            {
                VigenteDesde = DateOnly.MinValue,
                DiasEmbarcado = s.DiasEscalaEmbarcado,
                DiasFolga = s.DiasEscalaFolga,
                FolgaPorDiaDeDobra = s.FolgaPorDiaDeDobra,
            },
        ],
    };
    var erros = regra.Versoes[0].Validar().ToList();
    if (erros.Count > 0)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["escala"] = [.. erros] });

    try
    {
        var embarque = new Embarque { Inicio = s.Inicio, DiasEmbarcado = s.DiasEmbarcado, DiasDobra = s.DiasDobra };
        var p = CalculadoraEscala.Projetar(regra, [embarque], s.Inicio).Single();
        return Results.Ok(new
        {
            p.Inicio,
            p.DiasABordo,
            p.UltimoDiaABordo,
            p.DiasFolga,
            p.PrimeiroDiaDeFolga,
            p.UltimoDiaDeFolga,
            p.ProximoEmbarque,
        });
    }
    catch (RegraDeNegocioException e)
    {
        return Results.Problem(e.Message, statusCode: StatusCodes.Status400BadRequest);
    }
});

app.Run();

public sealed record SimulacaoEmbarque(
    DateOnly Inicio,
    int DiasEmbarcado,
    int DiasDobra = 0,
    int DiasEscalaEmbarcado = 42,
    int DiasEscalaFolga = 42,
    decimal FolgaPorDiaDeDobra = 1m);
