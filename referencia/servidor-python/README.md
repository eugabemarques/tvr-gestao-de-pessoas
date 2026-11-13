# TOVERI - Gestão de Pessoas · Servidor

Servidor (API) do programa TOVERI. Ele guarda os dados num banco de dados, controla o login de cada usuário e organiza os documentos numa pasta por colaborador. As telas são as mesmas do protótipo.

## O que esta etapa entrega

- **Login próprio** com usuário e senha. As senhas são protegidas com scrypt, o acesso é bloqueado por 5 minutos após 5 tentativas erradas e a sessão dura 12 horas de uso.
- **Dados compartilhados**: todos os usuários veem as mesmas informações. As telas salvam cada alteração no servidor e buscam as dos colegas a cada 15 segundos. Duas pessoas editando colaboradores diferentes ao mesmo tempo não perdem nada; na mesma ficha, vale a última gravação.
- **Arquivos de até 20 MB** guardados no servidor, com download apenas para quem está logado.
- **Pasta por colaborador**: ao salvar a ficha, os documentos são copiados para `dados/Colaboradores/<Nome>/`, já com o nome do documento. Nada é apagado automaticamente.
- **Registro de auditoria** (LGPD): logins, tentativas recusadas, alterações e arquivos abertos, com usuário e horário.

## Testar no computador (Windows)

1. Instale o Python 3.11 ou mais novo em [python.org](https://www.python.org/downloads/) e marque a opção "Add Python to PATH".
2. Dê dois cliques em `iniciar.bat`. Na primeira vez, ele instala o necessário e pede o primeiro usuário administrador.
3. O navegador abre em `http://localhost:8080`.

Para testar com os dados de exemplo do protótipo, defina `TOVERI_DEMO=1` antes de iniciar com o banco vazio.

## Usuários

```
python gerenciar.py criar-usuario ana "Ana Lima"             # cria e pede a senha
python gerenciar.py criar-usuario gabriel "Gabriel" --admin
python gerenciar.py senha ana                                # troca a senha e encerra as sessões abertas
python gerenciar.py desativar ana                            # bloqueia o acesso sem apagar o histórico
python gerenciar.py listar
```

As senhas precisam ter pelo menos 10 caracteres.

## Onde ficam os dados

Tudo fica na pasta `dados/`, ou no caminho definido em `TOVERI_DADOS`:

- `toveri.db`: banco de dados (usuários, cadastros e auditoria);
- `arquivos/`: arquivos enviados, com nome interno;
- `Colaboradores/`: uma pasta legível por colaborador.

**Backup:** copie a pasta `dados/` inteira. Ela contém dados pessoais protegidos pela LGPD, então não a envie por e-mail nem a coloque no GitHub. O `.gitignore` já a exclui.

## Configuração

| Variável | Para quê |
|---|---|
| `TOVERI_DADOS` | Pasta onde ficam o banco e os arquivos (padrão: `./dados`) |
| `TOVERI_HTTPS=1` | Obrigatório em produção, com https: o cookie de login só trafega por conexão segura |
| `TOVERI_DEMO=1` | Um banco vazio começa com os dados de exemplo |

## Próximas etapas

1. **Hospedagem na nuvem** com https, para acesso de dentro e de fora do escritório.
2. **OneDrive/SharePoint da empresa**: trocar a cópia local feita em `app/armazenamento.py` (função `publicar`) pela gravação via Microsoft Graph, usando um aplicativo registrado pelo administrador do Microsoft 365.
3. Tela de administração de usuários dentro do programa.
4. Chat da equipe.

## Estrutura

```
app/main.py           rotas da API e páginas
app/estado.py         aplicação das alterações enviadas pelas telas
app/armazenamento.py  arquivos e pastas dos colaboradores
app/seguranca.py      senhas e sessões
app/banco.py          banco SQLite
gerenciar.py          usuários pelo terminal
iniciar.bat           inicia o servidor no Windows
static/               telas (index.html é o mesmo do protótipo e funciona nos dois modos)
```
