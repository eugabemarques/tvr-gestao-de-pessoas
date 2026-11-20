# TOVERI - Gestão de Pessoas

Sistema de RH para controlar a escala de embarque, as dobras, o vencimento de cursos e ASO e os documentos dos colaboradores.

**Em produção:** https://toveri-gestao-pessoas.azurewebsites.net (login com a conta Microsoft da TOVERI; acesso só para e-mails liberados).

## Situação atual

| Parte | Situação |
|---|---|
| Telas | React + TypeScript, portadas do protótipo, servidas pela própria API |
| Back end | API em .NET 10 no Azure App Service (Brazil South) |
| Login | "Entrar com Microsoft" (Entra ID, só contas da TOVERI) + lista de e-mails liberados |
| Dados | Compartilhados entre todos os usuários (SQLite no App Service), com auditoria de alterações e de arquivos abertos |
| Documentos | Anexos de até 20 MB (PDF ou imagem), com cópia automática para a pasta do RH no SharePoint |
| Regras de escala | Escala 42x42 com translado de ida e de volta nas telas e no back end; compensação de folga e vigência só no back end, ainda não ligadas às telas (ver abaixo) |
| Testes | Back end (xUnit) e telas (Vitest); os do back end rodam no GitHub a cada envio |

## Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| `frontend/` | Telas em React, ligadas à API ([detalhes](frontend/README.md)) |
| `backend/` | API em .NET 10, regras de negócio e banco de dados ([detalhes](backend/README.md)) |
| `infra/` | Publicação no Azure e liberação no Microsoft 365 ([detalhes](infra/README.md)) |
| `docs/` | [Regras de negócio](docs/regras-de-negocio.md) |
| `index.html` | Protótipo original (página única, sem servidor), mantido como referência |
| `referencia/servidor-python/` | Primeiro servidor do protótipo, usado como especificação |

## O que o sistema faz

**Painel**
- Resumo: embarcados hoje, em translado hoje, de folga hoje e equipe embarcada (sempre visíveis), e cartões de pendência de cursos, ASO e Norueguês, que **só aparecem quando há alguma** (sem pendências, uma linha avisa que está tudo em dia).
- Gráfico de cursos por situação (vencidos, vencem em até 90 dias, em dia). Clicar numa coluna expande a lista de cursos daquela situação.
- Ícone de sino com os avisos:
  - **Cadastros incompletos**: colaboradores com informações faltando, com o que falta e o botão "Abrir ficha". Some sozinho quando o cadastro é completado.
  - Cursos que vencem durante um embarque em curso ou previsto para os próximos 30 dias. Cada aviso pode ser marcado como **Resolvido** (e reaberto depois).

**Embarques**
- Registro de embarque: escolhe-se o colaborador, a data de embarque e os dias embarcados, e o sistema calcula a folga conquistada, o último dia a bordo e o próximo embarque.
- Tabela "Equipe hoje" com a situação de cada pessoa e o ponto em que está no ciclo.
- Botão **Dobra** para somar dias a um embarque em andamento.
- Histórico por colaborador e período, com exportação para Excel e PDF.

**Barcos**
- Cadastro de barcos (nome, tipo e observações).
- Para cada barco: quem está a bordo hoje, próximos embarques em 30 dias e quem está de férias.

**Cursos e exames**
- Gráficos por situação de validade. Os exames (**ASO** e **Norueguês / OEUK / ENG1**) têm quadro próprio, com faixas de 60 e 90 dias e os dias para vencer de cada pessoa; o Painel tem cartões de vencidos e a vencer para cada um.
- Cadastro de curso ou exame com validade e certificado anexado. No **Norueguês**, informa-se a data do exame e a validade é calculada sozinha (2 anos depois), podendo ser ajustada.

**Colaboradores**
- Lista com busca, situação (embarcado, folga ou férias), situação dos cursos e documentos pendentes.
- Ficha dividida em seções: Dados pessoais, Cursos, Embarques, Vacinas e Docs Toveri. Pode ser salva incompleta (só o nome é obrigatório).
- Vacinas: data de cada uma das três vacinas e **um único anexo** com os três comprovantes (fichas antigas com três arquivos separados continuam valendo).
- Docs Toveri: só anexos (sem campos) das fichas internas: Dados Pessoais, Contato de Emergência, Dados Bancários, Autodeclaração de Raça e Política de Drogas e Álcool. Por ora não contam como pendência obrigatória.
- **Pasta do colaborador:** todos os dados, documentos obrigatórios e anexos, com três downloads:
  - **Dossiê (PDF):** a ficha seguida de todos os documentos anexados num único arquivo, com índice das páginas. PDFs entram inteiros; imagens entram numa página A4 com o nome do documento (na orientação certa); um anexo que não abre vira uma página de aviso.
  - **Só a ficha (PDF):** logo da TOVERI, dados pessoais, cursos e exames com validade e vacinas (as listas de documentos ficam só no dossiê).
  - **Ficha (.txt).**
