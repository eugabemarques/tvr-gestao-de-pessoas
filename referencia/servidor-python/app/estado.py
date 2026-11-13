"""Estado compartilhado do programa e aplicação das alterações (patch) enviadas pelas telas.

Cada coleção é tratada registro a registro, então duas pessoas editando colaboradores
diferentes ao mesmo tempo não perdem nada. Na mesma ficha, vale a última gravação.
"""
import json
import time

from .banco import auditar, conectar, transacao

CHAVES = {
    "people": lambda x: str(x.get("id")),
    "boats": lambda x: str(x.get("id")),
    "courses": lambda x: f'{x.get("pid")}|{x.get("name")}',
    "hist": lambda x: f'{x.get("pid")}|{x.get("ini")}',
    "resolved": lambda x: str(x),
}
VAZIO = {"people": [], "boats": [], "courses": [], "hist": [], "resolved": [], "log": []}


def _num(v):
    # JavaScript escreve 7 e Python lê 7; garante a mesma chave para 7.0
    return int(v) if isinstance(v, float) and v.is_integer() else v


def chave(colecao, item):
    if isinstance(item, dict):
        item = {k: _num(v) for k, v in item.items()}
    return CHAVES[colecao](item)


def ler():
    c = conectar()
    try:
        r = c.execute("SELECT dados,versao FROM estado WHERE id=1").fetchone()
    finally:
        c.close()
    return (json.loads(r["dados"]) if r["dados"] else None), r["versao"]


def versao():
    return ler()[1]


def aplicar(estado, ops):
    for o in ops:
        col = o.get("c")
        if not isinstance(col, str) or col.startswith("_"):
            continue
        if o.get("w") or col not in CHAVES:
            estado[col] = o.get("v")
            continue
        lista = estado.setdefault(col, [])
        k, v = str(o.get("k")), o.get("v")
        i = next((n for n, x in enumerate(lista) if chave(col, x) == k), None)
        if v is None:
            if i is not None:
                lista.pop(i)
        elif i is not None:
            lista[i] = v
        else:
            lista.append(v)
    return estado


def resumo(ops):
    r = {}
    for o in ops:
        r.setdefault(o.get("c"), []).append(("removido " if o.get("v") is None else "") + str(o.get("k", "")))
    return r


def gravar_patch(ops, usuario):
    with transacao() as c:
        r = c.execute("SELECT dados,versao FROM estado WHERE id=1").fetchone()
        estado = json.loads(r["dados"]) if r["dados"] else json.loads(json.dumps(VAZIO))
        aplicar(estado, ops)
        nova = r["versao"] + 1
        c.execute("UPDATE estado SET dados=?,versao=?,atualizado_em=?,atualizado_por=? WHERE id=1",
                  (json.dumps(estado, ensure_ascii=False), nova, time.time(), usuario))
        auditar(c, usuario, "alterou dados", resumo(ops))
    return estado, nova
