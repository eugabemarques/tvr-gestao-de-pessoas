# TOVERI - Gestão de Pessoas (protótipo)

Protótipo de um painel de RH para controlar a escala de embarque 42x42, as dobras e o vencimento de cursos dos colaboradores. É uma página única (`index.html`), sem servidor e sem instalação.

> **Atenção:** este é um protótipo de validação. Os dados ficam salvos apenas no navegador de quem usa e **não há login**. Use somente dados fictícios. Não coloque CPF, RG, passaporte ou documentos reais aqui.

## Como abrir

Baixe o `index.html` e abra no navegador (duplo clique). Não precisa instalar nada.

Os downloads (documentos anexados, ficha do colaborador, Excel e PDF) funcionam tanto na versão publicada quanto abrindo o arquivo direto no navegador.

A opção **Pasta no computador** (salvar a pasta de cada colaborador numa pasta local, por exemplo no OneDrive) só funciona no Chrome ou no Edge, abrindo o `index.html` direto no computador.

## O que o protótipo faz

**Painel**
- Resumo: embarcados hoje, de folga hoje, cursos vencidos e cursos que vencem em até 90 dias.
- Gráfico de cursos por situação (vencidos, vencem em até 90 dias, em dia). Clicar numa coluna expande a lista de cursos daquela situação.
- Ícone de sino com os avisos do sistema: cursos que vencem durante um embarque em curso ou previsto para os próximos 30 dias. Cada aviso pode ser marcado como **Resolvido** (e reaberto depois).

**Embarques**
- Registro de embarque: escolhe-se o colaborador, a data de embarque e os dias embarcados, e o sistema calcula a folga conquistada, o último dia a bordo e o próximo embarque.
- Tabela "Equipe hoje" com a situação de cada pessoa e o ponto em que está no ciclo.
- Botão **Dobra** para somar dias a um embarque em andamento.
- Histórico por colaborador e período, com exportação para Excel e PDF.

**Barcos**
- Cadastro de barcos (nome, tipo e observações).
- Para cada barco: quem está a bordo hoje, próximos embarques em 30 dias e quem está de férias.

**Cursos e ASO**
- Gráficos por situação de validade. Os ASOs têm faixas de 60 e 90 dias.
- Cadastro de curso ou ASO com validade e certificado anexado.

**Colaboradores**
- Lista com busca, situação (embarcado, folga ou férias), situação dos cursos e documentos pendentes.
- Ficha dividida em seções: Dados pessoais, Cursos, Embarques e Vacinas.
- Clipe de anexo ao lado de cada campo. Os documentos obrigatórios do setor ficam marcados nos próprios campos, com contador de pendências em cada seção.
- Na seção Embarques: barco, escala, férias e a lista de todos os embarques do colaborador.
- Na seção Vacinas: Covid-19, DT e febre amarela, com data e comprovante.
- "Pasta" do colaborador com os dados e os documentos anexados.
- Para o setor **Ambiental**, a escala (barco, data de embarque e dias) é obrigatória e os cursos obrigatórios do setor aparecem automaticamente.

**Aparência**
- Tema claro e escuro automático e controle de transparência das janelas.

## Regras assumidas

- Escala 42x42: 42 dias embarcado e 42 dias de folga.
- Folga de 1 dia para cada dia embarcado, inclusive nos dias de dobra.
- O dia do embarque conta como o dia 1.
- Depois de uma dobra, os ciclos seguintes voltam ao padrão de 42 dias.
- Os cursos vencem em 3 situações: vencido, vence em até 90 dias e em dia.

Essas regras precisam ser confirmadas com as regras reais da empresa.

## Limitações conhecidas

- Dados salvos só no navegador (cada pessoa vê apenas o que lançou). Anexos de até 20 MB cada, guardados no armazenamento do navegador.
- Sem login nem controle de acesso.
- Cursos, setores e documentos obrigatórios estão fixos no código.
- Remover um colaborador apaga também os cursos dele, sem histórico.

## Próximos passos

Sistema definitivo hospedado no Azure (região Brazil South):

- **Front end:** React com TypeScript no Azure Static Web Apps.
- **Back end:** API em .NET no Azure App Service.
- **Banco de dados:** Azure SQL Database.
- **Documentos:** SharePoint da empresa via Microsoft Graph, com uma pasta por colaborador (exige um aplicativo registrado pelo administrador do Microsoft 365).
- **Login:** Microsoft Entra ID (contas Microsoft 365 da empresa), com perfis de acesso.
- **Avisos de vencimento por e-mail:** tarefa diária no Azure Functions.
- **LGPD:** trilha de auditoria; ASO e vacinação tratados como dados sensíveis.

Regras de escala configuráveis pelo RH, com data de início de vigência para não alterar o histórico.

## Servidor de referência

A pasta `referencia/servidor-python/` guarda o primeiro servidor do protótipo (Python, FastAPI e SQLite), com login próprio, dados compartilhados, arquivos e auditoria. Ele serve de especificação para a versão em .NET e **não será publicado no Azure**. Instruções de uso estão no README da própria pasta.
