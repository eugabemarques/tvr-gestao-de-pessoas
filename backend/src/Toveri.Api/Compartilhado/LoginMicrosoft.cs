using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace Toveri.Api.Compartilhado;

/// <summary>
/// Login igual ao do Portal de Projetos: tela da TOVERI com "Entrar com Microsoft", só contas do locatário da
/// TOVERI, e o próprio sistema confere se o e-mail está na lista liberada (<c>Toveri:Acesso</c>, separada por ; ou ,).
///
/// Configuração (App Settings no Azure):
///   Toveri__EntraClientId  = ID do aplicativo "TOVERI Gestão de Pessoas - Site" no Entra
///   Toveri__EntraTenantId  = locatário da TOVERI
///   Toveri__Acesso         = e-mails liberados
/// Sem segredo: o Entra devolve só o id_token (form_post), validado pela assinatura.
/// </summary>
public static class LoginMicrosoft
{
    public const string TenantToveri = "874641cf-fce4-4923-b71f-a1d725541626";

    public static void AddLoginMicrosoft(this WebApplicationBuilder builder, string pastaDados)
    {
        var cfg = builder.Configuration;
        builder.Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(pastaDados, "chaves")))
            .SetApplicationName("toveri-gestao-pessoas");

        var auth = builder.Services.AddAuthentication(o =>
        {
            o.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            o.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
        }).AddCookie(o =>
        {
            o.Cookie.Name = "toveri_sessao";
            o.Cookie.HttpOnly = true;
            o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            o.Cookie.SameSite = SameSiteMode.Lax;
            o.ExpireTimeSpan = TimeSpan.FromHours(12);
            o.SlidingExpiration = true;
            o.LoginPath = "/entrar";
            o.Events.OnRedirectToLogin = c =>
            {
                if (c.Request.Path.StartsWithSegments("/api")) c.Response.StatusCode = 401;
                else c.Response.Redirect("/entrar");
                return Task.CompletedTask;
            };
        });

        var clientId = cfg["Toveri:EntraClientId"];
        if (string.IsNullOrWhiteSpace(clientId)) return;
        var tenant = cfg["Toveri:EntraTenantId"] ?? TenantToveri;
        auth.AddOpenIdConnect(o =>
        {
            o.Authority = $"https://login.microsoftonline.com/{tenant}/v2.0";
            o.ClientId = clientId;
            o.ResponseType = OpenIdConnectResponseType.IdToken;
            o.ResponseMode = OpenIdConnectResponseMode.FormPost;
            o.CallbackPath = "/auth/retorno";
            o.Scope.Clear();
            o.Scope.Add("openid");
            o.Scope.Add("profile");
            o.Scope.Add("email");
            o.SaveTokens = false;
            o.MapInboundClaims = false;
            o.TokenValidationParameters.ValidIssuer = $"https://login.microsoftonline.com/{tenant}/v2.0";
            o.TokenValidationParameters.NameClaimType = "name";
            o.Events.OnRemoteFailure = c =>
            {
                c.Response.Redirect("/entrar?erro=1");
                c.HandleResponse();
                return Task.CompletedTask;
            };
        });
    }

    public static bool LoginConfigurado(IConfiguration cfg) => !string.IsNullOrWhiteSpace(cfg["Toveri:EntraClientId"]);

    /// <summary>E-mail da conta Microsoft (convidados de fora, com #EXT#, não entram).</summary>
    public static string? Email(ClaimsPrincipal u)
    {
        foreach (var tipo in new[] { "preferred_username", "email", "upn" })
        {
            var v = u.FindFirst(tipo)?.Value?.Trim().ToLowerInvariant();
            if (!string.IsNullOrEmpty(v) && v.Contains('@') && !v.Contains("#ext#")) return v;
        }
        return null;
    }

    public static bool Liberado(IConfiguration cfg, string email)
    {
        var lista = (cfg["Toveri:Acesso"] ?? "")
            .Split([';', ',', ' ', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return lista.Any(x => string.Equals(x, email, StringComparison.OrdinalIgnoreCase));
    }

    public static void MapLoginMicrosoft(this WebApplication app)
    {
        var paginas = Path.Combine(app.Environment.ContentRootPath, "Paginas");
        app.MapGet("/logo-cor.png", () => Results.File(Path.Combine(paginas, "logo-cor.png"), "image/png"));
        app.MapGet("/logo-branca.png", () => Results.File(Path.Combine(paginas, "logo-branca.png"), "image/png"));

        app.MapGet("/entrar", (HttpContext ctx, IConfiguration cfg) =>
        {
            var erro = ctx.Request.Query.ContainsKey("erro")
                ? "<p class=\"erro\" role=\"alert\">Não foi possível entrar. Tente de novo.</p>" : "";
            var botao = LoginConfigurado(cfg)
                ? "<a class=\"ms\" href=\"/auth/login\">" + IconeMicrosoft + "Entrar com Microsoft</a>"
                : "<p class=\"erro\">O login Microsoft ainda não foi configurado neste servidor.</p>";
            return Pagina("Entrar", "Use sua conta Microsoft da TOVERI.", erro + botao);
        });

        app.MapGet("/auth/login", (IConfiguration cfg) => LoginConfigurado(cfg)
            ? Results.Challenge(new AuthenticationProperties { RedirectUri = "/" }, [OpenIdConnectDefaults.AuthenticationScheme])
            : Results.Redirect("/entrar"));

        app.MapGet("/auth/sair", async (HttpContext ctx) =>
        {
            await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Redirect("/entrar");
        });

        app.MapGet("/login", () => Results.Redirect("/entrar"));
    }

    public static IResult PaginaSemAcesso(string email) => Pagina("Acesso não liberado",
        "A conta " + WebUtility.HtmlEncode(email) + " ainda não tem acesso ao Gestão de Pessoas. Peça ao administrador.",
        "<a class=\"ms sec\" href=\"/auth/sair\">Sair e entrar com outra conta</a>", 403);

    private static IResult Pagina(string titulo, string sub, string corpo, int status = 200) => Results.Content($$$"""
        <!doctype html>
        <html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{{{titulo}}} · TOVERI - Gestão de Pessoas</title>
        <style>
        :root{--font:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,system-ui,sans-serif;--panel:#fff;--ink:#1d1d1f;--mute:#6e6e73;--line:rgba(60,60,67,.16);--brand:#154a78;--bad:#c62828;
        --wall:radial-gradient(1200px 800px at 8% 0%,#bcd6ff 0%,transparent 60%),radial-gradient(900px 700px at 100% 10%,#f6c9e4 0%,transparent 55%),radial-gradient(1000px 900px at 60% 100%,#b9ecdf 0%,transparent 60%),linear-gradient(160deg,#eef2fb,#f7eef6);color-scheme:light}
        @media (prefers-color-scheme:dark){:root{--panel:#1e2028;--ink:#f5f5f7;--mute:#a1a1a8;--line:rgba(235,235,245,.14);--brand:#fff;--bad:#ff6b6b;
        --wall:radial-gradient(1200px 800px at 8% 0%,#1d3566 0%,transparent 60%),radial-gradient(900px 700px at 100% 10%,#4a1f45 0%,transparent 55%),radial-gradient(1000px 900px at 60% 100%,#123f3a 0%,transparent 60%),linear-gradient(160deg,#0d0f15,#151019);color-scheme:dark}}
        *{box-sizing:border-box}html{min-height:100%;background:var(--wall);background-attachment:fixed}
        body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;font:15px/1.5 var(--font);color:var(--ink)}
        main{width:min(400px,100%);padding:36px 32px 30px;border-radius:26px;background:color-mix(in srgb,var(--panel) 72%,transparent);backdrop-filter:blur(28px) saturate(180%);border:1px solid var(--line);box-shadow:0 18px 50px rgba(20,30,60,.18);text-align:center}
        .logo{display:block;height:56px;margin:0 auto 14px}.lw{display:none}
        @media (prefers-color-scheme:dark){.lc{display:none}.lw{display:block}}
        h1{font-size:19px;font-weight:650;margin:0 0 4px;color:var(--brand)}
        p.sub{color:var(--mute);margin:0 0 24px;font-size:14px;overflow-wrap:anywhere}
        .ms{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;font:600 15px var(--font);color:#fff;background:#2f2f2f;border-radius:999px;padding:12px;text-decoration:none}
        .ms.sec{background:transparent;color:var(--ink);border:1px solid var(--line)}
        .ms svg{width:18px;height:18px}.ms:focus-visible{outline:3px solid #2b8cff;outline-offset:2px}
        .erro{color:var(--bad);font-weight:600;font-size:13px;margin:0 0 14px}
        </style></head><body><main>
        <img class="logo lc" src="/logo-cor.png" alt="TOVERI"><img class="logo lw" src="/logo-branca.png" alt="TOVERI">
        <h1>Gestão de Pessoas</h1><p class="sub">{{{sub}}}</p>{{{corpo}}}
        </main></body></html>
        """, "text/html; charset=utf-8", statusCode: status);

    private const string IconeMicrosoft =
        "<svg viewBox=\"0 0 21 21\" aria-hidden=\"true\"><rect x=\"1\" y=\"1\" width=\"9\" height=\"9\" fill=\"#f25022\"/><rect x=\"11\" y=\"1\" width=\"9\" height=\"9\" fill=\"#7fba00\"/><rect x=\"1\" y=\"11\" width=\"9\" height=\"9\" fill=\"#00a4ef\"/><rect x=\"11\" y=\"11\" width=\"9\" height=\"9\" fill=\"#ffb900\"/></svg>";
}
