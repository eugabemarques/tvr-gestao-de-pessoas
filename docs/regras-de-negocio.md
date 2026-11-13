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

**Para mudar a regra**, o RH cria uma versão nova com a data em que ela passa a valer. Embarques que começaram antes continuam calculados pela versão antiga, então o histórico não muda.

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
| Aguardando primeiro embarque | O primeiro embarque ainda não começou |
| Embarcado | A bordo, incluindo dias de dobra |
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
- **Ambiental:** também CTF Ibama e Work Citation, e os cursos CBSP, THUET/BOSIET/FOET, Norueguês/OEUK/ENG1 e Certificado PAM.
- **ASO:** obrigatório para todos os setores, mas **só depois da admissão**. Quem está em standby não aparece com o ASO pendente.

Qualquer documento ou curso pode ser marcado como "somente após admissão" no cadastro de requisitos.

Um documento substituído por um arquivo novo continua guardado no histórico.

## Standby

O colaborador sem data de admissão está em **standby**: cadastrado, mas ainda não contratado. Ao registrar a data de admissão, os requisitos "somente após admissão" (como o ASO) passam a ser cobrados.

## Cadastro de colaboradores

- O CPF é validado pelos dígitos verificadores e não pode se repetir.
- Colaboradores não são apagados: o desligamento é registrado por data e o histórico é mantido. O banco recusa apagar qualquer registro que tenha histórico ligado a ele.
