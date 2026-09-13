# Pondera Tax

Simulador e otimizador local-first de IRPF para trabalhadores CLT. A versão 1.0.0 cobre o ano-calendário 2026 (exercício 2027), compara os modelos simplificado e completo, audita a retenção mensal e calcula a margem de dedução via PGBL.

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
- Holerites e deduções são salvos em IndexedDB, com fallback para localStorage.
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

`https://joaogabrielbarc-a11y.github.io/pondera-tax/?v=1.0.0#dashboard`

> Este projeto oferece estimativas educacionais e não substitui a declaração oficial nem aconselhamento contábil individual.
