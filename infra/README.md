# Infraestrutura

Tudo roda no locatário Microsoft 365 da **TOVERI**.

## Liberação no Microsoft 365 (`entra/`)

`entra/configurar-microsoft365.ps1` faz, de forma automática, a liberação do sistema no Entra ID e no SharePoint:

1. Registra a API e as telas (Web) no Entra ID, com os perfis **Admin RH** e **RH** (hoje com as mesmas permissões).
2. Cria os grupos `TOVERI - Admin RH` e `TOVERI - RH` e exige que a pessoa esteja num deles para entrar.
3. Concede à API a permissão `Sites.Selected` do Microsoft Graph, que sozinha não dá acesso a nenhum site.
4. Cria o site privado `TOVERI RH - Testes` e dá à API permissão de gravação só nele.

Precisa de um administrador do Microsoft 365. Rode num PowerShell normal do Windows:

```
powershell -ExecutionPolicy Bypass -File infra\entra\configurar-microsoft365.ps1 -Proprietario <e-mail de quem desenvolve> -AdminRH <e-mails> -RH <e-mails>
```

O script pode ser rodado de novo para incluir pessoas. No fim, ele grava `toveri-microsoft365.json` com os IDs que o sistema usa. Nenhum desses dados é senha.

## Produção atual

| Item | Valor |
|---|---|
| Endereço | https://toveri-gestao-pessoas.azurewebsites.net |
| App Service | `toveri-gestao-pessoas` (Linux, .NET 10), no plano B2 existente `asp-toveri-portal-prod`, grupo `rg-toveri-portal-prod`, Brazil South |
| Telas | React (`frontend/`), compiladas dentro da API (`wwwroot`) |
| Dados | SQLite em `/home/dados` (persistente) + arquivos em `/home/dados/arquivos` |
| Login | "Entrar com Microsoft", aplicativo do Entra **TOVERI Gestão de Pessoas - Site** (sem segredo), igual ao Portal de Projetos |

**App Settings** (não são senhas):

| Nome | Para quê |
|---|---|
| `Toveri__EntraClientId` | ID do aplicativo de login no Entra |
| `Toveri__EntraTenantId` | locatário da TOVERI |
| `Toveri__Acesso` | e-mails liberados, separados por `;` |
| `Toveri__Dados` | `/home/dados` |

Para liberar alguém, inclua o e-mail em `Toveri__Acesso` (Azure Portal > toveri-gestao-pessoas > Variáveis de ambiente). O app reinicia sozinho.

### Publicar

```
pwsh -File infra\publicar.ps1
```

Compila e testa telas e back end, gera o pacote e envia para o App Service. Requer Node.js, .NET SDK 10 e `az login`.
Não mexa nas configurações do app enquanto a publicação roda.

## Azure (definitivo, a fazer)

Recursos descritos em Bicep, na região Brazil South:

- Azure Static Web Apps (telas)
- Azure App Service (API .NET)
- Azure SQL Database (modo serverless)
- Key Vault e Application Insights

Os documentos dos colaboradores ficam no SharePoint da TOVERI, acessados pela API via Microsoft Graph.
