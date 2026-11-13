"""Banco de dados SQLite. Em produção pode ser trocado por PostgreSQL."""
import json
import sqlite3
import threading
import time
from contextlib import contextmanager

from .config import BANCO

_trava = threading.Lock()

ESQUEMA = """
CREATE TABLE IF NOT EXISTS usuarios(
  id INTEGER PRIMARY KEY, login TEXT UNIQUE NOT NULL, nome TEXT NOT NULL,
  senha TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1,
  criado_em REAL NOT NULL);
CREATE TABLE IF NOT EXISTS sessoes(
  token TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL, expira_em REAL NOT NULL);
CREATE TABLE IF NOT EXISTS estado(
  id INTEGER PRIMARY KEY CHECK(id=1), dados TEXT, versao INTEGER NOT NULL,
  atualizado_em REAL, atualizado_por TEXT);
CREATE TABLE IF NOT EXISTS arquivos(
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, tamanho INTEGER NOT NULL, tipo TEXT,
  criado_em REAL NOT NULL, criado_por TEXT, destino TEXT);
CREATE TABLE IF NOT EXISTS pastas(
  pessoa_id TEXT PRIMARY KEY, nome TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS auditoria(
  id INTEGER PRIMARY KEY, quando REAL NOT NULL, usuario TEXT, acao TEXT NOT NULL, detalhe TEXT);
INSERT OR IGNORE INTO estado(id,dados,versao) VALUES(1,NULL,0);
"""


def conectar():
    c = sqlite3.connect(BANCO, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA foreign_keys=ON")
    return c


@contextmanager
def transacao():
    """Uma escrita por vez: evita que dois salvamentos simultâneos se atropelem."""
    with _trava:
        c = conectar()
        try:
            yield c
            c.commit()
        except Exception:
            c.rollback()
            raise
        finally:
            c.close()


def iniciar():
    with transacao() as c:
        c.executescript(ESQUEMA)


def auditar(c, usuario, acao, detalhe=None):
    c.execute("INSERT INTO auditoria(quando,usuario,acao,detalhe) VALUES(?,?,?,?)",
              (time.time(), usuario, acao, json.dumps(detalhe, ensure_ascii=False) if detalhe is not None else None))
