# Auditoria Pondera Tax V1.2.0

Ano-calendário 2026, exercício 2027. Revisão de 13/09/2026.

## Problemas identificados e corrigidos

| Problema na V1.1 | Correção na V1.2 |
|---|---|
| INSS do 13º ausente do KPI anual | Somado ao INSS total; excluído das deduções do ajuste, pois pertence ao rendimento exclusivo. |
| 13º bruto e INSS fixos, sem acompanhar salário | Bruto automático = salário de dezembro + ganhos extras anuais / 12; INSS progressivo separado. Overrides explícitos preservam valores reais. |
| Base do 13º na tabela calculada subtraindo imposto | Usa a base efetiva após a dedução mensal aplicável, exibindo INSS e líquido. |
| IRRF exclusivo de PLR/13º alterava saldo do ajuste | Retenções exclusivas não são créditos no ajuste. Divergências geram aviso para conciliação com o empregador. |
| Carnê-Leão devido presumido integralmente pago | Principal efetivamente recolhido informado separadamente. Não pagamento não muda a renda tributável, apenas o crédito. |
| Mesmo Carnê-Leão repetido em várias linhas do mês | Tabela mensal consolidada, separada dos lançamentos individuais. |
| Encargos do aluguel tratados como deduções mensais comuns | Excluídos do rendimento de aluguel antes do desconto mensal; renda bruta total continua exibindo recebimentos brutos. |
| Livro Caixa reduzia indevidamente renda na simplificada e margem PGBL | Dedução legal no modelo completo, limitada aos serviços; excesso mensal transportado até dezembro. |
| Dependentes repetidos na fonte e Carnê-Leão | Apuração mensal do Carnê-Leão exclui dependentes informados na folha da mesma competência. |
| Outras deduções legais de folha ausentes da declaração completa | Consolidação no ajuste anual, com orientação para não repetir em deduções adicionais. |
| Vários eventos de férias podiam ultrapassar teto automático de INSS | Rateio incremental de uma contribuição progressiva sobre férias da competência e cálculo residual na folha. Overrides excessivos geram alerta. |
| Adiantamento de férias reduzia renda líquida anual duas vezes | Conciliação do crédito de férias na folha seguinte com o adiantamento já recebido. O líquido anual não muda pela antecipação dentro do mesmo ano. |
| INSS zero convertido em automático | Flag explícita para INSS de folha e férias, aceitando zero. Desativar não apaga o último valor manual. |
| IRRF de PLR/13º sem retorno explícito ao automático | Toggles dedicados; zero não é usado como sentinela de automático. |
| Prévia do editor mostrava cálculo salvo | Prévia deriva do rascunho com memoização e atualiza antes de salvar. |
| Diálogos irmãos compartilhavam chaves React | Chaves exclusivas por editor e registro para evitar colisões de reconciliação. |
| Indicador de INSS manual continuava ativo ao desligar override | Indicador agora acompanha a flag, não o valor manual guardado. |
| Remover flag de renda do dependente apagava valor | Flag apenas controla a inclusão; valor fica preservado. |
| Otimizador alterava aportes reais durante a simulação | Aporte hipotético em estado local da simulação. Economia compara o melhor modelo atual com o melhor após aporte. |
| Navegação duplicada e hashes inconsistentes | Somente sidebar, incluindo categorias; sem stepper, abas internas ou barra inferior; histórico atualiza categoria e tela. |
| Risco de hidratação divergente por hash no primeiro render | Render inicial estável; leitura do hash após montagem. |
| Salvamento reportado antes da conclusão; risco de perda no fechamento | Mensagem de erro explícita, cópia local síncrona, escritas IndexedDB serializadas e escolha da cópia mais recente. |
| Overrides/aportes sem versão de migração | Esquema 3, preservando dados V1/V2, unificando bônus e comissão uma única vez. |

## Novas funcionalidades

- Resumo sticky: renda bruta e saldos dos dois modelos, destaque esmeralda para o melhor (ambos em empate).
- Holerite separado em proventos e descontos; despesas sem dedução fiscal só alteram o líquido.
- Previdência exclusiva em seção própria: percentuais sobre salário base bruto, atualização automática dos 12 meses e contrapartida patronal de 0%, 50%, 80% ou 100%.
- PLR e 13º em cards próprios; primeira parcela sem desconto, segunda com INSS/IRRF totais.
- Renda mensal ou total anual direto. Sem datas mensais, não se inventa um rateio para Carnê-Leão.
- Deduções por titular e por dependente, total consolidado e aba exclusiva de otimização.
- Tabelas oficiais somente leitura com vigência e links.

## Convenções de cálculo e validação

- Moeda arredondada para centavos no resultado de cada evento e nas consolidações. INSS soma faixas com precisão intermediária, arredondando a contribuição final; diferenças operacionais de um centavo podem ser conciliadas por override.
- 13º automático pressupõe 12/12 avos. Bruto proporcional pode ser informado manualmente.
- Férias informadas na mesma competência de recebimento/gozo. Períodos cruzando competências/anos exigem conciliação externa. Adiantamento de dezembro é liquidado na folha de janeiro, fora da projeção mensal corrente.
- Previdência percentual usa salário base bruto contratual, sem incorporar férias, 13º e extras; confira a base prevista no regulamento do plano. Contrapartida é informativa, não dedução pessoal nem renda de caixa.
- PGBL pressupõe elegibilidade legal e previdência oficial. Benefício é diferimento: há tributação no resgate, custos e restrições de liquidez.
- Não calcula multa/juros do Carnê-Leão, imposto estrangeiro compensável, rescisão, múltiplos vínculos ou tributação mínima de altas rendas. Lançamentos anuais de Livro Caixa requerem validação externa dos limites mensais.
- O imposto exclusivo é mostrado separadamente; “imposto devido” e saldo dos cards de modelos referem-se ao ajuste anual.
- Testes automatizados cobrem fronteiras de INSS, 13º, PLR, férias múltiplas, adiantamentos, overrides zero e retorno automático, PGBL, contrapartida, renda anual, Carnê-Leão pago/não pago, Livro Caixa, dependentes e migração idempotente.

## Fontes oficiais

- [Receita Federal — tabelas IRPF e PLR 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026)
- [INSS — tabela de contribuição mensal](https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal)
- [Receita Federal — rendimentos e exclusões do aluguel](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/carne-leao/rendimentos)
- [Receita Federal — deduções do Carnê-Leão e Livro Caixa](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/carne-leao/deducoes)
- [Receita Federal — PGBL/VGBL](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/imposto-de-renda/dirpf/declaracao/pgvl-vgbl)

Estimativa para planejamento, sem substituir a declaração oficial e a revisão dos informes.
