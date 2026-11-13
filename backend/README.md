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
| `POST /api/escala/simular` | Calcula folga e próximo embarque, como a tela "Registrar embarque" |

Exemplo de `POST /api/escala/simular`:

```json
{ "inicio": "2026-01-01", "diasEmbarcado": 42, "diasDobra": 7 }
```

## Banco de dados

A conexão vem de `ConnectionStrings:Toveri`. Sem ela, a API sobe sem banco. Em produção, a senha não fica em arquivo: a API usa a identidade gerenciada do Azure.

## Próxima etapa

- Login com Microsoft Entra ID e perfis de acesso (Admin RH, RH, Gestor).
- Rotas de colaboradores, embarques, cursos e documentos, com auditoria.
- Gravação de documentos no SharePoint via Microsoft Graph.
- Migrações do banco e ambiente de desenvolvimento no Azure SQL.