- **Leitura de documentos:** ao anexar RG/CNH, PIS, título de eleitor, passaporte, comprovante de residência ou certificado de curso/ASO, o sistema lê o arquivo **no próprio navegador** (nada é enviado para fora, sem custo) e preenche os campos vazios: CPF, RG, PIS, título, passaporte, CEP e validade do curso. Os campos preenchidos ficam marcados "Lido do documento, confira" até serem conferidos. Nomes e endereço não são lidos.
- Clipe de anexo ao lado de cada campo. Os documentos obrigatórios do setor ficam marcados nos próprios campos, com contador de pendências em cada seção.
- Para o setor **Ambiental**, a escala (barco, data de embarque e dias) e os cursos CBSP, THUET/BOSIET/FOET e Norueguês/OEUK/ENG1 aparecem como pendências. O Certificado PAM é opcional.

**SharePoint**
- A ficha (`Cadastro.txt`) e os anexos de cada colaborador são copiados para `RH - Administrativo/API - Gestão de Pessoas/<Nome>`.
- A cópia usa a identidade gerenciada do Azure com permissão só nesse site (sem senha guardada), tenta de novo a cada minuto se falhar e nunca apaga nada no SharePoint.

## Regras de escala

Detalhes em [docs/regras-de-negocio.md](docs/regras-de-negocio.md).

**Em uso nas telas:**
- Escala 42x42 com **translado**: cada ciclo é translado de ida → 42 dias a bordo → translado de volta → 42 dias de folga. O dia do embarque conta como dia 1 a bordo.
- **Translado de ida**: por padrão, o dia anterior ao embarque. **Translado de volta**: por padrão, no próprio último dia a bordo; se for no dia seguinte, o RH ajusta a data. O translado conta como **dia trabalhado** e **não gera folga**.
- Folga de 1 dia para cada dia a bordo, inclusive nos dias de dobra; começa no dia seguinte ao translado de volta. Depois de uma dobra, os ciclos seguintes voltam ao padrão.
- Próximo ciclo: translado de ida no dia seguinte ao fim da folga e embarque no outro dia (ciclo padrão de 85 dias: 1 + 42 + 42).
- Embarques antigos, sem translado gravado, usam o padrão.

**Já implementadas no back end, ainda não ligadas às telas** (respostas do RH):
- Folga não gozada vira saldo compensado depois (a compensação adia o próximo embarque).
- Quem ainda não tem embarque previsto aparece como **Aguardando**.
- ASO obrigatório para todos a partir da admissão.
- Regras com data de início de vigência, para mudanças não alterarem o histórico.

## Acesso

Perfis **Admin RH** e **RH**, hoje com as mesmas permissões. Para liberar alguém, veja [infra/README.md](infra/README.md).

## Publicar

```
pwsh -File infra\publicar.ps1
```

Compila e testa telas e back end e envia para o App Service. Requer Node.js, .NET SDK 10 e `az login` no locatário da TOVERI. Detalhes em [infra/README.md](infra/README.md).

## Próximos passos

- **Banco de dados:** trocar o SQLite atual pelo Azure SQL Database (o modelo com Entity Framework já está no back end).
- **Regras do RH nas telas:** usar as regras do back end (compensação, Aguardando, ASO após admissão) e permitir que o RH as ajuste, com data de início de vigência. O translado já está no calculador do back end, com o mesmo resultado das telas.
- **Infraestrutura como código:** recursos do Azure descritos em Bicep, com Key Vault e Application Insights.
- **Avisos de vencimento por e-mail:** tarefa diária no Azure Functions.
- **LGPD:** ASO e vacinação tratados como dados sensíveis.

## Protótipo e servidor de referência

O `index.html` na raiz é o protótipo original: abre direto no navegador, sem login, e guarda os dados só no navegador de quem usa. Use somente dados fictícios nele.

A pasta `referencia/servidor-python/` guarda o primeiro servidor do protótipo (Python, FastAPI e SQLite). Ele serve de especificação para a versão em .NET e **não é publicado no Azure**.
