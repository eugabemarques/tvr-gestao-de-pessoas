# TOVERI - Gestão de Pessoas (protótipo)

Protótipo de um painel de RH para controlar a escala de embarque 42x42, as dobras e o vencimento de cursos dos colaboradores. É uma página única (`index.html`), sem servidor e sem instalação.

> **Atenção:** este é um protótipo de validação. Os dados ficam salvos apenas no navegador de quem usa e **não há login**. Use somente dados fictícios. Não coloque CPF, RG, passaporte ou documentos reais aqui.

## Como abrir

Baixe o `index.html` e abra no navegador (duplo clique). Não precisa instalar nada.

Os botões de download (documentos anexados e ficha do colaborador) só funcionam na versão publicada na plataforma onde o protótipo foi criado. Abrindo o arquivo direto no computador, eles avisam que o download não está disponível.

## O que o protótipo faz

**Painel**
- Resumo: embarcados hoje, de folga hoje, cursos vencidos e cursos que vencem em até 90 dias.
- Gráfico de cursos por situação (vencidos, vencem em até 90 dias, em dia). Clicar numa coluna expande a lista de cursos daquela situação.
- Ícone de sino com os avisos do sistema: cursos que vencem durante um embarque em curso ou previsto para os próximos 30 dias. Cada aviso pode ser marcado como **Resolvido** (e reaberto depois).

**Embarques**
- Registro de embarque: escolhe-se o colaborador, a data de embarque e os dias embarcados, e o sistema calcula a folga conquistada, o último dia a bordo e o próximo embarque.
- Tabela "Equipe hoje" com a situação de cada pessoa e o ponto em que está no ciclo.
- Botão **Dobra** para somar dias a um embarque em andamento.

**Colaboradores**
- Lista com busca, situação na escala e situação dos cursos.
- Cadastro com nome completo, RG, CPF, passaporte, nome da mãe, nome do pai (opcional), e-mail, celular, setor, contato de emergência e endereço.
- Botão de anexo em cada campo e um campo para outros documentos.
- "Pasta" do colaborador com os dados e os documentos anexados.
- Para o setor **Ambiental**, a escala (data de embarque e dias) é obrigatória e os campos só aparecem quando esse setor é escolhido.

## Regras assumidas

- Escala 42x42: 42 dias embarcado e 42 dias de folga.
- Folga de 1 dia para cada dia embarcado, inclusive nos dias de dobra.
- O dia do embarque conta como o dia 1.
- Depois de uma dobra, os ciclos seguintes voltam ao padrão de 42 dias.
- Os cursos vencem em 3 situações: vencido, vence em até 90 dias e em dia.

Essas regras precisam ser confirmadas com as regras reais da empresa.

## Limitações conhecidas

- Dados salvos só no navegador (cada pessoa vê apenas o que lançou), com limite de espaço. Anexos de até 1 MB cada.
- Sem login nem controle de acesso.
- Os cursos ainda são dados de exemplo: falta o cadastro de cursos por colaborador pela própria página.
- A "pasta" do colaborador é uma visão dentro do sistema, não uma pasta real em disco ou servidor.

## Próximos passos sugeridos

1. Cadastro de cursos por colaborador, com atualização de validade.
2. Importação das planilhas de Excel atuais.
3. Filtros por embarcação ou unidade e linha do tempo de embarques.
4. Sistema completo com servidor, banco de dados compartilhado, login e senha próprios, perfis de acesso e armazenamento seguro de documentos, com hospedagem aprovada pela TI e atenção à LGPD.
