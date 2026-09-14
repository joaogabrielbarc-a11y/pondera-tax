# Auditoria Pondera Tax V1.3.0

Ano-calendário 2026, exercício 2027. Revisão de 14/09/2026.

## Problemas identificados e corrigidos

| Problema | Correção V1.3 |
|---|---|
| KPIs ocupavam uma faixa alta abaixo da barra de ações | Resumo movido para o header, com três cartões compactos ao lado de Exportar. |
| Cor do saldo não distinguia restituição de imposto a pagar | Restituição usa verde; imposto a pagar usa coral. O melhor modelo mantém borda e fundo esmeralda. |
| Sidebar consumia largura fixa | Controle de recolher/expandir; modo compacto de 76 px mantém ícones, `title` e nomes acessíveis. |
| Aportes externos apareciam na Previdência em Folha | Seção renomeada para Previdência Empresarial e limitada ao plano descontado em folha e à contrapartida patronal. |
| Simulador aceitava aporte acima da margem de 12% | Campo e slider agora aplicam trava rígida na margem disponível. |
| “Já aportado” incluía o valor hipotético | Indicadores agora separam realizado, margem e aporte simulado. |
| Economia PGBL era comparada ao modelo recomendado, mascarando o efeito quando o simplificado vencia | Eficiência fiscal é calculada dentro do modelo completo, único modelo em que a dedução PGBL atua. |
| Não havia estudo financeiro do benefício fiscal | Adicionado comparativo de aporte único: taxas de administração, rentabilidades, IR no resgate, IR sobre ganhos e reinvestimento da economia fiscal. |
| Rótulos da composição completa quebravam uma palavra por linha | Corrigido o grid interno, a largura mínima, o alinhamento dos valores e o comportamento em telas estreitas. |
| Total de INSS e dedução no ajuste eram facilmente confundidos | A interface mostra INSS total pago, INSS dedutível no ajuste e INSS do 13º em linhas separadas. |
| Smoke test ainda procurava o nome antigo da Previdência e os KPIs removidos | Fluxo atualizado para a V1.3, incluindo sidebar retrátil e estudo PGBL. |

## Regra do INSS do 13º

O INSS sobre o 13º salário é calculado e consolidado no total de contribuições pagas no ano. Como o 13º é rendimento sujeito à tributação exclusiva, essa contribuição reduz a base do próprio 13º e não volta a reduzir a base da Declaração de Ajuste Anual. Repeti-la na declaração produziria dupla dedução.

Assim, o motor mantém duas métricas:

- `annualInss`: folha, férias, rendas extras informadas e 13º;
- `deductibleInss`: contribuições vinculadas a rendimentos sujeitos ao ajuste anual, sem o 13º.

## Estudo financeiro PGBL

O estudo usa um aporte único limitado à margem fiscal. O patrimônio PGBL cresce pela rentabilidade bruta líquida da taxa de administração e sofre a alíquota escolhida sobre o valor total no resgate. A economia fiscal calculada pelo motor é reinvestida à taxa informada e tributada em 15% sobre ganhos. O investimento tradicional recebe o mesmo aporte e sofre taxa de administração e 15% sobre ganhos.

O resultado é educacional e nominal. Não inclui inflação, taxa de carregamento, aportes futuros, portabilidade, risco do fundo ou mudanças tributárias.

## Validação

- 31 testes unitários do motor tributário e financeiro;
- TypeScript sem erros;
- ESLint sem erros;
- exportação estática do Next.js concluída;
- smoke test de desktop/mobile executado pelo workflow de GitHub Pages, com capturas armazenadas como artefato.

## Fontes

- Receita Federal, Perguntas e Respostas IRPF 2026, perguntas 332 e 335: https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirpf/p-r-irpf-2026-v1-00-2026-04-23.pdf
- Receita Federal, tabelas IRPF 2026: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
- Previdência Social, tabela de contribuição mensal: https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal
