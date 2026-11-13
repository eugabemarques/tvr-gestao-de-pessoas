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

| Situação | Comportamento | A confirmar com o RH |
|---|---|---|
| Embarque registrado começa **durante a folga** do anterior (convocação antecipada) | A folga que sobrou fica registrada como "dias de folga não gozados" | Esses dias viram saldo a compensar? |
| Embarque registrado começa **antes do fim** do embarque anterior | Recusado: os dados estão inconsistentes | — |
| Embarque registrado começa **depois** do previsto | Os dias entre o fim da folga e o novo embarque ficam "fora da escala" | Como chamar esse período (aguardando, afastado etc.)? |

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

Um documento substituído por um arquivo novo continua guardado no histórico.

## Cadastro de colaboradores

- O CPF é validado pelos dígitos verificadores e não pode se repetir.
- Colaboradores não são apagados: o desligamento é registrado por data e o histórico é mantido. O banco recusa apagar qualquer registro que tenha histórico ligado a ele.
