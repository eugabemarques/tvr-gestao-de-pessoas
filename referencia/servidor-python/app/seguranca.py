"""Senhas (scrypt) e sessões."""
import hashlib
import hmac
import secrets
import time

from .banco import conectar, transacao
from .config import SESSAO_HORAS

N, R, P = 2**14, 8, 1


def gerar_hash(senha: str) -> str:
    sal = secrets.token_bytes(16)
    h = hashlib.scrypt(senha.encode(), salt=sal, n=N, r=R, p=P, dklen=32)
    return f"scrypt${N}${R}${P}${sal.hex()}${h.hex()}"


def conferir(senha: str, guardado: str) -> bool:
    try:
        _, n, r, p, sal, h = guardado.split("$")
        novo = hashlib.scrypt(senha.encode(), salt=bytes.fromhex(sal), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(novo.hex(), h)
    except Exception:
        return False


def _h(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def criar_sessao(usuario_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with transacao() as c:
        c.execute("DELETE FROM sessoes WHERE expira_em<?", (time.time(),))
        c.execute("INSERT INTO sessoes VALUES(?,?,?)", (_h(token), usuario_id, time.time() + SESSAO_HORAS * 3600))
    return token


def usuario_da_sessao(token: str | None):
    if not token:
        return None
    c = conectar()
    try:
        row = c.execute(
            "SELECT u.id,u.login,u.nome,u.admin FROM sessoes s JOIN usuarios u ON u.id=s.usuario_id "
            "WHERE s.token=? AND s.expira_em>? AND u.ativo=1", (_h(token), time.time())).fetchone()
    finally:
        c.close()
    if row:
        with transacao() as c:  # sessão deslizante: renova enquanto a pessoa usa
            c.execute("UPDATE sessoes SET expira_em=? WHERE token=?", (time.time() + SESSAO_HORAS * 3600, _h(token)))
        return dict(row)
    return None


def encerrar_sessao(token: str | None):
    if token:
        with transacao() as c:
            c.execute("DELETE FROM sessoes WHERE token=?", (_h(token),))


class LimiteTentativas:
    """Bloqueia por alguns minutos após várias senhas erradas para o mesmo login."""

    def __init__(self, maximo=5, minutos=5):
        self.maximo, self.janela, self.reg = maximo, minutos * 60, {}

    def bloqueado(self, chave):
        n, t = self.reg.get(chave, (0, 0))
        if n >= self.maximo and time.time() - t < self.janela:
            return True
        if time.time() - t >= self.janela:
            self.reg.pop(chave, None)
        return False

    def falhou(self, chave):
        n, _ = self.reg.get(chave, (0, 0))
        self.reg[chave] = (n + 1, time.time())

    def limpar(self, chave):
        self.reg.pop(chave, None)
