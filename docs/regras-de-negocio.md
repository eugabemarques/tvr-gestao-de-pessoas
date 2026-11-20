# Regras de negócio

Regras implementadas em `backend/src/Toveri.Dominio` e conferidas pelos testes em `backend/tests/Toveri.Testes`.

## Escala de embarque

A escala de cada setor é um cadastro (hoje só existe a **42x42**, usada pelo Ambiental). Cada escala tem **versões com data de início de vigência**:

| Campo | 42x42 hoje | Para que serve |
|---|---|---|
| Vigente desde | 01/01/2020 | Vale para embarques que começam nessa data ou depois |
| Dias embarcado | 42 | Duração de um embarque padrão |
| Dias de folga | 42 | Folga de um embarque padrão |
| Folga por dia de dobra | 1 | Dias de folga gerados por cada dia de dobra |
| Dias de translado de ida | 1 | Padrão de dias de viagem antes do embarque (trabalhados, sem folga) |
| Dias de translado de volta | 0 | Padrão de dias de viagem depois do último dia a bordo (0 = volta no último dia a bordo) |

**Para mudar a regra**, o RH cria uma versão nova com a data em que ela passa a valer. Embarques que começaram antes continuam calculados pela versão antiga, então o histórico não muda.

### Translado (nas telas e no back end desde 20/11/2026)

Cada ciclo do setor Ambiental tem quatro etapas: **translado de ida → a bordo → translado de volta → folga**.

| Etapa | Padrão | Conta como | Gera folga? |
|---|---|---|---|
| Translado de ida | dia anterior ao embarque (o RH pode informar outra data) | dia trabalhado | não |
| A bordo | dias da escala + dobra, a partir do embarque (dia 1) | dia trabalhado | sim, 1 por dia |
| Translado de volta | no próprio último dia a bordo (sem dia extra); se for no dia seguinte, o RH informa a data | dia trabalhado | não |
| Folga | começa no dia seguinte ao translado de volta | folga | — |

- Próximo ciclo previsto: translado de ida no dia seguinte ao fim da folga, embarque no outro dia. Com o padrão, o ciclo 42x42 dura **85 dias** (1 + 42 + 42).
- Exemplo: translado 16/11, embarque 17/11, último dia a bordo 28/12 (volta no mesmo dia), folga de 29/12 a 08/02, próximo translado 09/02 e embarque 10/02.
- Dias trabalhados = dias a bordo + dias de translado. O histórico e as exportações mostram as duas contagens.
- Embarques já registrados antes da mudança foram recalculados com o padrão (translado de ida no dia anterior, volta no último dia a bordo).
- Ficam gravados como dias: translado de ida (antes do embarque) e de volta (depois do último dia a bordo); assim a dobra não desloca as datas por engano. Nas telas, `ti`/`tv`; no back end, `Embarque.DiasTransladoIda`/`DiasTransladoVolta`.
- **O padrão faz parte da versão da regra** (`DiasTransladoIda` = 1, `DiasTransladoVolta` = 0, de 0 a 10 dias). Embarque sem translado informado usa o padrão da versão vigente; mudar o padrão com uma versão nova não altera o histórico.
- Convocação antecipada: o translado de ida do ciclo seguinte também é dia trabalhado, então entra nos dias de folga **não gozados**. Ex.: folga até 25/03, translado em 15/03 e embarque em 16/03 → 11 dias não gozados.
- O translado de ida de um embarque registrado não pode cair sobre os dias trabalhados do anterior (a bordo ou translado de volta): o cálculo é recusado.
- Compensação de folga começa no dia em que o próximo ciclo começaria, ou seja, no **translado de ida** previsto (ou num dia "Aguardando"), e não pode cobrir o translado nem o embarque de um ciclo registrado.

### Cálculo

- O dia do embarque conta como o dia 1 a bordo.
- Folga = dias embarcados × (dias de folga ÷ dias embarcado) + dias de dobra × folga por dia de dobra, arredondada para o dia mais próximo. Na 42x42, um dia de folga para cada dia a bordo, inclusive na dobra.
- Próximo embarque = dia seguinte ao último dia de folga.
- Depois do último embarque registrado, os ciclos **previstos** seguem a escala padrão, sem dobra.

### Casos especiais

| Situação | Comportamento |
|---|---|
| Embarque registrado começa **durante a folga** do anterior (convocação antecipada) | A folga que sobrou vira **folga não gozada** e entra no saldo a compensar |
| Embarque registrado começa **antes do fim** do embarque anterior | Recusado: os dados estão inconsistentes |
| Embarque registrado começa **depois** do previsto | Os dias entre o fim da folga e o novo embarque aparecem como **Aguardando** |

### Folga não gozada e compensação

A folga não gozada é compensada mais à frente, conforme o cronograma do projeto e a disponibilidade. O RH registra a compensação com a data de início e a quantidade de dias:

