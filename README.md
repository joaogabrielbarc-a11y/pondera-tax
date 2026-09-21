# Pondera Tax

Simulador e otimizador local-first de IRPF para trabalhadores CLT. A versão 1.4.1 cobre o ano-calendário 2026 (exercício 2027), múltiplos vínculos, Carnê-Leão automático e projeção multianual de PGBL por lotes.

Veja o [relatório completo de correções e premissas da auditoria](AUDIT-V1.4.0.md).

## Escopo da V1.4.1

- Múltiplos vínculos, cada um com 12 holerites, retenção independente e consolidação anual.
- Replicação em massa de proventos com edição individual posterior.
- Overrides explícitos de IRRF e INSS, inclusive valor zero, com prévia em tempo real.
- Previdência empresarial por percentual nos 12 meses e contrapartida da empresa.
- Tabelas oficiais de referência e detalhamento de deduções por pessoa.
- Férias calculadas separadamente, abono pecuniário isento e desconto do adiantamento no caixa do mês seguinte.
- 13º salário, PLR, bônus, PGBL e VGBL em folha.
- Rendas extras com apuração mensal de Carnê-Leão para pessoa física ou exterior.
- Dependentes com renda tributável, educação e despesas médicas.
- Comparação completa × simplificada, trava do teto de 12% e efetivação direta do aporte simulado.
- Estudo PGBL × investimento tradicional com IPCA, reinvestimento do benefício fiscal e alíquota regressiva por lote.
- Diagnóstico do ganho ou perda percentual do PGBL e controle para zerar o aporte externo efetivado.
- Fechamento anual com renda total, base líquida, INSS, FGTS, IRRF e saldo.

## Rodar localmente

```bash
pnpm install
pnpm dev
```

Validação completa:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build:pages
```

## Privacidade e arquitetura

- Todos os cálculos acontecem no navegador.
- Holerites, férias, rendas extras e deduções são salvos em IndexedDB, com cópia localStorage datada e escritas serializadas.
- Dados salvos pelas versões anteriores são migrados automaticamente.
- Não há API, conta ou envio de dados fiscais.
- As tabelas ficam isoladas em `lib/tax/rules-2026.ts`.
- A navegação por hash é compatível com GitHub Pages.

## Estrutura principal

- `app/tax-app.tsx`: interface e fluxos do simulador.
- `lib/tax/calculator.ts`: motor tributário puro.
- `lib/tax/rules-2026.ts`: tabelas e limites oficiais versionados.
- `lib/storage.ts`: persistência local.
- `lib/tax/calculator.test.ts`: testes do motor.

## GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` publica automaticamente a branch `main`. No repositório, configure **Settings → Pages → Source: GitHub Actions**.

URL esperada:

`https://joaogabrielbarc-a11y.github.io/pondera-tax/?v=1.4.1#dashboard`

## Referências tributárias

- [Tabelas oficiais do IRPF 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026)
- [Portaria Interministerial MPS/MF nº 13/2026 — INSS](https://www.gov.br/previdencia/pt-br/assuntos/rpps/documentos/PortariaInterministerialMPSMF13de9dejaneirode2026.pdf)
- [Receita Federal — PGBL e VGBL](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/imposto-de-renda/dirpf/declaracao/pgvl-vgbl)

> Este projeto oferece estimativas educacionais e não substitui a declaração oficial nem aconselhamento contábil individual.
