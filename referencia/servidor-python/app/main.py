"""Servidor do TOVERI - Gestão de Pessoas."""
import json

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel

from . import armazenamento, estado
from .banco import auditar, conectar, iniciar, transacao
from .config import DEMO, HTTPS, SESSAO_HORAS, STATIC
from .seguranca import LimiteTentativas, conferir, criar_sessao, encerrar_sessao, usuario_da_sessao

COOKIE = "toveri_sessao"
app = FastAPI(title="TOVERI - Gestão de Pessoas", docs_url=None, redoc_url=None, openapi_url=None)
limite = LimiteTentativas()
iniciar()


@app.middleware("http")
async def cabecalhos(request: Request, call_next):
    # Toda escrita precisa vir das próprias telas do programa (proteção contra CSRF).
    if request.method in ("POST", "PUT", "DELETE") and request.headers.get("x-toveri") != "1":
        return JSONResponse({"erro": "Requisição não permitida."}, status_code=403)
    r = await call_next(request)
    r.headers["X-Content-Type-Options"] = "nosniff"
    r.headers["Referrer-Policy"] = "same-origin"
    r.headers["X-Frame-Options"] = "DENY"
    return r


def usuario(request: Request):
    u = usuario_da_sessao(request.cookies.get(COOKIE))
    if not u:
        raise HTTPException(401, "Faça login para continuar.")
    return u


# ---------- páginas ----------
@app.get("/", response_class=HTMLResponse)
def inicio(request: Request):
    u = usuario_da_sessao(request.cookies.get(COOKIE))
    if not u:
        return RedirectResponse("/login", status_code=303)
    dados, versao = estado.ler()
    inicial = {"usuario": {"login": u["login"], "nome": u["nome"], "admin": bool(u["admin"])},
               "versao": versao, "dados": dados, "demo": DEMO}
    js = json.dumps(inicial, ensure_ascii=False).replace("</", "<\\/")
    html = (STATIC / "index.html").read_text(encoding="utf-8")
    html = html.replace("<script>/*TOVERI_SERVIDOR*/</script>", f"<script>window.__TOVERI__={js};</script>", 1)
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


@app.get("/login", response_class=HTMLResponse)
def pagina_login(request: Request):
    if usuario_da_sessao(request.cookies.get(COOKIE)):
        return RedirectResponse("/", status_code=303)
    return FileResponse(STATIC / "login.html", headers={"Cache-Control": "no-store"})


@app.get("/logo-{variante}.png")
def logo(variante: str):
    if variante not in ("cor", "branca"):
        raise HTTPException(404)
    return FileResponse(STATIC / f"logo-{variante}.png")


# ---------- login ----------
class Login(BaseModel):
    login: str
    senha: str


@app.post("/api/login")
def entrar(d: Login, response: Response, request: Request):
    chave = d.login.strip().lower()
    if limite.bloqueado(chave):
        raise HTTPException(429, "Muitas tentativas. Aguarde alguns minutos e tente de novo.")
    c = conectar()
    try:
        r = c.execute("SELECT id,senha,ativo FROM usuarios WHERE login=?", (chave,)).fetchone()
    finally:
        c.close()
    if not r or not r["ativo"] or not conferir(d.senha, r["senha"]):
        limite.falhou(chave)
        with transacao() as t:
            auditar(t, chave, "login recusado", {"ip": request.client.host if request.client else None})
        raise HTTPException(401, "Usuário ou senha incorretos.")
    limite.limpar(chave)
    token = criar_sessao(r["id"])
    response.set_cookie(COOKIE, token, httponly=True, secure=HTTPS, samesite="strict", max_age=SESSAO_HORAS * 3600)
    with transacao() as t:
        auditar(t, chave, "login", {"ip": request.client.host if request.client else None})
    return {"ok": True}


@app.post("/api/logout")
def sair(request: Request, response: Response):
    encerrar_sessao(request.cookies.get(COOKIE))
    response.delete_cookie(COOKIE)
    return {"ok": True}


@app.get("/api/me")
def eu(u=Depends(usuario)):
    return {"login": u["login"], "nome": u["nome"], "admin": bool(u["admin"])}


# ---------- dados ----------
@app.get("/api/estado")
def obter_estado(u=Depends(usuario)):
    dados, versao = estado.ler()
    return {"versao": versao, "dados": dados}


@app.get("/api/estado/versao")
def obter_versao(u=Depends(usuario)):
    return {"versao": estado.versao()}


class Patch(BaseModel):
    patch: list


@app.post("/api/estado/patch")
def alterar(d: Patch, u=Depends(usuario)):
    if len(d.patch) > 5000:
        raise HTTPException(413, "Alteração grande demais.")
    dados, versao = estado.gravar_patch(d.patch, u["login"])
    ids = {str(o.get("k")) for o in d.patch if o.get("c") == "people" and o.get("v") is not None}
    armazenamento.publicar([p for p in dados.get("people", []) if str(p.get("id")) in ids])
    return {"versao": versao, "dados": dados}


# ---------- arquivos ----------
@app.post("/api/arquivos")
def enviar(arquivo: UploadFile = File(...), u=Depends(usuario)):
    try:
        return armazenamento.salvar_envio(arquivo, u["login"])
    except armazenamento.ArquivoInvalido as e:
        raise HTTPException(400, str(e))


@app.get("/api/arquivos/{fid}")
def baixar(fid: str, u=Depends(usuario)):
    p, info = armazenamento.caminho(fid)
    if not p:
        raise HTTPException(404, "Arquivo não encontrado.")
    with transacao() as t:
        auditar(t, u["login"], "abriu arquivo", {"arquivo": info["nome"]})
    return FileResponse(p, media_type=info["tipo"] or "application/octet-stream", filename=info["nome"])
