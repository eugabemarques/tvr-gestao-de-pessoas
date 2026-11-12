# TOVERI - Gestão de Pessoas

Protótipo web do software de RH da TOVERI, para controle de colaboradores, escalas de embarque e validade de cursos e ASOs.

## Como abrir

Basta abrir o arquivo `index.html` em qualquer navegador. Não precisa instalar nada.

Para publicar online pelo GitHub Pages: em **Settings → Pages**, escolha a branch `main` e a pasta raiz (`/`).

## O que o protótipo faz

- **Painel:** cards de embarcados hoje, de folga hoje, equipe embarcada, cursos vencidos ou a vencer (60 e 90 dias) e ASOs vencidos ou a vencer. Ao clicar num card, a listagem aparece abaixo.
- **Colaboradores:** cadastro em pop-up com documentos obrigatórios por setor (Administrativo, Ambiental e Manutenção Offshore), escala 42x42 obrigatória apenas no setor Ambiental, anexos por documento e pasta individual com download da ficha.
- **Cursos:** gráficos de cursos e de ASO por situação (vencidos, a vencer e em dia). Permite editar a validade anexando o documento novo, que é salvo na pasta do colaborador, e abrir a ficha a partir do curso.
- **Embarques:** registro de embarque com cálculo automático da folga (1 dia de folga por dia embarcado), "Equipe hoje" com botão de dobra, histórico e exportação em Excel e PDF.
- **Avisos do sistema:** sino com cursos que vencem durante um embarque, com botões "Resolvido" e "Reabrir".
- **Folha de Ponto:** a desenvolver.

## Limitações do protótipo

- Os dados ficam salvos apenas no navegador de quem está usando (localStorage). Não há compartilhamento entre usuários.
- Os anexos também ficam no navegador, que tem limite de alguns MB.
- Ainda não há login nem servidor. Essas etapas virão depois.
- A exportação em Excel e PDF usa bibliotecas carregadas da internet (SheetJS e jsPDF), então precisa de conexão.

Use apenas dados fictícios nos testes.
