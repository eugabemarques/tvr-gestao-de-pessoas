"""Arquivos dos colaboradores.

Cada arquivo enviado é guardado com um nome interno e, quando a ficha é salva, copiado para
dados/Colaboradores/<Nome do colaborador>/<Documento>.pdf

Para gravar no OneDrive/SharePoint da empresa, a função `publicar` é o ponto que será trocado
pela integração com o Microsoft Graph (etapa seguinte).
"""
import re
import secrets
import shutil
import time
from pathlib import Path

from .banco import conectar, transacao
from .config import ARQUIVOS, EXTENSOES, MAX_ARQUIVO, PASTAS


class ArquivoInvalido(Exception):
    pass


def limpa(nome: str) -> str:
    nome = (nome or "").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'")
    nome = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "-", nome)
    nome = re.sub(r"\s+", " ", nome).strip().strip(".")
    return nome[:80] or "arquivo"


def salvar_envio(arquivo, usuario):
    ext = Path(arquivo.filename or "").suffix.lower()
    if ext not in EXTENSOES:
        raise ArquivoInvalido("Tipo de arquivo não aceito. Envie PDF ou imagem.")
    fid = secrets.token_hex(12)
    destino = ARQUIVOS / fid
    tamanho = 0
    with open(destino, "wb") as f:
        while bloco := arquivo.file.read(1024 * 1024):
            tamanho += len(bloco)
            if tamanho > MAX_ARQUIVO:
                f.close()
                destino.unlink(missing_ok=True)
                raise ArquivoInvalido("O arquivo passa de 20 MB.")
            f.write(bloco)
    with transacao() as c:
        c.execute("INSERT INTO arquivos(id,nome,tamanho,tipo,criado_em,criado_por) VALUES(?,?,?,?,?,?)",
                  (fid, arquivo.filename, tamanho, arquivo.content_type, time.time(), usuario))
    return {"fid": fid, "name": arquivo.filename, "size": tamanho}


def caminho(fid: str):
    if not re.fullmatch(r"[0-9a-f]{24}", fid or ""):
        return None, None
    c = conectar()
    try:
        r = c.execute("SELECT nome,tipo FROM arquivos WHERE id=?", (fid,)).fetchone()
    finally:
        c.close()
    p = ARQUIVOS / fid
    return (p, dict(r)) if r and p.exists() else (None, None)


def nome_documento(doc):
    ext = Path(doc.get("name") or "").suffix.lower()
    campo = doc.get("campo")
    if campo:
        campo = re.sub(r"^Curso: ", "Curso - ", campo)
        campo = re.sub(r"^Vacina: ", "Vacina - ", campo)
        return limpa(campo) + ext
    return limpa(doc.get("name"))


def pasta_da_pessoa(c, pessoa):
    pid = str(pessoa.get("id"))
    r = c.execute("SELECT nome FROM pastas WHERE pessoa_id=?", (pid,)).fetchone()
    if r:
        return r["nome"]
    base = limpa(pessoa.get("name") or f"Colaborador {pid}")
    nome, n = base, 2
    while c.execute("SELECT 1 FROM pastas WHERE nome=?", (nome,)).fetchone():
        nome, n = f"{base} ({n})", n + 1
    c.execute("INSERT INTO pastas VALUES(?,?)", (pid, nome))
    return nome


def publicar(pessoas):
    """Copia os documentos de cada colaborador para a pasta dele. Nunca apaga nada."""
    with transacao() as c:
        for p in pessoas:
            docs = [d for d in (p.get("docs") or []) if isinstance(d, dict) and d.get("fid")]
            if not docs:
                continue
            pasta = PASTAS / pasta_da_pessoa(c, p)
            pasta.mkdir(parents=True, exist_ok=True)
            for d in docs:
                r = c.execute("SELECT destino FROM arquivos WHERE id=?", (d["fid"],)).fetchone()
                origem = ARQUIVOS / d["fid"]
                alvo = pasta / nome_documento(d)
                if not r or not origem.exists() or r["destino"] == str(alvo):
                    continue
                shutil.copy2(origem, alvo)
                c.execute("UPDATE arquivos SET destino=? WHERE id=?", (str(alvo), d["fid"]))
