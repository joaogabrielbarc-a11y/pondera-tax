import { TAX_RULES_2026 as rules } from "@/lib/tax/rules-2026";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const receita =
  "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026";
const inss =
  "https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal";

export function TaxReference() {
  const tables = [
    {
      title: "IRPF mensal",
      effective: "Desde janeiro de 2026",
      rows: rules.monthlyIr,
      source: receita,
    },
    {
      title: "IRPF anual",
      effective: "Ano-calendário 2026 · exercício 2027",
      rows: rules.annualIr,
      source: receita,
    },
    {
      title: "INSS progressivo CLT",
      effective:
        "Competências a partir de janeiro de 2026 · Portaria MPS/MF nº 13/2026",
      rows: rules.inss,
      source: inss,
    },
    {
      title: "PLR · tributação exclusiva",
      effective: "Tabela desde maio de 2025, vigente em 2026",
      rows: rules.plr,
      source: receita,
    },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        {tables.map((table) => (
          <section className="panel overflow-hidden" key={table.title}>
            <div className="section-heading">
              <div>
                <h2>{table.title}</h2>
                <p>{table.effective}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[420px]">
                <thead>
                  <tr>
                    <th>Base de cálculo</th>
                    <th>Alíquota</th>
                    <th>Parcela a deduzir</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index}>
                      <td>
                        {Number.isFinite(row.upTo)
                          ? `${index ? brl(table.rows[index - 1].upTo + 0.01) + " a " : "Até "}${brl(row.upTo)}`
                          : `Acima de ${brl(table.rows[index - 1].upTo)}`}
                      </td>
                      <td>{(row.rate * 100).toLocaleString("pt-BR")}%</td>
                      <td>
                        {"deduction" in row ? brl(row.deduction) : "Por faixa"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="p-5 text-sm text-slate-400">
              <a
                className="text-blue-300 underline"
                href={table.source}
                target="_blank"
                rel="noreferrer"
              >
                Fonte oficial ·{" "}
                {table.title.includes("INSS") ? "INSS" : "Receita Federal"}
              </a>
            </p>
          </section>
        ))}
      </div>
      <section className="panel p-6 space-y-4">
        <h2>Reduções e limites adicionais</h2>
        <p>
          Mensal: rendimentos até R$ 5.000,00 têm redução limitada a R$ 312,89
          para zerar o imposto. Até R$ 7.350,00: R$ 978,62 − 0,133145 ×
          rendimento tributável mensal, limitada ao imposto calculado.
        </p>
        <p>
          Anual: até R$ 60.000,00, redução de até R$ 2.694,15. Até R$ 88.200,00:
          R$ 8.429,73 − 0,095575 × rendimento sujeito ao ajuste, limitada ao
          imposto calculado. Acima desses limites, não há redução.
        </p>
        <p>
          Desconto simplificado: mensal R$ 607,20; anual 20% limitado a R$
          17.640,00. Dependente: R$ 189,59/mês ou R$ 2.275,08/ano. Instrução: R$
          3.561,50 por beneficiário/ano.
        </p>
        <p>
          INSS: aplicação marginal por faixa, limitado a R$ 988,09 por
          competência nesta convenção de arredondamento. O 13º tem apuração
          previdenciária separada.
        </p>
        <p className="text-sm text-slate-400">
          Os limites acima são da{" "}
          <a
            className="text-blue-300 underline"
            href={receita}
            target="_blank"
            rel="noreferrer"
          >
            Receita Federal — tributação 2026
          </a>
          . Consulte os informes oficiais para conciliar diferenças de
          arredondamento da fonte pagadora.
        </p>
      </section>
      <section className="panel p-6 space-y-3">
        <h2>Premissas e limites do simulador</h2>
        <p>
          Projeção de um vínculo CLT, residente fiscal no Brasil, ano-calendário
          2026. Valores em reais; centavos arredondados por evento. Não calcula
          multas/juros, tributação mínima de altas rendas, compensação de
          imposto estrangeiro, rescisão ou calendários trabalhistas especiais.
        </p>
        <p>
          Férias são informadas no mês de recebimento/gozo nesta projeção
          simplificada; períodos atravessando meses ou anos exigem conciliação
          por competência com o holerite. Não repita a remuneração de férias em
          ganhos extras.
        </p>
        <p>
          PGBL: dedução de contribuições próprias elegíveis até 12% dos
          rendimentos do ajuste, condicionada à previdência oficial. VGBL e
          contrapartidas patronais não são deduções pessoais. O PGBL é tributado
          no resgate e não garante economia líquida.
        </p>
        <p>
          Carnê-Leão: deduções já usadas na fonte não podem ser repetidas.
          Lançamento anual direto não permite reconstruir o imposto mensal.
          Somente principal pago informado gera crédito; juros e multa não são
          dedutíveis.
        </p>
        <a
          className="block text-blue-300 underline"
          href="https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/carne-leao/deducoes"
          target="_blank"
          rel="noreferrer"
        >
          Receita Federal · Deduções no Carnê-Leão
        </a>
        <a
          className="block text-blue-300 underline"
          href="https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/imposto-de-renda/dirpf/declaracao/pgvl-vgbl"
          target="_blank"
          rel="noreferrer"
        >
          Receita Federal · PGBL e VGBL
        </a>
      </section>
    </div>
  );
}
