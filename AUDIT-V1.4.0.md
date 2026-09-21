# Auditoria Pondera Tax V1.4.0

Ano-calendário 2026, exercício 2027. Revisão de 21/09/2026.

## Ajustes V1.4.1

- Controle para zerar o aporte PGBL externo salvo, sem alterar a previdência empresarial em folha.
- Vantagem ou desvantagem percentual calculada sobre o patrimônio líquido do investimento tradicional.
- Diagnóstico visual informa se o PGBL ganha, perde ou empata, com diferença percentual e monetária.

## Problemas identificados e corrigidos

| Problema                                                       | Correção V1.4                                                                                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O modelo possuía apenas uma fonte CLT                          | Incluídos vínculos independentes, cada um com 12 competências, IRRF/INSS próprios e 13º por fonte. A declaração anual consolida as bases e alerta sobre insuficiência de retenção. |
| A quantidade de competências dirigia o Carnê-Leão              | O cálculo mensal agora percorre sempre janeiro a dezembro, mesmo quando existem 24 ou 36 holerites por múltiplos vínculos.                                                         |
| Editor alterava todas as linhas com o mesmo mês                | A sincronização passou a usar o identificador estável do holerite e o vínculo.                                                                                                     |
| Não havia preenchimento em massa                               | O editor replica os proventos nos 12 meses do vínculo e preserva a edição pontual posterior.                                                                                       |
| Férias não identificavam a fonte pagadora                      | Cada evento é associado ao vínculo; INSS, IRRF, salário diário e ajuste de caixa usam somente aquela fonte.                                                                        |
| Adiantamento aparecia apenas como ajuste do mês seguinte       | A interface identifica o valor no mês de gozo/pagamento e explica o efeito no holerite de fechamento/subsequente sem dupla contagem anual.                                         |
| DARF exigia digitação manual                                   | Carnê-Leão devido e alíquota efetiva são calculados automaticamente por competência; o valor efetivamente pago aceita override explícito, inclusive zero.                          |
| A área Previdência misturava conceitos                         | Menu reduzido para “Previdência” e cabeçalho deixa explícito que a aba contém somente plano empresarial descontado em folha e contrapartida patronal.                              |
| Simulação e aporte efetivo do PGBL eram entradas separadas     | Um único valor é testado e o botão “Salvar Aporte no Plano” o transforma em dedução efetiva, respeitando a margem de 12%.                                                          |
| Estudo PGBL tratava apenas um aporte e alíquota fixa           | Projeção anual reajustada por IPCA, reinvestimento percentual do benefício fiscal e tributação regressiva por idade de cada lote (35% a 10%).                                      |
| Comparativo tradicional não expunha alíquota efetiva           | O investimento tradicional aplica 15% somente sobre ganhos; ambos os cenários exibem imposto e alíquota efetiva consolidados.                                                      |
| Gráfico e contadores duplicavam/rompiam com múltiplos vínculos | Série mensal agregada em 12 pontos e contagem de competências por fonte.                                                                                                           |
| Células da auditoria de deduções tinham alturas diferentes     | Grid interno padronizado com CSS isolado em `.deduction-audit-card`.                                                                                                               |

## Premissas fiscais centrais

- O IRRF de cada vínculo é apurado isoladamente. A Declaração de Ajuste Anual soma todos os rendimentos sujeitos ao ajuste.
- O INSS do 13º compõe o total pago no ano, mas reduz apenas a base exclusiva do próprio 13º; não é repetido como dedução no ajuste anual.
- O Carnê-Leão automático agrega, por mês, rendimentos recebidos de pessoa física ou do exterior. Lançamentos anuais diretos não são rateados artificialmente.
- O PGBL dedutível permanece limitado a 12% dos rendimentos tributáveis sujeitos ao ajuste anual.
- Na projeção financeira, cada aporte PGBL é um lote: menos de 2 anos paga 35%; de 2 a 4, 30%; de 4 a 6, 25%; de 6 a 8, 20%; de 8 a 10, 15%; a partir de 10, 10%, sobre o valor total resgatado.
- O investimento tradicional comparável paga 15% apenas sobre ganho positivo no encerramento.

## Validação

- 33 testes unitários cobrindo motor tributário, migração, múltiplos vínculos e lotes PGBL;
- TypeScript e ESLint sem erros;
- exportação estática do Next.js concluída;
- smoke test desktop/mobile atualizado no workflow do GitHub Pages.

## Fontes

- Receita Federal — tabelas IRPF 2026: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
- Receita Federal — Carnê-Leão: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/carne-leao
- Lei nº 11.053/2004 — tributação regressiva da previdência complementar: https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11053.htm
- Previdência Social — tabela de contribuição mensal: https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal
