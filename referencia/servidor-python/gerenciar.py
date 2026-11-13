"""Gerenciamento de usuários pelo terminal.

  python gerenciar.py criar-usuario gabriel "Gabriel" --admin
  python gerenciar.py senha gabriel
  python gerenciar.py desativar gabriel
  python gerenciar.py listar
"""
import argparse
import getpass
import sys
import time

from app.banco import auditar, conectar, iniciar, transacao
from app.seguranca import gerar_hash


def pedir_senha():
    s = getpass.getpass("Senha (mínimo 10 caracteres): ")
    if len(s) < 10:
        sys.exit("A senha precisa ter pelo menos 10 caracteres.")
    if getpass.getpass("Repita a senha: ") != s:
        sys.exit("As senhas não conferem.")
    return s


def main():
    iniciar()
    ap = argparse.ArgumentParser(description="Usuários do TOVERI")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("criar-usuario"); c.add_argument("login"); c.add_argument("nome"); c.add_argument("--admin", action="store_true")
    c.add_argument("--senha", help=argparse.SUPPRESS)
    s = sub.add_parser("senha"); s.add_argument("login")
    d = sub.add_parser("desativar"); d.add_argument("login")
    a = sub.add_parser("ativar"); a.add_argument("login")
    sub.add_parser("listar")
    x = ap.parse_args()
    login = getattr(x, "login", "").strip().lower()

    if x.cmd == "criar-usuario":
        senha = x.senha or pedir_senha()
        with transacao() as t:
            if t.execute("SELECT 1 FROM usuarios WHERE login=?", (login,)).fetchone():
                sys.exit(f"Já existe o usuário {login}.")
            t.execute("INSERT INTO usuarios(login,nome,senha,admin,criado_em) VALUES(?,?,?,?,?)",
                      (login, x.nome, gerar_hash(senha), int(x.admin), time.time()))
            auditar(t, "terminal", "criou usuário", {"login": login})
        print(f"Usuário {login} criado.")
    elif x.cmd == "senha":
        senha = pedir_senha()
        with transacao() as t:
            n = t.execute("UPDATE usuarios SET senha=? WHERE login=?", (gerar_hash(senha), login)).rowcount
            t.execute("DELETE FROM sessoes WHERE usuario_id=(SELECT id FROM usuarios WHERE login=?)", (login,))
            auditar(t, "terminal", "trocou senha", {"login": login})
        print("Senha alterada." if n else f"Usuário {login} não encontrado.")
    elif x.cmd in ("desativar", "ativar"):
        with transacao() as t:
            n = t.execute("UPDATE usuarios SET ativo=? WHERE login=?", (int(x.cmd == "ativar"), login)).rowcount
            if x.cmd == "desativar":
                t.execute("DELETE FROM sessoes WHERE usuario_id=(SELECT id FROM usuarios WHERE login=?)", (login,))
            auditar(t, "terminal", x.cmd, {"login": login})
        print("Feito." if n else f"Usuário {login} não encontrado.")
    else:
        c = conectar()
        for r in c.execute("SELECT login,nome,admin,ativo FROM usuarios ORDER BY login"):
            print(f'{r["login"]:<20} {r["nome"]:<30} {"admin" if r["admin"] else "":<6} {"ativo" if r["ativo"] else "desativado"}')


if __name__ == "__main__":
    main()
