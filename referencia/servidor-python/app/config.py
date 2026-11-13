"""Configurações do servidor, lidas de variáveis de ambiente."""
import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DADOS = Path(os.environ.get("TOVERI_DADOS", RAIZ / "dados")).resolve()
BANCO = DADOS / "toveri.db"
ARQUIVOS = DADOS / "arquivos"          # arquivos enviados (nome interno)
PASTAS = DADOS / "Colaboradores"       # uma pasta por colaborador, com nomes legíveis
STATIC = RAIZ / "static"

# Em produção (https), defina TOVERI_HTTPS=1 para o cookie de sessão só trafegar por conexão segura.
HTTPS = os.environ.get("TOVERI_HTTPS") == "1"
# Com TOVERI_DEMO=1, um banco vazio começa com os dados de exemplo do protótipo.
DEMO = os.environ.get("TOVERI_DEMO") == "1"

SESSAO_HORAS = 12
MAX_ARQUIVO = 20 * 1024 * 1024
EXTENSOES = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}

for d in (DADOS, ARQUIVOS, PASTAS):
    d.mkdir(parents=True, exist_ok=True)
