"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Calculator,
  CalendarDays,
  Check,
  Download,
  FileSpreadsheet,
  Gauge,
  Info,
  Landmark,
  LayoutDashboard,
  Leaf,
  Menu,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { loadTaxState, saveTaxState } from "@/lib/storage";
import {
  calculatePgblOpportunity,
  calculateProjection,
} from "@/lib/tax/calculator";
import { TaxReference } from "./tax-reference";
import { TAX_RULES_2026 } from "@/lib/tax/rules-2026";
import {
  createDependent,
  createExtraIncome,
  createInitialState,
  createVacation,
  migrateTaxState,
  monthLabel,
} from "@/lib/tax/seed";
import type {
  Dependent,
  ExtraIncome,
  PayrollMonth,
  Projection,
  TaxState,
  VacationEvent,
} from "@/lib/tax/types";

type View =
  "dados" | "deducoes" | "otimizacao" | "comparativo" | "dashboard" | "tabelas";
type DataSection =
  "holerites" | "ferias" | "eventos" | "previdencia" | "rendas" | "familia";

const navigation: Array<{
  id: View;
  step: number;
  label: string;
  short: string;
  icon: typeof Gauge;
}> = [
  {
    id: "dados",
    step: 1,
    label: "Dados do ano",
    short: "Dados",
    icon: FileSpreadsheet,
  },
  {
    id: "deducoes",
    step: 2,
    label: "Deduções legais",
    short: "Deduções",
    icon: ReceiptText,
  },
  {
    id: "tabelas",
    step: 6,
    label: "Tabelas oficiais",
    short: "Tabelas",
    icon: Calculator,
  },
  {
    id: "otimizacao",
    step: 2,
    label: "Otimização",
    short: "Otimizar",
    icon: PiggyBank,
  },
  {
    id: "comparativo",
    step: 3,
    label: "Comparativo",
    short: "Modelos",
    icon: BarChart3,
  },
  {
    id: "dashboard",
    step: 4,
    label: "Fechamento anual",
    short: "Resumo",
    icon: LayoutDashboard,
  },
];

const dataSections: Array<{
  id: DataSection;
  label: string;
  icon: typeof Gauge;
}> = [
  { id: "holerites", label: "Holerites", icon: ReceiptText },
  { id: "ferias", label: "Férias", icon: CalendarDays },
  { id: "eventos", label: "PLR e 13º salário", icon: Sparkles },
  { id: "previdencia", label: "Previdência", icon: PiggyBank },
  { id: "rendas", label: "Rendas extras", icon: Landmark },
  { id: "familia", label: "Família", icon: Users },
];

const titles: Record<
  View,
  { eyebrow: string; title: string; description: string }
> = {
  deducoes: {
    eyebrow: "Deduções legais",
    title: "Deduções do titular e dependentes",
    description:
      "Valores comprovados, sem repetir despesas já informadas na folha.",
  },
  tabelas: {
    eyebrow: "Ano-calendário 2026",
    title: "Tabelas e regras oficiais",
    description: "Consulta somente leitura · Exercício 2027.",
  },
  dados: {
    eyebrow: "Planejamento 2026",
    title: "Dados e histórico do ano",
    description: "Organize holerites, férias, rendas extras e grupo familiar.",
  },
  otimizacao: {
    eyebrow: "Planejamento 2026",
    title: "Otimização tributária",
    description: "Audite deduções e dimensione um aporte estratégico em PGBL.",
  },
  comparativo: {
    eyebrow: "Planejamento 2026",
    title: "Simplificada ou completa?",
    description:
      "Compare os dois modelos com a mesma renda e os mesmos pagamentos.",
  },
  dashboard: {
    eyebrow: "Planejamento 2026",
    title: "Fechamento anual projetado",
    description: "Consolide renda, base líquida, retenções, INSS e FGTS.",
  },
};

const formatBRL = (value: number, compact = false) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: compact ? 0 : 2,
  }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);

const parseHash = (): View => {
  if (typeof window === "undefined") return "dashboard";
  const hash = window.location.hash.replace("#", "");
  if (dataSections.some((item) => item.id === hash) || hash === "configuracoes")
    return "dados";
  if (hash === "pgbl") return "otimizacao";
  return navigation.some((item) => item.id === hash)
    ? (hash as View)
    : "dashboard";
};

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={cn("panel", className)}>{children}</section>;
}

function StatusBadge({ status }: { status: PayrollMonth["status"] }) {
  return (
    <span
      className={cn(
        "status-pill",
        status === "actual" ? "status-actual" : "status-projected",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status === "actual" ? "Realizado" : "Projetado"}
    </span>
  );
}

function BalanceLabel({ balance }: { balance: number }) {
  if (balance === 0) return <span className="text-slate-300">Sem saldo</span>;
  const refund = balance > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        refund ? "text-emerald-300" : "text-amber-300",
      )}
    >
      {refund ? (
        <ArrowUpRight className="size-3.5" />
      ) : (
        <ArrowDownRight className="size-3.5" />
      )}
      {refund ? "A restituir" : "A pagar"}
    </span>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  helper: React.ReactNode;
  icon: typeof Gauge;
  tone?: "blue" | "emerald" | "amber" | "slate";
}) {
  return (
    <Card className="metric-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-[clamp(1.25rem,2vw,1.72rem)] font-semibold tracking-[-0.035em] text-white">
            {value}
          </p>
        </div>
        <span className={cn("metric-icon", `metric-icon-${tone}`)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-4 text-xs leading-relaxed text-slate-400">
        {helper}
      </div>
    </Card>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  helper?: string;
}) {
  return (
    <label className="field-label">
      <span title={helper}>
        {label}
        {helper && (
          <Info
            className="ml-2 inline size-3.5"
            aria-label="Ajuda disponível abaixo do campo"
          />
        )}
      </span>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(event) =>
          onChange(Math.max(0, Number(event.target.value) || 0))
        }
      />
      {helper && <small>{helper}</small>}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="toggle-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track">
        <span />
      </span>
      <span>{label}</span>
    </label>
  );
}

