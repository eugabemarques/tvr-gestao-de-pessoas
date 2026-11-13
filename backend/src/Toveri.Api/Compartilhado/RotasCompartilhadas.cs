using System.Text.Json.Nodes;

namespace Toveri.Api.Compartilhado;

public sealed record UsuarioToveri(string Login, string Nome);

/// <summary>
/// Quem está usando: a conta Microsoft que entrou (cookie de sessão do próprio sistema, ver LoginMicrosoft),
/// desde que o e-mail esteja na lista liberada. Em desenvolvimento, sem login configurado, usa <c>Toveri:UsuarioDev</c>.
/// </summary>
public static class Identidade
{
    public enum Situacao { SemLogin, SemAcesso, Liberado }

    public static (Situacao, UsuarioToveri?) Atual(HttpContext ctx, IConfiguration cfg, IHostEnvironment env)
    {
        if (ctx.User.Identity?.IsAuthenticated == true)
        {
            var email = LoginMicrosoft.Email(ctx.User);
            if (email is null) return (Situacao.SemAcesso, new UsuarioToveri("?", "?"));
            var u = new UsuarioToveri(email, ctx.User.FindFirst("name")?.Value ?? email);
            return (LoginMicrosoft.Liberado(cfg, email) ? Situacao.Liberado : Situacao.SemAcesso, u);
        }
        var dev = cfg["Toveri:UsuarioDev"];
        if (env.IsDevelopment() && !string.IsNullOrWhiteSpace(dev) && !LoginMicrosoft.LoginConfigurado(cfg))
            return (Situacao.Liberado, new UsuarioToveri(dev, dev));
        return (Situacao.SemLogin, null);
    }
}

public static class RotasCompartilhadas
{
    private const string ChaveUsuario = "toveri.usuario";

    public static UsuarioToveri Usuario(this HttpContext ctx) => (UsuarioToveri)ctx.Items[ChaveUsuario]!;

    private static bool Publico(PathString p) =>
        p.StartsWithSegments("/api/saude") || p.StartsWithSegments("/entrar") || p.StartsWithSegments("/auth")
        || p.StartsWithSegments("/login") || p == "/logo-cor.png" || p == "/logo-branca.png";

    /// <summary>
    /// Tudo exige login e acesso liberado, menos a tela de entrada e /api/saude.
    /// Na API: 401 sem login, 403 sem acesso, e o cabeçalho X-Toveri nas escritas (proteção contra CSRF).
    /// </summary>
    public static IApplicationBuilder UseProtecaoDaApi(this IApplicationBuilder app) => app.Use(async (ctx, next) =>
    {
        ctx.Response.Headers.XContentTypeOptions = "nosniff";
        ctx.Response.Headers["Referrer-Policy"] = "same-origin";
        ctx.Response.Headers.XFrameOptions = "DENY";
        var caminho = ctx.Request.Path;
        if (Publico(caminho)) { await next(); return; }

        var cfg = ctx.RequestServices.GetRequiredService<IConfiguration>();
        var env = ctx.RequestServices.GetRequiredService<IHostEnvironment>();
        var (situacao, u) = Identidade.Atual(ctx, cfg, env);
        var ehApi = caminho.StartsWithSegments("/api");
        if (situacao == Identidade.Situacao.SemLogin)
        {
            if (ehApi)
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await ctx.Response.WriteAsJsonAsync(new { erro = "Faça login para continuar." });
            }
            else ctx.Response.Redirect("/entrar");
            return;
        }
        if (situacao == Identidade.Situacao.SemAcesso)
        {
            if (ehApi)
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                await ctx.Response.WriteAsJsonAsync(new { erro = "Seu acesso ainda não foi liberado." });
            }
            else await LoginMicrosoft.PaginaSemAcesso(u!.Login).ExecuteAsync(ctx);
            return;
        }
        if (ehApi && !HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method)
            && ctx.Request.Headers["X-Toveri"] != "1")
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            await ctx.Response.WriteAsJsonAsync(new { erro = "Requisição não permitida." });
            return;
        }
        ctx.Items[ChaveUsuario] = u;
        await next();
    });


    public static void MapRotasCompartilhadas(this WebApplication app)
    {
        var api = app.MapGroup("/api");

        api.MapGet("/me", (HttpContext ctx) =>
        {
            var u = ctx.Usuario();
            return Results.Ok(new { login = u.Login, nome = u.Nome, admin = true });
        });

        api.MapGet("/estado", (EstadoCompartilhado e) =>
        {
            var (dados, versao) = e.Ler();
            return Results.Json(new JsonObject { ["versao"] = versao, ["dados"] = dados });
        });

        api.MapGet("/estado/versao", (EstadoCompartilhado e) => Results.Ok(new { versao = e.Versao() }));

        api.MapPost("/estado/patch", async (HttpContext ctx, EstadoCompartilhado e) =>
        {
            var corpo = await JsonNode.ParseAsync(ctx.Request.Body);
            if (corpo?["patch"] is not JsonArray ops)
                return Results.BadRequest(new { erro = "Alteração inválida." });
            if (ops.Count > 5000)
                return Results.Json(new { erro = "Alteração grande demais." }, statusCode: StatusCodes.Status413PayloadTooLarge);
            var (dados, versao) = await e.GravarPatch(ops, ctx.Usuario().Login);
            return Results.Json(new JsonObject { ["versao"] = versao, ["dados"] = dados });
        });

        api.MapPost("/arquivos", async (HttpContext ctx, EstadoCompartilhado e) =>
        {
            if (!ctx.Request.HasFormContentType)
                return Results.BadRequest(new { erro = "Envie o arquivo." });
            var form = await ctx.Request.ReadFormAsync();
            var arquivo = form.Files["arquivo"];
            if (arquivo is null)
                return Results.BadRequest(new { erro = "Envie o arquivo." });
            try { return Results.Json(await e.SalvarArquivo(arquivo, ctx.Usuario().Login)); }
            catch (ArgumentException ex) { return Results.BadRequest(new { erro = ex.Message }); }
        }).DisableAntiforgery();

        api.MapGet("/arquivos/{fid}", (string fid, HttpContext ctx, EstadoCompartilhado e) =>
        {
            var a = e.Arquivo(fid);
            if (a is null) return Results.NotFound(new { erro = "Arquivo não encontrado." });
            e.Auditar(ctx.Usuario().Login, "abriu arquivo", new JsonObject { ["arquivo"] = a.Value.Nome, ["fid"] = fid });
            // O tipo vem da extensão (já validada no envio), nunca do que o navegador declarou.
            var tipo = Path.GetExtension(a.Value.Nome).ToLowerInvariant() switch
            {
                ".pdf" => "application/pdf",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".webp" => "image/webp",
                _ => "application/octet-stream",
            };
            return Results.File(a.Value.Caminho, tipo, a.Value.Nome);
        });

        // Compatibilidade com as telas do protótipo (a saída de verdade é /auth/sair).
        api.MapPost("/logout", async (HttpContext ctx) =>
        {
            await Microsoft.AspNetCore.Authentication.AuthenticationHttpContextExtensions.SignOutAsync(ctx,
                Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok(new { ok = true });
        });
    }
}