- **Saldo** = folga não gozada acumulada − dias já compensados. Não é possível compensar mais do que o saldo.
- A compensação **começa no dia em que o colaborador embarcaria** (embarque previsto ou período "Aguardando") e **adia o próximo embarque** pelo número de dias compensados.
- Não pode começar no meio de um embarque ou de uma folga, nem cobrir um embarque já registrado.
- Durante a compensação, o colaborador aparece como **Folga compensatória**.

### Situações possíveis na escala

| Situação | Quando |
|---|---|
| Sem escala | Nenhum embarque registrado |
| Aguardando primeiro embarque | O primeiro ciclo (translado de ida) ainda não começou |
| Translado de ida | Viajando para o embarque (dia trabalhado, sem folga) |
| Embarcado | A bordo, incluindo dias de dobra |
| Translado de volta | Voltando do embarque depois do último dia a bordo (dia trabalhado, sem folga) |
| Folga | Folga do embarque |
| Folga compensatória | Compensando folga não gozada |
| Aguardando | Folga terminou e o próximo embarque registrado começa depois do previsto |

## Validade de cursos e ASO

A data de validade é o último dia válido.

| Faixa | Regra padrão |
|---|---|
| Vencido | Validade antes de hoje |
| Urgente | Vence em até 60 dias |
| Atenção | Vence em até 90 dias |
| Em dia | Mais de 90 dias |

Os prazos de 60 e 90 dias são configuráveis.

## Avisos de embarque

Aparecem para quem está embarcado, ou tem embarque começando em até 30 dias (configurável). Entram os cursos e ASO que vencem até o último dia a bordo desse embarque:

- **Crítico:** já vencido, ou vence antes de o colaborador embarcar.
- **Atenção:** vence durante o embarque.

## Documentos e cursos obrigatórios

Cadastros por setor, carregados com as regras do protótipo:

- **Todos os setores:** RG/CPF/CNH, certidão de nascimento ou casamento, título de eleitor, CTPS, comprovante de residência, comprovante de escolaridade e as três vacinas (Covid-19, DT e febre amarela). Passaporte e PIS entram só se o colaborador tiver.
- **Ambiental:** também CTF Ibama e Work Citation, e os cursos CBSP, THUET/BOSIET/FOET e Norueguês/OEUK/ENG1. O **Certificado PAM** é opcional (um diferencial): pode ser cadastrado e anexado, mas não fica pendente.
- **ASO:** obrigatório para todos os setores, mas **só depois da admissão**. Quem está em standby não aparece com o ASO pendente.

Qualquer documento ou curso pode ser marcado como "somente após admissão" no cadastro de requisitos.

Um documento substituído por um arquivo novo continua guardado no histórico.

## Standby

O colaborador sem data de admissão está em **standby**: cadastrado, mas ainda não contratado. Ao registrar a data de admissão, os requisitos "somente após admissão" (como o ASO) passam a ser cobrados.

## Cadastro de colaboradores

- A ficha pode ser salva incompleta: só o **nome** é obrigatório. Os campos em branco não impedem salvar; ao salvar, o sistema avisa o que ficou faltando (RG, CPF, contato, endereço, setor e, no setor Ambiental, a escala). Enquanto faltar algo, o colaborador aparece em **Cadastros incompletos** no sino de avisos, com o botão "Abrir ficha"; o aviso some sozinho quando o cadastro é completado. Um campo preenchido de forma errada (CPF, PIS, e-mail, celular ou CEP com formato inválido) ainda impede salvar.
- No setor Ambiental sem escala informada, o colaborador é salvo sem embarque previsto.

## Leitura de documentos anexados

Ao anexar um documento pelo clipe, o sistema reconhece o texto do arquivo no próprio navegador (Tesseract e pdf.js; nenhum dado sai do computador e não há custo) e preenche **somente os campos vazios**:

| Documento | Campos |
|---|---|
| RG / CPF / CNH | CPF e RG |
| Nº do PIS | PIS |
| Título de eleitor | número do título |
| Passaporte | número do passaporte |
| Comprovante de residência | CEP |
| Certificado de curso / ASO | validade (só a data logo após "validade", "válido até", "vencimento", "expiry"...) |

- CPF, PIS e título só são preenchidos se os dígitos verificadores baterem. O RG não tem dígito verificador: é o campo com mais chance de vir com um dígito errado e precisa ser conferido.
- Se o documento tiver mais de um valor possível (ex.: conta de luz com o CEP da empresa e o do cliente), nada é preenchido e o aviso mostra os valores encontrados.
- Se o campo já tiver um valor diferente do documento, ele não é trocado; o aviso pede para conferir.
- Cada campo preenchido fica marcado "Lido do documento, confira" até ser editado. Nada é salvo sem o RH clicar em Salvar.
- Nomes (mãe, pai) e endereço não são lidos: são textos livres que só uma IA conseguiria separar com segurança.
- O CPF é validado pelos dígitos verificadores e não pode se repetir.
- Colaboradores não são apagados: o desligamento é registrado por data e o histórico é mantido. O banco recusa apagar qualquer registro que tenha histórico ligado a ele.