function ProjectionChart({ projection }: { projection: Projection }) {
  const isClient = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const data = projection.months.map((month) => ({
    month: monthLabel(month.month).slice(0, 3),
    renda: month.grossTaxable,
    irrf: month.irrfUsed,
  }));
  if (!isClient)
    return (
      <div className="h-[250px] w-full animate-pulse rounded-xl bg-white/[.02]" />
    );
  return (
    <div
      className="h-[250px] w-full"
      aria-label="Gráfico mensal de renda tributável e IRRF"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 4, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f8cff" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#4f8cff" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="taxGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#243148"
            strokeDasharray="3 6"
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7888a3", fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7888a3", fontSize: 11 }}
            tickFormatter={(value) => `${Math.round(value / 1000)}k`}
          />
          <Tooltip
            cursor={{ stroke: "#4f8cff", strokeOpacity: 0.35 }}
            contentStyle={{
              background: "#111b2d",
              border: "1px solid #273650",
              borderRadius: 12,
              color: "#e8eef8",
            }}
            formatter={(value, name) => [
              formatBRL(Number(value)),
              name === "renda" ? "Renda tributável" : "IRRF usado",
            ]}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="renda"
            stroke="#6397ff"
            strokeWidth={2}
            fill="url(#grossGradient)"
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="irrf"
            stroke="#34d399"
            strokeWidth={2}
            fill="url(#taxGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PayrollTable({
  projection,
  onEditMonth,
}: {
  projection: Projection;
  onEditMonth: (index: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Renda ordinária</p>
          <h2>12 meses + 13º salário</h2>
          <p>
            INSS, base, IRRF previsto e líquido são recalculados em tempo real.
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status="actual" />
          <StatusBadge status="projected" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[1050px]">
          <thead>
            <tr>
              <th>Competência</th>
              <th>Status</th>
              <th>Salário base</th>
              <th>Ganhos extras</th>
              <th>Base IRRF</th>
              <th>INSS</th>
              <th>IRRF</th>
              <th>Líquido do mês</th>
              <th className="text-right">Editar</th>
            </tr>
          </thead>
          <tbody>
            {projection.months.map((month) => {
              const extras =
                month.overtime +
                month.commission +
                month.bonus +
                month.otherTaxable;
              return (
                <tr key={month.id}>
                  <td>
                    <strong>{monthLabel(month.month)}</strong>
                    {month.vacationDays > 0 && (
                      <small>{month.vacationDays} dias de férias</small>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={month.status} />
                  </td>
                  <td>{formatBRL(month.salary)}</td>
                  <td className={extras ? "text-blue-300" : ""}>
                    {formatBRL(extras)}
                  </td>
                  <td>{formatBRL(month.taxableBase)}</td>
                  <td>
                    {formatBRL(month.inssUsed)}
                    {month.inssOverrideEnabled && <small>manual</small>}
                  </td>
                  <td>
                    {formatBRL(month.irrfUsed)}
                    {month.irrfOverrideEnabled && <small>override</small>}
                  </td>
                  <td
                    className={
                      month.netIncome < 0 ? "text-amber-300" : "text-slate-200"
                    }
                  >
                    {formatBRL(month.netIncome)}
                    {month.vacationAdvanceDeduction > 0 && (
                      <small>
                        adiantamento: −
                        {formatBRL(month.vacationAdvanceDeduction)}
                      </small>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => onEditMonth(month.month)}
                      className="icon-button"
                      aria-label={`Editar ${monthLabel(month.month)}`}
                    >
                      <Pencil />
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr className="annual-row">
              <td>
                <strong>13º salário</strong>
                <small>Tributação exclusiva</small>
              </td>
              <td>
                <span className="status-pill status-actual">Anual</span>
              </td>
              <td>{formatBRL(projection.breakdown.thirteenth)}</td>
              <td>—</td>
              <td>{formatBRL(projection.thirteenth.taxableBase)}</td>
              <td>{formatBRL(projection.thirteenth.inss)}</td>
              <td>{formatBRL(projection.thirteenth.irrfUsed)}</td>
              <td>
                {formatBRL(
                  projection.thirteenth.firstInstallment +
                    projection.thirteenth.secondInstallment,
                )}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function VacationTable({
  state,
  projection,
  onEdit,
  onAdd,
  onDelete,
}: {
  state: TaxState;
  projection: Projection;
  onEdit: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Apuração separada</p>
          <h2>Eventos de férias</h2>
          <p>
            O abono pecuniário e seu terço aparecem como rendimentos isentos.
          </p>
        </div>
        <Button
          onClick={onAdd}
          className="bg-blue-500 text-white hover:bg-blue-400"
        >
          <Plus />
          Adicionar férias
        </Button>
      </div>
      {projection.vacations.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum período de férias"
          text="Adicione um evento para calcular férias, abono e adiantamento."
          action="Adicionar férias"
          onAction={onAdd}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[980px]">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Dias gozados</th>
                <th>Dias vendidos</th>
                <th>Férias + 1/3</th>
                <th>Abono isento</th>
                <th>INSS</th>
                <th>IRRF</th>
                <th>Adiantamento</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {projection.vacations.map((event, index) => (
                <tr key={event.id}>
                  <td>
                    <strong>{monthLabel(event.month)}</strong>
                  </td>
                  <td>{event.daysTaken}</td>
                  <td>{event.daysSold}</td>
                  <td>{formatBRL(event.taxableGross)}</td>
                  <td className="text-emerald-300">
                    {formatBRL(event.exemptGross)}
                  </td>
                  <td>{formatBRL(event.inssUsed)}</td>
                  <td>
                    {formatBRL(event.irrfUsed)}
                    {event.irrfOverrideEnabled && <small>override</small>}
                  </td>
                  <td>
                    {event.receivedAdvance ? (
                      <span className="status-pill status-projected">
                        Próximo mês
                      </span>
                    ) : (
                      "Não"
                    )}
                  </td>
                  <td className="text-right">
                    <div className="inline-flex gap-2">
                      <button
                        className="icon-button"
                        onClick={() => onEdit(index)}
                        aria-label="Editar férias"
                      >
                        <Pencil />
                      </button>
                      <button
                        className="icon-button danger"
                        onClick={() => onDelete(index)}
                        aria-label="Excluir férias"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state.vacations.some(
        (event) => event.receivedAdvance && event.month === 11,
      ) && (
        <div className="notice-row">
          <Info />O adiantamento de férias de dezembro não é descontado dentro
          deste ano-calendário.
        </div>
      )}
    </Card>
  );
}

function OverrideInput({
  label,
  enabled,
  value,
  calculated,
  onToggle,
  onChange,
}: {
  label: string;
  enabled: boolean;
  value: number | null;
  calculated: number;
  onToggle: (value: boolean) => void;
  onChange: (value: number) => void;
}) {
  return (
    <div className="override-box">
      <Toggle
        checked={enabled}
        onChange={onToggle}
        label={`Sobrescrever ${label}`}
      />
      {enabled ? (
        <MoneyInput
          label={`${label} informado`}
          value={value ?? calculated}
          onChange={onChange}
        />
      ) : (
        <p className="text-sm text-slate-400">
          {label} automático:{" "}
          <strong className="text-white">{formatBRL(calculated)}</strong>
        </p>
      )}
    </div>
  );
}

function EventsPanel({
  state,
  setState,
  projection,
}: {
  state: TaxState;
  setState: React.Dispatch<React.SetStateAction<TaxState>>;
  projection: Projection;
}) {
  const setEvent = (
    key: keyof TaxState["events"],
    value: number | boolean | null,
  ) =>
    setState((current) => ({
      ...current,
      events: { ...current.events, [key]: value },
    }));
  const toggle = (
    key: keyof TaxState["events"],
    field: keyof TaxState["events"],
    value: boolean,
    calculated: number,
  ) =>
    setState((current) => ({
      ...current,
      events: {
        ...current.events,
        [key]: value,
        [field]:
          value && current.events[field] === null
            ? calculated
            : current.events[field],
      },
    }));
  const p = projection.thirteenth;
  const plrUsed = state.events.plrIrrfOverrideEnabled
    ? (state.events.plrIrrf ?? 0)
    : projection.plrTax;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="p-6 space-y-4">
        <p className="section-kicker">Tributação exclusiva na fonte</p>
        <h2>PLR</h2>
        <MoneyInput
          label="PLR bruta anual"
          value={state.events.plrGross}
          onChange={(v) => setEvent("plrGross", v)}
        />
        <OverrideInput
          label="IRRF da PLR"
          enabled={state.events.plrIrrfOverrideEnabled}
          value={state.events.plrIrrf}
          calculated={projection.plrTax}
          onToggle={(v) =>
            toggle("plrIrrfOverrideEnabled", "plrIrrf", v, projection.plrTax)
          }
          onChange={(v) => setEvent("plrIrrf", v)}
        />
        <div className="soft-stat">
          <span>PLR líquida</span>
          <strong>{formatBRL(state.events.plrGross - plrUsed)}</strong>
        </div>
        <p className="text-sm text-slate-400">
          A tabela incide sobre a PLR acumulada no ano. Bônus e comissões são
          informados nos holerites.
        </p>
      </Card>
      <Card className="p-6 space-y-4">
        <p className="section-kicker">Apuração separada</p>
        <h2>13º salário</h2>
        <p className="text-sm text-slate-400">
          Projeção de 12/12 avos: salário base de dezembro + média dos ganhos
          extras dos 12 meses. Para admissão, afastamento ou rescisão, informe o
          bruto proporcional.
        </p>
        <OverrideInput
          label="bruto do 13º"
          enabled={state.events.thirteenthGrossOverrideEnabled}
          value={state.events.thirteenthGross}
          calculated={p.gross}
          onToggle={(v) => setEvent("thirteenthGrossOverrideEnabled", v)}
          onChange={(v) => setEvent("thirteenthGross", v)}
        />
        <OverrideInput
          label="INSS do 13º"
          enabled={state.events.thirteenthInssOverrideEnabled}
          value={state.events.thirteenthInss}
          calculated={p.inss}
          onToggle={(v) => setEvent("thirteenthInssOverrideEnabled", v)}
          onChange={(v) => setEvent("thirteenthInss", v)}
        />
        <OverrideInput
          label="IRRF do 13º"
          enabled={state.events.thirteenthIrrfOverrideEnabled}
          value={state.events.thirteenthIrrf}
          calculated={projection.thirteenthTax}
          onToggle={(v) =>
            toggle(
              "thirteenthIrrfOverrideEnabled",
              "thirteenthIrrf",
              v,
              projection.thirteenthTax,
            )
          }
          onChange={(v) => setEvent("thirteenthIrrf", v)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="soft-stat">
            <span>1ª parcela · sem descontos</span>
            <strong>{formatBRL(p.firstInstallment)}</strong>
          </div>
          <div className="soft-stat">
            <span>2ª parcela · INSS e IRRF integrais</span>
            <strong>{formatBRL(p.secondInstallment)}</strong>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          O INSS do 13º entra no total anual pago, mas só deduz a base do
          próprio 13º.
        </p>
      </Card>
    </div>
  );
}

function RetirementTable({
  state,
  setState,
  projection,
}: {
  state: TaxState;
  setState: React.Dispatch<React.SetStateAction<TaxState>>;
  projection: Projection;
}) {
  const totalPgbl = projection.months.reduce(
    (sum, item) => sum + item.pgblPayroll,
    0,
  );
  const totalVgbl = projection.months.reduce(
    (sum, item) => sum + item.vgblPayroll,
    0,
  );
  const update = (
    index: number,
    key: "pgblPayroll" | "vgblPayroll",
    value: number,
  ) =>
    setState((current) => ({
      ...current,
      months: current.months.map((month, itemIndex) =>
        itemIndex === index ? { ...month, [key]: value } : month,
      ),
    }));
  const setRetirement = (
    key: keyof TaxState["retirement"],
    value: number | boolean,
  ) =>
    setState((current) => ({
      ...current,
      retirement: { ...current.retirement, [key]: value },
    }));
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <div className="space-y-5">
        <Card className="p-6 space-y-4">
          <h2>Contribuição compulsória</h2>
          <Toggle
            label="Preencher automaticamente os 12 meses por percentual"
            checked={state.retirement.automatic}
            onChange={(v) => {
              setState((current) => ({
                ...current,
                months: !v
                  ? projection.months.map((m) => ({
                      ...current.months[m.month],
                      pgblPayroll: m.pgblPayroll,
                      vgblPayroll: m.vgblPayroll,
                    }))
                  : current.months,
                retirement: { ...current.retirement, automatic: v },
              }));
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput
              label="PGBL · % do salário base bruto"
              value={state.retirement.pgblPercent}
              onChange={(v) => setRetirement("pgblPercent", Math.min(100, v))}
            />
            <MoneyInput
              label="VGBL · % do salário base bruto"
              value={state.retirement.vgblPercent}
              onChange={(v) => setRetirement("vgblPercent", Math.min(100, v))}
            />
          </div>
          <label className="field-label">
            <span>Contrapartida da empresa sobre o aporte do empregado</span>
            <select
              className="input-select"
              value={state.retirement.employerMatchPercent}
              onChange={(e) =>
                setRetirement("employerMatchPercent", Number(e.target.value))
              }
            >
              {[0, 50, 80, 100].map((v) => (
                <option key={v} value={v}>
                  {v}%
                </option>
              ))}
            </select>
          </label>
          <MoneyInput
            label="PGBL pessoal já aportado fora da folha"
            value={state.deductions.pgblDirect}
            onChange={(v) =>
              setState((current) => ({
                ...current,
                deductions: { ...current.deductions, pgblDirect: v },
              }))
            }
          />
          <p className="text-sm text-slate-400">
            No modo percentual, alterações no salário atualizam os aportes
            automaticamente. Ao desativar, os valores calculados ficam
            disponíveis para edição manual. A contrapartida não é dedução
            pessoal.
          </p>
        </Card>
        <Card className="overflow-hidden">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Desconto em folha</p>
              <h2>PGBL e VGBL mensais</h2>
              <p>
                Somente PGBL entra no limite de dedução; VGBL afeta apenas o
                líquido.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[620px]">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>PGBL em folha</th>
                  <th>VGBL em folha</th>
                </tr>
              </thead>
              <tbody>
                {projection.months.map((month, index) => (
                  <tr key={month.id}>
                    <td>
                      <strong>{monthLabel(month.month)}</strong>
                    </td>
                    <td>
                      <InlineMoney
                        label={`PGBL de ${monthLabel(month.month)}`}
                        disabled={state.retirement.automatic}
                        value={month.pgblPayroll}
                        onChange={(value) =>
                          update(index, "pgblPayroll", value)
                        }
                      />
                    </td>
                    <td>
                      <InlineMoney
                        label={`VGBL de ${monthLabel(month.month)}`}
                        disabled={state.retirement.automatic}
                        value={month.vgblPayroll}
                        onChange={(value) =>
                          update(index, "vgblPayroll", value)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <div className="space-y-5">
        <MetricCard
          label="Contrapartida anual da empresa"
          value={formatBRL(projection.employerMatch)}
          helper="Estimativa conforme percentual contratado, sem dedução no IRPF do empregado."
          icon={Landmark}
          tone="emerald"
        />
        <MetricCard
          label="PGBL em folha"
          value={formatBRL(totalPgbl)}
          helper={`${formatPercent(projection.pgbl.limit ? totalPgbl / projection.pgbl.limit : 0)} do limite anual`}
          icon={Leaf}
          tone="emerald"
        />
        <MetricCard
          label="VGBL em folha"
          value={formatBRL(totalVgbl)}
          helper="Registrado para fluxo de caixa; sem dedução no IRPF."
          icon={ShieldCheck}
          tone="slate"
        />
      </div>
    </div>
  );
}

function ExtraIncomeTable({
  state,
  projection,
  onAdd,
  onEdit,
  onDelete,
}: {
  state: TaxState;
  projection: Projection;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const typeLabel = {
    rent: "Aluguel",
    proLabore: "Pró-labore",
    services: "Serviços PF",
  } as const;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Renda extra tributável"
          value={formatBRL(projection.breakdown.extraIncome)}
          helper="Após despesas vinculadas informadas"
          icon={Banknote}
          tone="blue"
        />
        <MetricCard
          label="Carnê-Leão projetado"
          value={formatBRL(projection.totalCarneLeao)}
          helper={`Pago informado: ${formatBRL(projection.totalCarneLeaoPaid)} · lançamentos anuais não entram no cálculo mensal`}
          icon={Calculator}
          tone="amber"
        />
        <MetricCard
          label="IRRF de fontes PJ"
          value={formatBRL(
            state.extraIncome.reduce((sum, item) => sum + item.withheldIrrf, 0),
          )}
          helper="Compensado no ajuste anual"
          icon={ShieldCheck}
          tone="emerald"
        />
      </div>
      <Card className="overflow-hidden">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Outras fontes</p>
            <h2>Aluguel, pró-labore e serviços</h2>
            <p>
              O Carnê-Leão é calculado por mês quando o pagador é pessoa física
              ou do exterior.
            </p>
          </div>
          <Button
            onClick={onAdd}
            className="bg-blue-500 text-white hover:bg-blue-400"
          >
            <Plus />
            Adicionar renda
          </Button>
        </div>
        {state.extraIncome.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Nenhuma renda extra"
            text="Cadastre rendimentos fora do holerite para incluí-los no ajuste."
            action="Adicionar renda"
            onAction={onAdd}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[940px]">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Tipo</th>
                  <th>Pagador</th>
                  <th>Bruto</th>
                  <th>Despesas</th>
                  <th>IRRF</th>
                  <th>Carnê-Leão pago</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {state.extraIncome.map((entry, index) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>
                        {entry.entryMode === "annual"
                          ? "Total anual"
                          : monthLabel(entry.month)}
                      </strong>
                    </td>
                    <td>
                      {typeLabel[entry.type]}
                      {entry.description && <small>{entry.description}</small>}
                    </td>
                    <td>
                      {entry.payerType === "legalEntity"
                        ? "Pessoa jurídica"
                        : entry.payerType === "individual"
                          ? "Pessoa física"
                          : "Exterior"}
                    </td>
                    <td>{formatBRL(entry.gross)}</td>
                    <td>{formatBRL(entry.deductibleExpenses)}</td>
                    <td>{formatBRL(entry.withheldIrrf)}</td>
                    <td
                      className={
                        entry.payerType !== "legalEntity"
                          ? "text-amber-300"
                          : ""
                      }
                    >
                      {entry.payerType !== "legalEntity"
                        ? formatBRL(
                            entry.carneLeaoPaid ? entry.carneLeaoPaidAmount : 0,
                          )
                        : "Não aplicável"}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-2">
                        <button
                          className="icon-button"
                          onClick={() => onEdit(index)}
                          aria-label="Editar renda"
                        >
                          <Pencil />
                        </button>
                        <button
                          className="icon-button danger"
                          onClick={() => onDelete(index)}
                          aria-label="Excluir renda"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card className="overflow-hidden">
        <div className="section-heading">
          <h2>Carnê-Leão consolidado por mês</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[650px]">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Rendimento tributável</th>
                <th>Base</th>
                <th>Devido</th>
                <th>Pago informado</th>
                <th>Sem recolhimento informado</th>
              </tr>
            </thead>
            <tbody>
              {projection.carneLeao.map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td>{formatBRL(m.gross)}</td>
                  <td>{formatBRL(m.taxableBase)}</td>
                  <td>{formatBRL(m.taxDue)}</td>
                  <td>{formatBRL(m.taxPaid)}</td>
                  <td>{formatBRL(Math.max(0, m.taxDue - m.taxPaid))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FamilyTable({
  state,
  onAdd,
  onEdit,
  onDelete,
}: {
  state: TaxState;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Declaração conjunta</p>
          <h2>Grupo familiar e dependentes</h2>
          <p>
            A renda tributável do dependente é somada à do titular quando a
            opção estiver ativa.
          </p>
        </div>
        <Button
          onClick={onAdd}
          className="bg-blue-500 text-white hover:bg-blue-400"
        >
          <Plus />
          Adicionar dependente
        </Button>
      </div>
      {state.dependents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum dependente cadastrado"
          text="Inclua apenas pessoas que atendam aos critérios legais de dependência."
          action="Adicionar dependente"
          onAction={onAdd}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[840px]">
            <thead>
              <tr>
                <th>Dependente</th>
                <th>Possui renda?</th>
                <th>Renda tributável</th>
                <th>Educação</th>
                <th>Saúde</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {state.dependents.map((dependent, index) => (
                <tr key={dependent.id}>
                  <td>
                    <strong>
                      {dependent.name || `Dependente ${index + 1}`}
                    </strong>
                  </td>
                  <td>
                    <span
                      className={cn(
                        "status-pill",
                        dependent.hasTaxableIncome
                          ? "status-projected"
                          : "status-actual",
                      )}
                    >
                      {dependent.hasTaxableIncome ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td>
                    {formatBRL(
                      dependent.hasTaxableIncome ? dependent.taxableIncome : 0,
                    )}
                  </td>
                  <td>{formatBRL(dependent.education)}</td>
                  <td>{formatBRL(dependent.medical)}</td>
                  <td className="text-right">
                    <div className="inline-flex gap-2">
                      <button
                        className="icon-button"
                        onClick={() => onEdit(index)}
                        aria-label="Editar dependente"
                      >
                        <Pencil />
                      </button>
                      <button
                        className="icon-button danger"
                        onClick={() => onDelete(index)}
                        aria-label="Excluir dependente"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function DataView({
  state,
  setState,
  projection,
  section,
  onEditMonth,
  vacationActions,
  incomeActions,
  dependentActions,
}: {
  state: TaxState;
  setState: React.Dispatch<React.SetStateAction<TaxState>>;
  projection: Projection;
  section: DataSection;
  onEditMonth: (index: number) => void;
  vacationActions: {
    add: () => void;
    edit: (index: number) => void;
    remove: (index: number) => void;
  };
  incomeActions: {
    add: () => void;
    edit: (index: number) => void;
    remove: (index: number) => void;
  };
  dependentActions: {
    add: () => void;
    edit: (index: number) => void;
    remove: (index: number) => void;
  };
}) {
  return (
    <div className="space-y-5">
      {section === "holerites" && (
        <PayrollTable projection={projection} onEditMonth={onEditMonth} />
      )}
      {section === "ferias" && (
        <VacationTable
          state={state}
          projection={projection}
          onAdd={vacationActions.add}
          onEdit={vacationActions.edit}
          onDelete={vacationActions.remove}
        />
      )}
      {section === "eventos" && (
        <EventsPanel
          state={state}
          setState={setState}
          projection={projection}
        />
      )}
      {section === "previdencia" && (
        <RetirementTable
          state={state}
          setState={setState}
          projection={projection}
        />
      )}
      {section === "rendas" && (
        <ExtraIncomeTable
          state={state}
          projection={projection}
          onAdd={incomeActions.add}
          onEdit={incomeActions.edit}
          onDelete={incomeActions.remove}
        />
      )}
      {section === "familia" && (
        <FamilyTable
          state={state}
          onAdd={dependentActions.add}
          onEdit={dependentActions.edit}
          onDelete={dependentActions.remove}
        />
      )}
    </div>
  );
}

function DeductionsView({
  state,
  setState,
  projection,
}: {
  state: TaxState;
  setState: React.Dispatch<React.SetStateAction<TaxState>>;
  projection: Projection;
}) {
  const setDeduction = (key: keyof TaxState["deductions"], value: number) =>
    setState((current) => ({
      ...current,
      deductions: { ...current.deductions, [key]: value },
    }));
  const dependentsTotal = state.dependents.reduce(
    (total, d) =>
      total +
      TAX_RULES_2026.dependentAnnual +
      Math.min(d.education, TAX_RULES_2026.educationAnnualPerBeneficiary) +
      d.medical,
    0,
  );
  const holder = projection.complete.deductions - dependentsTotal;
  return (
    <div className="deductions-layout">
      <div className="space-y-5">
        {" "}
        <Card className="p-6">
          <p className="section-kicker">Auditoria de deduções</p>
          <h2 className="mt-1 font-semibold text-white">
            Valores anuais comprováveis
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <MoneyInput
              label="Despesas médicas do titular"
              value={state.deductions.medical}
              onChange={(value) => setDeduction("medical", value)}
            />
            <MoneyInput
              label="Educação do titular"
              value={state.deductions.holderEducation}
              onChange={(value) => setDeduction("holderEducation", value)}
              helper={`Dedução limitada a ${formatBRL(TAX_RULES_2026.educationAnnualPerBeneficiary)}.`}
            />
            <MoneyInput
              label="Pensão judicial anual"
              value={state.deductions.judicialPension}
              onChange={(value) => setDeduction("judicialPension", value)}
            />
            <MoneyInput
              label="Outras deduções legais"
              value={state.deductions.otherLegal}
              onChange={(value) => setDeduction("otherLegal", value)}
            />
          </div>
        </Card>
        <Card className="p-5 text-sm text-slate-400 space-y-2">
          <h2>Auditoria de deduções</h2>
          <p>Saúde: apenas valores elegíveis, líquidos de reembolso.</p>
          <p>
            Educação: teto individual de{" "}
            {formatBRL(TAX_RULES_2026.educationAnnualPerBeneficiary)}.
          </p>
          <p>O INSS do 13º não é repetido no ajuste anual.</p>
          <p>
            Pensão e outras deduções anuais: informe somente valores adicionais
            aos holerites.
          </p>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="section-heading">
          <h2>Composição do modelo completo</h2>
        </div>
        <div className="audit-list">
          <h3>Deduções do titular</h3>
          {[
            ["INSS sujeito ao ajuste anual", projection.deductibleInss],
            ["Saúde", state.deductions.medical],
            [
              "Educação (limitada)",
              Math.min(
                state.deductions.holderEducation,
                TAX_RULES_2026.educationAnnualPerBeneficiary,
              ),
            ],
            ["PGBL próprio (limitado)", projection.pgbl.deductible],
            [
              "Pensão judicial (folha + adicional)",
              state.deductions.judicialPension +
                state.months.reduce((n, m) => n + m.pension, 0),
            ],
            [
              "Outras deduções + Livro Caixa admitido",
              holder -
                projection.deductibleInss -
                state.deductions.medical -
                Math.min(
                  state.deductions.holderEducation,
                  TAX_RULES_2026.educationAnnualPerBeneficiary,
                ) -
                projection.pgbl.deductible -
                state.deductions.judicialPension -
                state.months.reduce((n, m) => n + m.pension, 0),
            ],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>{formatBRL(Number(value))}</strong>
            </div>
          ))}
          <div>
            <span>Subtotal do titular</span>
            <strong>{formatBRL(holder)}</strong>
          </div>
          <h3>Deduções por dependente</h3>
          {state.dependents.length === 0 && (
            <p className="text-sm text-slate-400">
              Nenhum dependente cadastrado.
            </p>
          )}
          {state.dependents.map((d, i) => (
            <section className="dependent-breakdown" key={d.id}>
              <h4>{d.name || `Dependente ${i + 1}`}</h4>
              <dl>
                <div>
                  <dt>Dedução fixa</dt>
                  <dd>{formatBRL(TAX_RULES_2026.dependentAnnual)}</dd>
                </div>
                <div>
                  <dt>Saúde</dt>
                  <dd>{formatBRL(d.medical)}</dd>
                </div>
                <div>
                  <dt>Educação limitada</dt>
                  <dd>
                    {formatBRL(
                      Math.min(
                        d.education,
                        TAX_RULES_2026.educationAnnualPerBeneficiary,
                      ),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Subtotal</dt>
                  <dd>
                    {formatBRL(
                      TAX_RULES_2026.dependentAnnual +
                        d.medical +
                        Math.min(
                          d.education,
                          TAX_RULES_2026.educationAnnualPerBeneficiary,
                        ),
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          ))}
          <div className="text-emerald-300">
            <span>Total consolidado de deduções</span>
            <strong>{formatBRL(projection.complete.deductions)}</strong>
          </div>
        </div>
      </Card>
    </div>
  );
}

function OptimizerView({
  state,
  projection: currentProjection,
}: {
  state: TaxState;
  projection: Projection;
}) {
  const [extra, setExtra] = useState(0);
  const projection = useMemo(
    () => calculateProjection(state, extra),
    [state, extra],
  );
  const opportunity = useMemo(() => calculatePgblOpportunity(state), [state]);
  return (
    <div className="space-y-5">
      <div className="notice-row">
        <Info />
        Simulação separada dos aportes já realizados: não altera seus dados.
        Aportes reais são informados na seção Previdência.
      </div>
      <div className="result-ribbon">
        <span>
          Economia com o aporte simulado
          <strong>
            {formatBRL(
              Math.max(
                0,
                currentProjection.recommended.taxDue -
                  projection.recommended.taxDue,
              ),
            )}
          </strong>
        </span>
        <span>
          Saldo após simulação
          <strong>
            {formatBRL(Math.abs(projection.recommended.balance))} ·{" "}
            {projection.recommended.balance >= 0 ? "a restituir" : "a pagar"}
          </strong>
        </span>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-kicker">Aporte estratégico</p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                Margem PGBL até 12%
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                O limite usa somente rendimentos tributáveis sujeitos ao ajuste
                anual.
              </p>
            </div>
            <span className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
              <Leaf className="size-6" />
            </span>
          </div>
          <div className="mt-8">
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-slate-300">Aporte adicional simulado</span>
              <strong className="text-blue-300">
                {formatPercent(
                  projection.pgbl.limit
                    ? projection.pgbl.contributed / projection.pgbl.limit
                    : 0,
                )}{" "}
                do limite
              </strong>
            </div>
            <Input
              type="number"
              min={0}
              step={100}
              value={extra}
              onChange={(event) =>
                setExtra(Math.max(0, Number(event.target.value) || 0))
              }
              className="h-12 border-white/10 bg-[#0b1423] text-lg text-white"
            />
            <input
              aria-label="Aporte PGBL fora da folha"
              type="range"
              min={0}
              max={Math.max(1, Math.ceil(projection.pgbl.limit))}
              step={100}
              value={Math.min(extra, projection.pgbl.limit)}
              onChange={(event) => setExtra(Number(event.target.value))}
              className="pgbl-range mt-5 w-full"
            />
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="soft-stat">
              <span>Limite anual</span>
              <strong>{formatBRL(projection.pgbl.limit)}</strong>
            </div>
            <div className="soft-stat">
              <span>Já aportado</span>
              <strong>{formatBRL(projection.pgbl.contributed)}</strong>
            </div>
            <div className="soft-stat">
              <span>Margem disponível</span>
              <strong className="text-blue-300">
                {formatBRL(projection.pgbl.available)}
              </strong>
            </div>
          </div>
          {projection.pgbl.excess > 0 && (
            <div className="mt-5 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/8 p-4 text-sm text-amber-100">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <p>
                {formatBRL(projection.pgbl.excess)} excede o teto dedutível e
                não reduz adicionalmente a base.
              </p>
            </div>
          )}
        </Card>
        <Card className="relative overflow-hidden p-6">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative">
            <p className="section-kicker">Cenário-limite</p>
            <h2 className="mt-1 font-semibold text-white">
              Se utilizar toda a margem disponível
            </h2>
            <div className="mt-6 space-y-4">
              <div className="scenario-row">
                <span>Aporte adicional</span>
                <strong>{formatBRL(opportunity.current.pgbl.available)}</strong>
              </div>
              <div className="scenario-row">
                <span>Imposto completo atual</span>
                <strong>
                  {formatBRL(opportunity.current.complete.taxDue)}
                </strong>
              </div>
              <div className="scenario-row">
                <span>Imposto após aporte</span>
                <strong>
                  {formatBRL(opportunity.optimized.complete.taxDue)}
                </strong>
              </div>
              <div className="scenario-row border-t border-white/8 pt-4">
                <span>Economia vs. melhor modelo atual</span>
                <strong className="text-emerald-300">
                  + {formatBRL(opportunity.balanceGain)}
                </strong>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-blue-400/20 bg-blue-500/[.06] p-4 text-xs leading-5 text-slate-300">
              O benefício é diferimento tributário, não rentabilidade garantida.
              Avalie custos, liquidez e tributação no resgate. A dedução exige
              elegibilidade e contribuição à previdência oficial; aportes da
              empresa não são dedução pessoal.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DeclarationCard({
  result,
  recommended,
}: {
  result: Projection["complete"];
  recommended: boolean;
}) {
  const refund = result.balance >= 0;
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-6",
        recommended &&
          "border-emerald-400/40 shadow-[0_0_0_1px_rgb(79_140_255/12%),0_22px_60px_rgb(0_0_0/22%)]",
      )}
    >
      {recommended && (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          <Check className="size-3" />
          Mais vantajosa
        </span>
      )}
      <p className="section-kicker">Declaração</p>
      <h2 className="mt-1 text-xl font-semibold text-white">
        {result.model === "complete" ? "Completa" : "Simplificada"}
      </h2>
      <div className="mt-7 grid grid-cols-2 gap-4 border-y border-white/7 py-5">
        <div>
          <p className="metric-label">Imposto devido</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {formatBRL(result.taxDue)}
          </p>
        </div>
        <div>
          <p className="metric-label">Deduções</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {formatBRL(result.deductions)}
          </p>
        </div>
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-400">Renda no ajuste</dt>
          <dd>{formatBRL(result.grossTaxable)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Base líquida</dt>
          <dd>{formatBRL(result.taxableBase)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">IRRF + Carnê-Leão</dt>
          <dd>{formatBRL(result.prepaidTax)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Exclusivo (fora do ajuste)</dt>
          <dd>{formatBRL(result.exclusiveTax)}</dd>
        </div>
      </dl>
      <div
        className={cn(
          "mt-6 rounded-xl border p-4",
          refund
            ? "border-emerald-400/20 bg-emerald-400/8"
            : "border-amber-400/20 bg-amber-400/8",
        )}
      >
        <BalanceLabel balance={result.balance} />
        <p
          className={cn(
            "mt-1 text-2xl font-semibold",
            refund ? "text-emerald-300" : "text-amber-300",
          )}
        >
          {formatBRL(Math.abs(result.balance))}
        </p>
      </div>
    </Card>
  );
}

function ComparisonView({ projection }: { projection: Projection }) {
  const saving = Math.abs(
    projection.complete.taxDue - projection.simplified.taxDue,
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <DeclarationCard
          result={projection.simplified}
          recommended={projection.recommended.model === "simplified"}
        />
        <DeclarationCard
          result={projection.complete}
          recommended={projection.recommended.model === "complete"}
        />
      </div>
      <Card className="p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex gap-4">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <BadgeCheck className="size-5" />
            </span>
            <div>
              <p className="section-kicker">Diagnóstico</p>
              <h3 className="mt-1 font-semibold text-white">
                A declaração{" "}
                {projection.recommended.model === "complete"
                  ? "completa"
                  : "simplificada"}{" "}
                reduz o imposto em {formatBRL(saving)}.
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                O modelo vencedor é o que produz menor imposto devido. O saldo
                compara esse imposto com IRRF e Carnê-Leão já pagos.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[.025] px-5 py-4 text-right">
            <p className="metric-label">Diferença entre bases</p>
            <p className="mt-1 font-semibold text-slate-200">
              {formatBRL(
                Math.abs(
                  projection.complete.taxableBase -
                    projection.simplified.taxableBase,
                ),
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DashboardView({ projection }: { projection: Projection }) {
  const balance = projection.recommended.balance;
  const actualCount = projection.months.filter(
    (month) => month.status === "actual",
  ).length;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Renda bruta total"
          value={formatBRL(projection.totalGrossIncome, true)}
          helper={`${actualCount} meses realizados · ${12 - actualCount} projetados`}
          icon={WalletCards}
          tone="blue"
        />
        <MetricCard
          label="Base líquida projetada"
          value={formatBRL(projection.recommended.taxableBase, true)}
          helper={`Modelo ${projection.recommended.model === "complete" ? "completo" : "simplificado"}`}
          icon={Calculator}
          tone="slate"
        />
        <MetricCard
          label="INSS pago no ano"
          value={formatBRL(projection.annualInss, true)}
          helper="Folha, férias, 13º e rendas extras informadas"
          icon={ShieldCheck}
          tone="slate"
        />
        <MetricCard
          label="FGTS projetado"
          value={formatBRL(projection.totalFgts, true)}
          helper="8% sobre remunerações com incidência"
          icon={Landmark}
          tone="emerald"
        />
        <MetricCard
          label="IRRF retido"
          value={formatBRL(projection.totalWithheld, true)}
          helper={
            projection.totalCarneLeao > 0
              ? `+ ${formatBRL(projection.totalCarneLeaoPaid)} de Carnê-Leão pago`
              : "Retenções mensais e exclusivas"
          }
          icon={ReceiptText}
          tone="amber"
        />
        <MetricCard
          label={balance >= 0 ? "Restituição estimada" : "Imposto a pagar"}
          value={formatBRL(Math.abs(balance), true)}
          helper={<BalanceLabel balance={balance} />}
          icon={balance >= 0 ? ArrowUpRight : ArrowDownRight}
          tone={balance >= 0 ? "emerald" : "amber"}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,.75fr)]">
        <Card className="overflow-hidden">
          <div className="section-heading pb-1">
            <div>
              <p className="section-kicker">Fluxo mensal</p>
              <h2>Renda e retenção na fonte</h2>
            </div>
          </div>
          <div className="px-2 pb-2 sm:px-4">
            <ProjectionChart projection={projection} />
          </div>
        </Card>
        <Card className="relative overflow-hidden p-6">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative">
            <span className="inline-flex rounded-xl border border-blue-400/20 bg-blue-400/10 p-2.5 text-blue-300">
              <Sparkles className="size-5" />
            </span>
            <p className="section-kicker mt-5">Próxima melhor ação</p>
            <h2 className="mt-2 text-xl font-semibold leading-tight text-white">
              Ainda há {formatBRL(projection.pgbl.available, true)} de margem
              PGBL.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Simule o aporte antes do encerramento do ano e compare o efeito no
              modelo completo.
            </p>
            <Progress
              value={Math.min(
                100,
                projection.pgbl.limit
                  ? (projection.pgbl.contributed / projection.pgbl.limit) * 100
                  : 0,
              )}
              className="mt-6 bg-slate-800 [&>div]:bg-blue-400"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: typeof Gauge;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <Button
        variant="outline"
        onClick={onAction}
        className="border-white/10 bg-white/[.03] text-slate-200 hover:bg-white/[.07] hover:text-white"
      >
        <Plus />
        {action}
      </Button>
    </div>
  );
}

function InlineMoney({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Input
      aria-label={label}
      disabled={disabled}
      className="inline-money"
      type="number"
      min={0}
      step="0.01"
      value={value}
      onChange={(event) =>
        onChange(Math.max(0, Number(event.target.value) || 0))
      }
    />
  );
}

const payrollFields: Array<{
  key:
    | "salary"
    | "overtime"
    | "commission"
    | "otherTaxable"
    | "nonTaxable"
    | "pension"
    | "otherLegalDeductions"
    | "nonDeductiblePayroll";
  label: string;
}> = [
  { key: "salary", label: "Salário base" },
  { key: "overtime", label: "Horas extras" },
  { key: "commission", label: "Bônus e comissões" },
  { key: "otherTaxable", label: "Outros tributáveis" },
  { key: "nonTaxable", label: "Rendimentos isentos" },
  { key: "pension", label: "Pensão judicial" },
  { key: "otherLegalDeductions", label: "Outras deduções em folha" },
  { key: "nonDeductiblePayroll", label: "Descontos não dedutíveis na folha" },
];

function MonthDialog({
  open,
  month,
  state,
  onClose,
  onSave,
}: {
  open: boolean;
  month: PayrollMonth | null;
  state: TaxState;
  onClose: () => void;
  onSave: (month: PayrollMonth) => void;
}) {
  const [draft, setDraft] = useState<PayrollMonth | null>(
    month
      ? { ...month, commission: month.commission + month.bonus, bonus: 0 }
      : null,
  );
  const result = useMemo(
    () =>
      draft
        ? calculateProjection({
            ...state,
            months: state.months.map((m) =>
              m.month === draft.month ? draft : m,
            ),
          }).months[draft.month]
        : null,
    [state, draft],
  );
  if (!draft) return null;
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="dialog-wide">
        <DialogHeader>
          <DialogTitle>Editar {monthLabel(draft.month)}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Informe o holerite real ou mantenha os cálculos automáticos.
          </DialogDescription>
        </DialogHeader>
        <div className="result-ribbon">
          <span>
            INSS previsto
            <strong>{formatBRL(result?.inssCalculated ?? 0)}</strong>
          </span>
          <span>
            IRRF previsto
            <strong>{formatBRL(result?.irrfCalculated ?? 0)}</strong>
          </span>
          <span>
            Líquido projetado
            <strong>{formatBRL(result?.netIncome ?? 0)}</strong>
          </span>
        </div>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  status: event.target.value as PayrollMonth["status"],
                })
              }
              className="input-select"
            >
              <option value="actual">Realizado</option>
              <option value="projected">Projetado</option>
            </select>
          </label>
          <label className="field-label">
            <span>Dependentes na fonte</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={draft.dependents}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  dependents: Math.max(
                    0,
                    Math.floor(Number(event.target.value) || 0),
                  ),
                })
              }
            />
          </label>
        </div>
        {["Proventos", "Descontos"].map((group, i) => (
          <fieldset className="editor-fieldset" key={group}>
            <legend>{group}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {payrollFields
                .filter(
                  (f) =>
                    [
                      "pension",
                      "otherLegalDeductions",
                      "nonDeductiblePayroll",
                    ].includes(f.key) ===
                    (i === 1),
                )
                .map((field) => (
                  <MoneyInput
                    key={field.key}
                    label={field.label}
                    value={draft[field.key]}
                    onChange={(value) =>
                      setDraft({ ...draft, [field.key]: value })
                    }
                    helper={
                      field.key === "nonDeductiblePayroll"
                        ? "Plano de saúde, coparticipação, odontologia, empréstimos: afetam apenas o líquido. Despesas médicas elegíveis são lançadas separadamente em Deduções."
                        : undefined
                    }
                  />
                ))}
            </div>
          </fieldset>
        ))}
        <OverrideInput
          label="INSS do holerite"
          enabled={draft.inssOverrideEnabled}
          value={draft.actualInss}
          calculated={result?.inssCalculated ?? 0}
          onToggle={(v) =>
            setDraft({
              ...draft,
              inssOverrideEnabled: v,
              actualInss: draft.actualInss ?? result?.inssCalculated ?? 0,
            })
          }
          onChange={(v) => setDraft({ ...draft, actualInss: v })}
        />
        <OverrideInput
          label="IRRF do holerite"
          enabled={draft.irrfOverrideEnabled}
          value={draft.actualIrrf}
          calculated={result?.irrfCalculated ?? 0}
          onToggle={(v) =>
            setDraft({
              ...draft,
              irrfOverrideEnabled: v,
              actualIrrf: draft.actualIrrf ?? result?.irrfCalculated ?? 0,
            })
          }
          onChange={(v) => setDraft({ ...draft, actualIrrf: v })}
        />
        <p className="text-sm text-slate-400">
          PGBL e VGBL são configurados exclusivamente em Previdência.
        </p>
        <DialogFooter className="mt-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(draft)}
            className="bg-blue-500 text-white hover:bg-blue-400"
          >
            <Save />
            Salvar competência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VacationDialog({
  open,
  event,
  state,
  onClose,
  onSave,
}: {
  open: boolean;
  event: VacationEvent | null;
  state: TaxState;
  onClose: () => void;
  onSave: (event: VacationEvent) => void;
}) {
  const [draft, setDraft] = useState<VacationEvent | null>(event);
  const preview = useMemo(() => {
    if (!draft) return null;
    const exists = state.vacations.some((e) => e.id === draft.id);
    const vacations = exists
      ? state.vacations.map((e) => (e.id === draft.id ? draft : e))
      : [...state.vacations, draft];
    return calculateProjection({ ...state, vacations }).vacations.find(
      (e) => e.id === draft.id,
    )!;
  }, [state, draft]);
  if (!draft) return null;
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="dialog-wide">
        <DialogHeader>
          <DialogTitle>Evento de férias</DialogTitle>
          <DialogDescription className="text-slate-400">
            Férias gozadas são tributáveis; venda de dias e seu terço são
            isentos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            <span>Mês de gozo</span>
            <select
              value={draft.month}
              onChange={(event) =>
                setDraft({ ...draft, month: Number(event.target.value) })
              }
              className="input-select"
            >
              {Array.from({ length: 12 }, (_, month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </label>
          <MoneyInput
            label="Dias gozados"
            value={draft.daysTaken}
            onChange={(value) =>
              setDraft({ ...draft, daysTaken: Math.min(30, Math.floor(value)) })
            }
          />
          <MoneyInput
            label="Dias vendidos"
            value={draft.daysSold}
            onChange={(value) =>
              setDraft({ ...draft, daysSold: Math.min(10, Math.floor(value)) })
            }
          />
          <MoneyInput
            label="Médias tributáveis das férias"
            value={draft.taxableAverage}
            onChange={(value) => setDraft({ ...draft, taxableAverage: value })}
          />
          <MoneyInput
            label="Médias vinculadas ao abono"
            value={draft.abonoAverage}
            onChange={(value) => setDraft({ ...draft, abonoAverage: value })}
          />
        </div>
        <div className="override-box">
          <Toggle
            checked={draft.receivedAdvance}
            onChange={(value) => setDraft({ ...draft, receivedAdvance: value })}
            label="Recebeu adiantamento de férias"
          />
        </div>
        <OverrideInput
          label="INSS das férias"
          enabled={draft.inssOverrideEnabled}
          value={draft.actualInss}
          calculated={preview?.inssCalculated ?? 0}
          onToggle={(value) =>
            setDraft({
              ...draft,
              inssOverrideEnabled: value,
              actualInss: draft.actualInss ?? preview?.inssCalculated ?? 0,
            })
          }
          onChange={(value) => setDraft({ ...draft, actualInss: value })}
        />
        <OverrideInput
          label="IRRF das férias"
          enabled={draft.irrfOverrideEnabled}
          value={draft.actualIrrf}
          calculated={preview?.irrfCalculated ?? 0}
          onToggle={(value) =>
            setDraft({
              ...draft,
              irrfOverrideEnabled: value,
              actualIrrf: draft.actualIrrf ?? preview?.irrfCalculated ?? 0,
            })
          }
          onChange={(value) => setDraft({ ...draft, actualIrrf: value })}
        />
        <div className="result-ribbon">
          <span>
            Férias tributáveis
            <strong>{formatBRL(preview?.taxableGross ?? 0)}</strong>
          </span>
          <span>
            Abono isento<strong>{formatBRL(preview?.exemptGross ?? 0)}</strong>
          </span>
          <span>
            Líquido<strong>{formatBRL(preview?.netAdvance ?? 0)}</strong>
          </span>
        </div>
        <p className="text-sm text-slate-400">
          O INSS informado deve ser somente a parcela das férias, não o total do
          holerite. O adiantamento liquida a mesma verba de férias, sem
          descontar novamente o salário ordinário.
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(draft)}
            className="bg-blue-500 text-white hover:bg-blue-400"
          >
            <Save />
            Salvar férias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtraIncomeDialog({
  open,
  entry,
  onClose,
  onSave,
}: {
  open: boolean;
  entry: ExtraIncome | null;
  onClose: () => void;
  onSave: (entry: ExtraIncome) => void;
}) {
  const [draft, setDraft] = useState<ExtraIncome | null>(entry);
  if (!draft) return null;
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="dialog-wide">
        <DialogHeader>
          <DialogTitle>Renda extra tributável</DialogTitle>
          <DialogDescription className="text-slate-400">
            O tipo de pagador determina se há apuração mensal pelo Carnê-Leão.
          </DialogDescription>
        </DialogHeader>
        <label className="field-label">
          <span>Forma de lançamento</span>
          <select
            className="input-select"
            value={draft.entryMode}
            onChange={(e) =>
              setDraft({
                ...draft,
                entryMode: e.target.value as ExtraIncome["entryMode"],
              })
            }
          >
            <option value="monthly">Mensal · recebimento de um mês</option>
            <option value="annual">Anual direto · total do ano</option>
          </select>
        </label>
        {draft.entryMode === "annual" && (
          <div className="notice-row">
            <Info />
            Informe os totais anuais, sem multiplicar por 12. Sem discriminar os
            meses, só o ajuste anual é projetado; o Carnê-Leão mensal fica
            pendente de apuração.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {draft.entryMode === "monthly" && (
            <label className="field-label">
              <span>Mês do recebimento</span>
              <select
                value={draft.month}
                onChange={(event) =>
                  setDraft({ ...draft, month: Number(event.target.value) })
                }
                className="input-select"
              >
                {Array.from({ length: 12 }, (_, month) => (
                  <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field-label">
            <span>Tipo de renda</span>
            <select
              value={draft.type}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  type: event.target.value as ExtraIncome["type"],
                })
              }
              className="input-select"
            >
              <option value="rent">Aluguel</option>
              <option value="proLabore">Pró-labore</option>
              <option value="services">Prestação de serviços PF</option>
            </select>
          </label>
          <label className="field-label">
            <span>Tipo de pagador</span>
            <select
              value={draft.payerType}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  payerType: event.target.value as ExtraIncome["payerType"],
                })
              }
              className="input-select"
            >
              <option value="individual">Pessoa física</option>
              <option value="legalEntity">Pessoa jurídica</option>
              <option value="abroad">Exterior</option>
            </select>
          </label>
          <label className="field-label">
            <span>Descrição</span>
            <Input
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              placeholder="Ex.: aluguel do apartamento"
            />
          </label>
          <MoneyInput
            label="Valor bruto"
            value={draft.gross}
            onChange={(value) => setDraft({ ...draft, gross: value })}
          />
          <MoneyInput
            label={
              draft.type === "rent"
                ? "Encargos excluídos do aluguel"
                : "Despesas de Livro Caixa"
            }
            value={draft.deductibleExpenses}
            onChange={(value) =>
              setDraft({ ...draft, deductibleExpenses: value })
            }
            helper={
              draft.type === "rent"
                ? "Aluguel: condomínio, IPTU e taxa de administração quando o ônus é do locador, com comprovantes. Reparos e parcelas de financiamento não são exclusões automáticas."
                : draft.type === "services"
                  ? "Serviços: despesas necessárias, escrituradas em Livro Caixa. O limite mensal e o excedente são transportados até dezembro. Valores anuais exigem conferência do livro."
                  : "Pró-labore: não admite despesas genéricas de Livro Caixa; use INSS efetivamente recolhido."
            }
          />
          <MoneyInput
            label="INSS recolhido"
            value={draft.inss}
            onChange={(value) => setDraft({ ...draft, inss: value })}
          />
          {draft.payerType === "legalEntity" && (
            <MoneyInput
              label="IRRF já retido"
              value={draft.withheldIrrf}
              onChange={(value) => setDraft({ ...draft, withheldIrrf: value })}
            />
          )}
        </div>
        {draft.payerType !== "legalEntity" && (
          <div className="space-y-4">
            <Toggle
              label="Carnê-Leão foi pago mensalmente?"
              checked={draft.carneLeaoPaid}
              onChange={(v) => setDraft({ ...draft, carneLeaoPaid: v })}
            />
            {draft.carneLeaoPaid && (
              <MoneyInput
                label={
                  draft.entryMode === "annual"
                    ? "Principal efetivamente pago no ano"
                    : "Principal efetivamente pago neste lançamento"
                }
                value={draft.carneLeaoPaidAmount}
                onChange={(v) => setDraft({ ...draft, carneLeaoPaidAmount: v })}
                helper="Não inclua multa ou juros. Se houver várias rendas no mesmo mês, registre cada DARF uma única vez."
              />
            )}
            <div className="notice-row">
              <Info />
              Não pagar o Carnê-Leão não muda a renda tributável. Muda o crédito
              de imposto pago no ajuste anual. Pendências podem gerar multa e
              juros; confira os vencimentos e regularize no Sicalc.
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(draft)}
            className="bg-blue-500 text-white hover:bg-blue-400"
          >
            <Save />
            Salvar renda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DependentDialog({
  open,
  dependent,
  onClose,
  onSave,
}: {
  open: boolean;
  dependent: Dependent | null;
  onClose: () => void;
  onSave: (dependent: Dependent) => void;
}) {
  const [draft, setDraft] = useState<Dependent | null>(dependent);
  if (!draft) return null;
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="dialog-wide">
        <DialogHeader>
          <DialogTitle>Dependente</DialogTitle>
          <DialogDescription className="text-slate-400">
            Ao incluir um dependente, todos os rendimentos tributáveis dele
            também devem entrar na declaração.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label sm:col-span-2">
            <span>Nome ou identificação</span>
            <Input
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              placeholder="Ex.: Filho 1"
            />
          </label>
          <MoneyInput
            label="Despesas com educação"
            value={draft.education}
            onChange={(value) => setDraft({ ...draft, education: value })}
          />
          <MoneyInput
            label="Despesas médicas"
            value={draft.medical}
            onChange={(value) => setDraft({ ...draft, medical: value })}
          />
        </div>
        <div className="override-box">
          <Toggle
            checked={draft.hasTaxableIncome}
            onChange={(value) =>
              setDraft({
                ...draft,
                hasTaxableIncome: value,
              })
            }
            label="Possui renda tributável"
          />
          {draft.hasTaxableIncome && (
            <MoneyInput
              label="Renda tributável anual"
              value={draft.taxableIncome}
              onChange={(value) => setDraft({ ...draft, taxableIncome: value })}
            />
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(draft)}
            className="bg-blue-500 text-white hover:bg-blue-400"
          >
            <Save />
            Salvar dependente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaxApp() {
  const [state, setState] = useState<TaxState>(createInitialState);
  const [view, setView] = useState<View>("dashboard");
  const [dataSection, setDataSection] = useState<DataSection>("holerites");
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Carregando");
  const [savedState, setSavedState] = useState<TaxState | null>(null);
  const [storageError, setStorageError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editingVacation, setEditingVacation] = useState<number | "new" | null>(
    null,
  );
  const [editingIncome, setEditingIncome] = useState<number | "new" | null>(
    null,
  );
  const [editingDependent, setEditingDependent] = useState<
    number | "new" | null
  >(null);
  const projection = useMemo(() => calculateProjection(state), [state]);
  const latestState = useRef(state);

  useEffect(() => {
    latestState.current = state;
  }, [state]);
  useEffect(() => {
    const onHistoryChange = () => {
      setView(parseHash());
      const hash = window.location.hash.slice(1);
      if (dataSections.some((item) => item.id === hash))
        setDataSection(hash as DataSection);
    };
    onHistoryChange();
    window.addEventListener("hashchange", onHistoryChange);
    window.addEventListener("popstate", onHistoryChange);
    loadTaxState()
      .then((saved) => {
        if (saved) setState(migrateTaxState(saved));
        setHydrated(true);
      })
      .catch(() => {
        setStorageError(
          "Não foi possível carregar o plano local. O salvamento está suspenso para preservar seus dados. Reabra o site ou exporte os valores antes de sair.",
        );
        setSaveStatus("Falha ao carregar");
      });
    return () => {
      window.removeEventListener("hashchange", onHistoryChange);
      window.removeEventListener("popstate", onHistoryChange);
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    let current = true;
    void saveTaxState(state)
      .then(() => {
        if (current) {
          setSaveStatus("Salvo localmente");
          setSavedState(state);
          setStorageError("");
        }
      })
      .catch(() => {
        if (current) {
          setSaveStatus("Não salvo");
          setStorageError(
            "Não foi possível salvar neste navegador. Exporte os dados antes de sair.",
          );
        }
      });
    return () => {
      current = false;
    };
  }, [state, hydrated]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: WebMcpTool) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => undefined);
      } catch {
        /* Navegadores sem WebMCP continuam funcionando. */
      }
    };
    register({
      name: "read_tax_projection",
      title: "Ler projeção do IRPF",
      description: "Retorna o fechamento anual atual do Pondera Tax.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => {
        const result = calculateProjection(latestState.current);
        return {
          taxYear: 2026,
          model: result.recommended.model,
          totalGrossIncome: result.totalGrossIncome,
          taxableBase: result.recommended.taxableBase,
          taxDue: result.recommended.taxDue,
          prepaid: result.totalPrepaid,
          balance: result.recommended.balance,
          pgblAvailable: result.pgbl.available,
        };
      },
    });
    register({
      name: "update_monthly_payroll",
      title: "Atualizar holerite mensal",
      description: "Atualiza valores centrais de uma competência.",
      inputSchema: {
        type: "object",
        properties: {
          month: { type: "integer", minimum: 1, maximum: 12 },
          salary: { type: "number", minimum: 0 },
          actualIrrf: { type: ["number", "null"], minimum: 0 },
          status: { type: "string", enum: ["actual", "projected"] },
        },
        required: ["month"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as {
          month: number;
          salary?: number;
          actualIrrf?: number | null;
          status?: PayrollMonth["status"];
        };
        if (
          !Number.isInteger(value.month) ||
          value.month < 1 ||
          value.month > 12
        )
          throw new Error("month deve estar entre 1 e 12");
        let updated = latestState.current;
        setState((current) => {
          const months = current.months.map((month, index) =>
            index === value.month - 1
              ? {
                  ...month,
                  ...(value.salary === undefined
                    ? {}
                    : { salary: value.salary }),
                  ...(value.actualIrrf === undefined
                    ? {}
                    : {
                        actualIrrf: value.actualIrrf,
                        irrfOverrideEnabled: value.actualIrrf !== null,
                      }),
                  ...(value.status === undefined
                    ? {}
                    : { status: value.status }),
                }
              : month,
          );
          updated = { ...current, months };
          latestState.current = updated;
          return updated;
        });
        await saveTaxState(updated);
        return { success: true, month: value.month };
      },
    });
    return () => lifecycle.abort();
  }, []);

  const navigate = (next: View, section?: DataSection) => {
    if (section) setDataSection(section);
    window.history.pushState(null, "", `#${section ?? next}`);
    setView(next);
    setMobileMenu(false);
  };
  const saveMonth = (month: PayrollMonth) => {
    setState((current) => ({
      ...current,
      months: current.months.map((item, index) =>
        index === editingMonth ? month : item,
      ),
    }));
    setEditingMonth(null);
  };
  const currentVacation = useMemo(
    () =>
      editingVacation === "new"
        ? createVacation()
        : typeof editingVacation === "number"
          ? state.vacations[editingVacation]
          : null,
    [editingVacation, state.vacations],
  );
  const currentIncome = useMemo(
    () =>
      editingIncome === "new"
        ? createExtraIncome()
        : typeof editingIncome === "number"
          ? state.extraIncome[editingIncome]
          : null,
    [editingIncome, state.extraIncome],
  );
  const currentDependent = useMemo(
    () =>
      editingDependent === "new"
        ? createDependent()
        : typeof editingDependent === "number"
          ? state.dependents[editingDependent]
          : null,
    [editingDependent, state.dependents],
  );
  const saveVacation = (event: VacationEvent) => {
    setState((current) => ({
      ...current,
      vacations:
        editingVacation === "new"
          ? [...current.vacations, event]
          : current.vacations.map((item, index) =>
              index === editingVacation ? event : item,
            ),
    }));
    setEditingVacation(null);
  };
  const saveIncome = (entry: ExtraIncome) => {
    setState((current) => ({
      ...current,
      extraIncome:
        editingIncome === "new"
          ? [...current.extraIncome, entry]
          : current.extraIncome.map((item, index) =>
              index === editingIncome ? entry : item,
            ),
    }));
    setEditingIncome(null);
  };
  const saveDependent = (dependent: Dependent) => {
    setState((current) => ({
      ...current,
      dependents:
        editingDependent === "new"
          ? [...current.dependents, dependent]
          : current.dependents.map((item, index) =>
              index === editingDependent ? dependent : item,
            ),
    }));
    setEditingDependent(null);
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "pondera-tax-2026-v1.2.json";
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="min-h-screen">
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={cn("sidebar-shell", mobileMenu && "sidebar-open")}>
        <div className="flex items-center gap-3 px-2">
          <span className="brand-mark">
            <span>P</span>
          </span>
          <div>
            <strong className="block text-sm text-white">Pondera</strong>
            <span className="text-[10px] tracking-[.18em] text-slate-500">
              TAX
            </span>
          </div>
        </div>
        <nav className="sidebar-navigation" aria-label="Navegação principal">
          <p className="nav-group-label">DADOS DO ANO</p>
          {dataSections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate("dados", item.id)}
                aria-current={
                  view === "dados" && dataSection === item.id
                    ? "page"
                    : undefined
                }
                className={cn(
                  "nav-item",
                  view === "dados" &&
                    dataSection === item.id &&
                    "nav-item-active",
                )}
              >
                <Icon />
                {item.label}
              </button>
            );
          })}
          <p className="nav-group-label">ANÁLISE TRIBUTÁRIA</p>
          {[
            "deducoes",
            "otimizacao",
            "comparativo",
            "dashboard",
            "tabelas",
          ].map((id) => {
            const item = navigation.find((item) => item.id === id)!;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-current={view === item.id ? "page" : undefined}
                className={cn(
                  "nav-item",
                  view === item.id && "nav-item-active",
                )}
              >
                <Icon />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-white/7 bg-white/[.025] p-4">
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <ShieldCheck className="size-4" />
            Dados somente neste dispositivo
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            Salvamento automático no navegador.
          </p>
        </div>
      </aside>
      <header className="topbar">
        <button
          className="icon-button lg:hidden"
          onClick={() => setMobileMenu((value) => !value)}
          aria-label="Abrir menu"
        >
          <Menu />
        </button>
        <div className="ml-3 min-w-0 lg:ml-0">
          <span className="block truncate text-xs font-medium text-slate-200">
            Pondera Tax
          </span>
          <span className="block text-[10px] text-slate-500">
            Ano-calendário 2026 · Exercício 2027
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 text-[11px] text-slate-500 sm:flex">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                hydrated ? "bg-emerald-400" : "bg-amber-400",
              )}
            />
            {saveStatus === "Salvo localmente" && savedState !== state ? "Salvando…" : saveStatus}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={exportData}
            className="border-white/8 bg-white/[.02] text-slate-300 hover:bg-white/[.06] hover:text-white"
          >
            <Download />
            Exportar
          </Button>
        </div>
      </header>
      <main className="pb-10 lg:ml-[236px]">
        <div className="sticky-kpis" aria-label="Resumo tributário">
          <div>
            <span>Renda bruta total</span>
            <strong>{formatBRL(projection.totalGrossIncome)}</strong>
          </div>
          {[projection.simplified, projection.complete].map((result) => (
            <div
              key={result.model}
              className={cn(
                "kpi-model",
                result.taxDue === projection.recommended.taxDue &&
                  "kpi-optimal",
              )}
            >
              <span>
                {result.model === "complete" ? "Completa" : "Simplificada"}
                {result.taxDue === projection.recommended.taxDue
                  ? " · melhor resultado"
                  : ""}
              </span>
              <strong>{formatBRL(Math.abs(result.balance))}</strong>
              <small>
                {result.balance === 0
                  ? "Sem saldo"
                  : result.balance > 0
                    ? "A restituir"
                    : "A pagar"}
              </small>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">{titles[view].eyebrow}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
                {titles[view].title}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {titles[view].description}
              </p>
            </div>
            <span className="rounded-full border border-white/8 bg-white/[.025] px-3 py-1.5 text-[11px] text-slate-400">
              Versão 1.2.0
            </span>
          </div>
          {view === "dados" && (
            <DataView
              state={state}
              setState={setState}
              projection={projection}
              section={dataSection}
              onEditMonth={setEditingMonth}
              vacationActions={{
                add: () => setEditingVacation("new"),
                edit: setEditingVacation,
                remove: (index) =>
                  setState((current) => ({
                    ...current,
                    vacations: current.vacations.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })),
              }}
              incomeActions={{
                add: () => setEditingIncome("new"),
                edit: setEditingIncome,
                remove: (index) =>
                  setState((current) => ({
                    ...current,
                    extraIncome: current.extraIncome.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })),
              }}
              dependentActions={{
                add: () => setEditingDependent("new"),
                edit: setEditingDependent,
                remove: (index) =>
                  setState((current) => ({
                    ...current,
                    dependents: current.dependents.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })),
              }}
            />
          )}
          {view === "tabelas" && <TaxReference />}
          {view === "deducoes" && (
            <DeductionsView
              state={state}
              setState={setState}
              projection={projection}
            />
          )}
          {view === "otimizacao" && (
            <OptimizerView state={state} projection={projection} />
          )}
          {view === "comparativo" && <ComparisonView projection={projection} />}
          {view === "dashboard" && <DashboardView projection={projection} />}
          {storageError && (
            <div role="alert" className="notice-row mt-4">
              {storageError}
            </div>
          )}
          {projection.warnings.map((warning) => (
            <div role="status" className="notice-row mt-4" key={warning}>
              <Info />
              {warning}
            </div>
          ))}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
            <span>
              Estimativa para planejamento. Confira os informes de rendimentos
              antes da declaração.
            </span>
            <button
              onClick={() => {
                if (window.confirm("Restaurar os dados de exemplo da V1.2?"))
                  setState(createInitialState());
              }}
              className="inline-flex items-center gap-1.5 hover:text-slate-400"
            >
              <RotateCcw className="size-3" />
              Restaurar exemplo
            </button>
          </div>
        </div>
      </main>
      <MonthDialog
        key={`month-${editingMonth ?? "closed"}`}
        open={editingMonth !== null}
        month={editingMonth === null ? null : state.months[editingMonth]}
        state={state}
        onClose={() => setEditingMonth(null)}
        onSave={saveMonth}
      />
      <VacationDialog
        key={`vacation-${editingVacation ?? "closed"}`}
        open={editingVacation !== null}
        event={currentVacation}
        state={state}
        onClose={() => setEditingVacation(null)}
        onSave={saveVacation}
      />
      <ExtraIncomeDialog
        key={`income-${editingIncome ?? "closed"}`}
        open={editingIncome !== null}
        entry={currentIncome}
        onClose={() => setEditingIncome(null)}
        onSave={saveIncome}
      />
      <DependentDialog
        key={`dependent-${editingDependent ?? "closed"}`}
        open={editingDependent !== null}
        dependent={currentDependent}
        onClose={() => setEditingDependent(null)}
        onSave={saveDependent}
      />
    </div>
  );
}
