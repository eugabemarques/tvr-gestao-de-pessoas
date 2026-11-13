using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Toveri.Dominio;
using Toveri.Api.Compartilhado;
using Toveri.Dominio.Escala;
using Toveri.Infraestrutura;

var builder = WebApplication.CreateBuilder(args);

var conexao = builder.Configuration.GetConnectionString("Toveri");
if (!string.IsNullOrWhiteSpace(conexao))
    builder.Services.AddDbContext<ToveriDbContext>(o => o.UseSqlServer(conexao));

// Dados compartilhados das telas (ver Compartilhado/EstadoCompartilhado.cs). No Azure: Toveri__Dados=/home/dados.
var pastaDados = builder.Configuration["Toveri:Dados"] ?? Path.Combine(builder.Environment.ContentRootPath, "dados");
builder.Services.AddSingleton(new EstadoCompartilhado(pastaDados));
builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = 25 * 1024 * 1024);

// Login igual ao do Portal de Projetos: "Entrar com Microsoft" + lista de e-mails liberados.
builder.AddLoginMicrosoft(pastaDados);
// O App Service termina o https na frente; sem isso o retorno do login sairia como http.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseProtecaoDaApi();
app.MapLoginMicrosoft();

// Telas (React, compiladas em wwwroot). O index.html nunca fica em cache, para cada publicação valer na hora.
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = c => c.Context.Response.Headers.CacheControl =
        c.File.Name == "index.html" ? "no-store" : "public, max-age=31536000, immutable",
});

app.MapGet("/api/saude", () => Results.Ok(new { status = "ok" }));
app.MapRotasCompartilhadas();

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

// Qualquer outro caminho que não seja da API abre as telas (navegação do React).
app.MapFallback(async ctx =>
{
    var index = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html");
    if (ctx.Request.Path.StartsWithSegments("/api") || !File.Exists(index))
    {
        ctx.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    ctx.Response.ContentType = "text/html; charset=utf-8";
    ctx.Response.Headers.CacheControl = "no-store";
    await ctx.Response.SendFileAsync(index);
});

app.Run();

public partial class Program;

public sealed record SimulacaoEmbarque(
    DateOnly Inicio,
    int DiasEmbarcado,
    int DiasDobra = 0,
    int DiasEscalaEmbarcado = 42,
    int DiasEscalaFolga = 42,
    decimal FolgaPorDiaDeDobra = 1m);
