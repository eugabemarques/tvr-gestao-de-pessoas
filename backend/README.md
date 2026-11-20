# Back end (.NET 10)

```
src/Toveri.Dominio          regras de negócio (escala, validades, avisos, pendências) e cadastros
src/Toveri.Infraestrutura   banco de dados (Entity Framework Core + Azure SQL) e dados iniciais
src/Toveri.Api              API (ASP.NET Core)
tests/Toveri.Testes         testes automáticos
```

As regras estão descritas em [`docs/regras-de-negocio.md`](../docs/regras-de-negocio.md).

## Comandos

Requer o .NET SDK 10. Nesta máquina ele está instalado só para o usuário, em `%LOCALAPPDATA%\Microsoft\dotnet\dotnet.exe`.

```
dotnet test Toveri.slnx                       # compila e roda os testes
dotnet run --project src/Toveri.Api           # sobe a API
```

Os testes também rodam no GitHub a cada envio (`.github/workflows/backend.yml`).

## Rotas disponíveis

| Rota | O que faz |
|---|---|
| `GET /api/saude` | Confere se a API está no ar |
| `POST /api/escala/simular` | Calcula translado, folga e próximo embarque, como a tela "Registrar embarque" |

Exemplo de `POST /api/escala/simular` (translado opcional: sem ele, ida no dia anterior e volta no último dia a bordo):

```json
{ "inicio": "2026-11-17", "diasEmbarcado": 42, "diasDobra": 0, "diasTransladoIda": 1, "diasTransladoVolta": 1 }
```

Responde com `inicioDoCiclo` (translado de ida), `ultimoDiaABordo`, `ultimoDiaTrabalhado` (com o translado de volta), `diasTranslado`, `diasTrabalhados`, folga e `proximoEmbarque`.

## Banco de dados

A conexão vem de `ConnectionStrings:Toveri`. Sem ela, a API sobe sem banco. Em produção, a senha não fica em arquivo: a API usa a identidade gerenciada do Azure.

## Próxima etapa

- Rotas de colaboradores, embarques, cursos e documentos gravando no Azure SQL, com auditoria (hoje as telas usam os dados compartilhados em SQLite, descritos abaixo).
- Migrações do banco e ambiente de desenvolvimento no Azure SQL.
- Perfis Admin RH e RH (hoje com as mesmas permissões) aplicados às rotas.

## Dados compartilhados e login (em produção)

Enquanto as rotas de cada cadastro não usam o banco definitivo, as telas gravam pelo mesmo protocolo do servidor de referência em Python (`Compartilhado/`):

| Rota | O que faz |
|---|---|
| `GET /api/me` | Usuário conectado |
| `GET /api/estado` · `GET /api/estado/versao` | Dados compartilhados e versão |
| `POST /api/estado/patch` | Grava alterações registro a registro (cabeçalho `X-Toveri: 1`) |
| `POST /api/arquivos` · `GET /api/arquivos/{id}` | Envia e baixa documentos (PDF ou imagem, até 20 MB) |

Tudo fica num SQLite em `Toveri:Dados` (no Azure, `/home/dados`), com auditoria de alterações e de arquivos abertos.

Login (`Compartilhado/LoginMicrosoft.cs`): tela `/entrar` com "Entrar com Microsoft" (Entra ID, só contas da TOVERI) e lista de e-mails liberados em `Toveri:Acesso`. Em desenvolvimento, sem `Toveri:EntraClientId`, entra como `Toveri:UsuarioDev`. Rode a API e, em outro terminal, `npm run dev` em `frontend/`.
