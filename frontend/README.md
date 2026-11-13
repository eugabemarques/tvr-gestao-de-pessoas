# Front end (React + TypeScript)

Telas do TOVERI - Gestão de Pessoas, portadas do protótipo (`index.html` na raiz) para React + TypeScript + Vite. Visual, textos e regras são os do protótipo; o app roda sempre no "modo servidor".

Requer o Node.js (pode ser instalado só na pasta do usuário, sem permissão de administrador).

## Comandos

```
npm ci          # instala as dependências
npm run dev     # servidor de desenvolvimento; /api, /entrar e /auth vão para http://localhost:5099 (back end .NET)
npm run build   # confere os tipos e gera os arquivos estáticos em dist/
npm test        # testes (Vitest) das regras em src/dominio e da sincronização
```

## Estrutura

- `src/dominio/` regras puras, sem React: escala e ciclos (`escala.ts`), validades, avisos e painel (`validade.ts`), documentos obrigatórios e ficha (`documentos.ts`), cadastros (`cadastros.ts`), exportações (`exportacao.ts`) e patch (`patch.ts`). Os testes comparam com as fórmulas copiadas do protótipo (`__testes__/prototipo.ts`).
- `src/servidor/` chamadas à API e sincronização do estado.
- `src/telas/`, `src/dialogos/`, `src/componentes/` telas em React. `src/estilos.css` é o CSS do protótipo.

## Protocolo com o servidor

- `GET /api/me` → `{login, nome, admin}`. Resposta 403 mostra "Seu acesso ainda não foi liberado. Peça ao administrador.".
- `GET /api/estado` → `{versao, dados}`. Com `dados` nulo (banco vazio) começa vazio, sem dados de exemplo.
- `GET /api/estado/versao` → `{versao}`, conferido a cada 15 s (não confere com diálogo aberto, aba oculta ou envio pendente).
- `POST /api/estado/patch` com `{patch: ops}` → `{versao, dados}`. As operações vêm de `diffEstado` (chaves `people:id`, `boats:id`, `courses:pid|name`, `hist:pid|ini`, `resolved:valor`; o resto é trocado inteiro com `w:1`). Envio 250 ms após a alteração, nova tentativa com espera crescente e aviso "Salvando…" / "Sem conexão…".
- `POST /api/arquivos` (multipart, campo `arquivo`, até 20 MB, pdf/png/jpg/jpeg/webp) → `{fid, name, size}`; `GET /api/arquivos/{fid}` baixa.
- Toda requisição envia `X-Toveri: 1` e `credentials: "same-origin"`.
- 401 → `/entrar` (login Microsoft feito pelo back end). "Sair" envia o que falta e vai para `/auth/sair`.
