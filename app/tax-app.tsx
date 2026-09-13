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
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Calculator,
  Check,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Gauge,
  Info,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  Menu,
  Pencil,
  PiggyBank,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
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
import { TAX_RULES_2026 } from "@/lib/tax/rules-2026";
import { createInitialState, monthLabel } from "@/lib/tax/seed";
import type { PayrollMonth, Projection, TaxState } from "@/lib/tax/types";

type View =
  "dashboard" | "holerites" | "comparativo" | "pgbl" | "configuracoes";

const navigation: Array<{
  id: View;
  label: string;
  short: string;
  icon: typeof Gauge;
}> = [
  {
    id: "dashboard",
    label: "Visão geral",
    short: "Início",
    icon: LayoutDashboard,
  },
  {
    id: "holerites",
    label: "Holerites",
    short: "Holerites",
    icon: FileSpreadsheet,
  },
  {
    id: "comparativo",
    label: "Comparativo",
    short: "Modelos",
    icon: BarChart3,
  },
  { id: "pgbl", label: "Otimização PGBL", short: "PGBL", icon: PiggyBank },
  {
    id: "configuracoes",
    label: "Parâmetros",
    short: "Ajustes",
    icon: Settings2,
  },
];

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
  const hash = window.location.hash.replace("#", "") as View;
  return navigation.some((item) => item.id === hash) ? hash : "dashboard";
};

const titles: Record<
  View,
  { eyebrow: string; title: string; description: string }
> = {
  dashboard: {
    eyebrow: "Projeção anual",
    title: "Seu IR, antes da declaração.",
    description:
      "Acompanhe retenções, compare modelos e antecipe o ajuste anual.",
  },
  holerites: {
    eyebrow: "Base mensal",
    title: "Holerites de 2026",
    description:
      "Edite rendimentos, descontos oficiais e o IRRF de cada competência.",
  },
  comparativo: {
    eyebrow: "Declaração de ajuste",
    title: "Simplificada ou completa?",
    description: "Veja qual modelo reduz legalmente o imposto projetado.",
  },
  pgbl: {
    eyebrow: "Planejamento tributário",
    title: "O espaço que ainda existe no PGBL.",
    description:
      "Simule aportes dentro do limite de 12% e veja o efeito no ajuste.",
  },
  configuracoes: {
    eyebrow: "Regras e dados anuais",
    title: "Parâmetros da projeção",
    description:
      "Confira eventos exclusivos, deduções e as tabelas usadas pelo motor.",
  },
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
  const refund = balance >= 0;
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
          <p className="mt-3 text-[clamp(1.35rem,2vw,1.8rem)] font-semibold tracking-[-0.035em] text-white">
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
            type="monotone"
            dataKey="renda"
            stroke="#6397ff"
            strokeWidth={2}
            fill="url(#grossGradient)"
          />
          <Area
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

function DashboardView({
  projection,
  onNavigate,
  onEditMonth,
}: {
  projection: Projection;
  onNavigate: (view: View) => void;
  onEditMonth: (index: number) => void;
}) {
  const balance = projection.recommended.balance;
  const refund = balance >= 0;
  const actualCount = projection.months.filter(
    (month) => month.status === "actual",
  ).length;
  const retentionRate = projection.recommended.taxDue
    ? projection.totalWithheld / projection.recommended.taxDue
    : 1;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Renda bruta projetada"
          value={formatBRL(projection.recommended.grossTaxable, true)}
          helper={`${actualCount} meses realizados · ${12 - actualCount} projetados`}
          icon={WalletCards}
          tone="blue"
        />
        <MetricCard
          label="IRRF total"
          value={formatBRL(projection.totalWithheld, true)}
          helper={`${formatPercent(retentionRate)} do imposto estimado já retido`}
          icon={ShieldCheck}
          tone="slate"
        />
        <MetricCard
          label="IRPF devido"
          value={formatBRL(projection.recommended.taxDue, true)}
          helper={`Modelo ${projection.recommended.model === "complete" ? "completo" : "simplificado"} recomendado`}
          icon={Calculator}
          tone="amber"
        />
        <MetricCard
          label={refund ? "Restituição estimada" : "Saldo estimado"}
          value={formatBRL(Math.abs(balance), true)}
          helper={<BalanceLabel balance={balance} />}
          icon={refund ? ArrowUpRight : ArrowDownRight}
          tone={refund ? "emerald" : "amber"}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 p-5 pb-1 sm:p-6 sm:pb-1">
            <div>
              <p className="section-kicker">Fluxo tributável</p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Renda e retenção ao longo do ano
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2">
                <i className="h-2 w-2 rounded-full bg-blue-400" />
                Renda
              </span>
              <span className="inline-flex items-center gap-2">
                <i className="h-2 w-2 rounded-full bg-emerald-400" />
                IRRF
              </span>
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
              Ainda há {formatBRL(projection.pgbl.available, true)} de espaço
              fiscal.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Um aporte elegível em PGBL pode reduzir a base da declaração
              completa, respeitando o teto legal.
            </p>
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-xs text-slate-400">
                <span>PGBL utilizado</span>
                <span>
                  {formatPercent(
                    projection.pgbl.limit
                      ? projection.pgbl.contributed / projection.pgbl.limit
                      : 0,
                  )}
                </span>
              </div>
              <Progress
                value={Math.min(
                  100,
                  projection.pgbl.limit
                    ? (projection.pgbl.contributed / projection.pgbl.limit) *
                        100
                    : 0,
                )}
                className="bg-slate-800 [&>div]:bg-blue-400"
              />
            </div>
            <Button
              onClick={() => onNavigate("pgbl")}
              className="mt-6 w-full bg-blue-500 text-white hover:bg-blue-400"
            >
              Simular aporte <ArrowRight />
            </Button>
          </div>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/7 px-5 py-4 sm:px-6">
          <div>
            <p className="section-kicker">Competências</p>
            <h2 className="mt-1 font-semibold text-white">
              Últimos meses e projeções
            </h2>
          </div>
          <button
            className="link-button"
            onClick={() => onNavigate("holerites")}
          >
            Ver os 12 meses <ChevronRight />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Status</th>
                <th>Renda tributável</th>
                <th>INSS</th>
                <th>IRRF usado</th>
                <th className="text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {projection.months.slice(6, 12).map((month) => (
                <tr key={month.id}>
                  <td className="font-medium text-slate-200">
                    {monthLabel(month.month)}
                  </td>
                  <td>
                    <StatusBadge status={month.status} />
                  </td>
                  <td>{formatBRL(month.grossTaxable)}</td>
                  <td>{formatBRL(month.inssUsed)}</td>
                  <td>{formatBRL(month.irrfUsed)}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PayrollView({
  projection,
  onEditMonth,
}: {
  projection: Projection;
  onEditMonth: (index: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/7 px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold text-white">
            12 competências + eventos exclusivos
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Valores em azul são projetados; substitua pelo holerite assim que
            disponível.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <StatusBadge status="actual" />
          <StatusBadge status="projected" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[900px]">
          <thead>
            <tr>
              <th>Competência</th>
              <th>Status</th>
              <th>Salário</th>
              <th>Extras e eventos</th>
              <th>Base tributável</th>
              <th>INSS</th>
              <th>IRRF retido</th>
              <th className="text-right">Editar</th>
            </tr>
          </thead>
          <tbody>
            {projection.months.map((month) => {
              const extras = month.grossTaxable - month.salary;
              return (
                <tr key={month.id}>
                  <td>
                    <div className="font-medium text-slate-200">
                      {monthLabel(month.month)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {month.id}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={month.status} />
                  </td>
                  <td>{formatBRL(month.salary)}</td>
                  <td className={extras > 0 ? "text-blue-300" : ""}>
                    {formatBRL(extras)}
                  </td>
                  <td className="font-medium text-slate-200">
                    {formatBRL(month.grossTaxable)}
                  </td>
                  <td>
                    {formatBRL(month.inssUsed)}
                    {month.actualInss !== null && (
                      <span className="ml-1 text-[10px] text-emerald-400">
                        real
                      </span>
                    )}
                  </td>
                  <td>
                    {formatBRL(month.irrfUsed)}
                    {month.actualIrrf !== null && (
                      <span className="ml-1 text-[10px] text-emerald-400">
                        real
                      </span>
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
          </tbody>
        </table>
      </div>
    </Card>
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
          "border-blue-400/40 shadow-[0_0_0_1px_rgb(79_140_255/12%),0_22px_60px_rgb(0_0_0/22%)]",
      )}
    >
      {recommended && (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-blue-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          <Check className="size-3" />
          Recomendado
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
          <dt className="text-slate-400">Renda tributável</dt>
          <dd>{formatBRL(result.grossTaxable)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Base após deduções</dt>
          <dd>{formatBRL(result.taxableBase)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">IRRF + exclusivos</dt>
          <dd>{formatBRL(result.withheld)}</dd>
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
                economiza {formatBRL(saving)}.
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                A comparação usa a mesma renda e retenção. Só muda o conjunto de
                deduções aplicado à base anual.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[.025] px-5 py-4 text-right">
            <p className="metric-label">Diferença de base</p>
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

function PgblView({
  state,
  projection,
  onPgblChange,
}: {
  state: TaxState;
  projection: Projection;
  onPgblChange: (value: number) => void;
}) {
  const opportunity = useMemo(() => calculatePgblOpportunity(state), [state]);
  const current = state.deductions.pgblDirect;
  const usePercent = projection.pgbl.limit
    ? Math.min(100, (projection.pgbl.contributed / projection.pgbl.limit) * 100)
    : 0;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(330px,.8fr)]">
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Limite dedutível</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
              {formatBRL(projection.pgbl.limit)}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              12% da renda tributável sujeita ao ajuste anual.
            </p>
          </div>
          <span className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
            <Leaf className="size-6" />
          </span>
        </div>
        <div className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-4">
            <label
              htmlFor="pgbl"
              className="text-sm font-medium text-slate-200"
            >
              Aportes PGBL no ano
            </label>
            <span className="text-sm font-semibold text-blue-300">
              {formatPercent(usePercent)} do limite
            </span>
          </div>
          <Input
            id="pgbl"
            type="number"
            min={0}
            step={100}
            value={current}
            onChange={(event) => onPgblChange(Number(event.target.value) || 0)}
            className="h-12 border-white/10 bg-[#0b1423] text-lg text-white"
          />
          <input
            aria-label="Aporte PGBL"
            type="range"
            min={0}
            max={Math.max(1, Math.ceil(projection.pgbl.limit))}
            step={100}
            value={Math.min(current, projection.pgbl.limit)}
            onChange={(event) => onPgblChange(Number(event.target.value))}
            className="pgbl-range mt-5 w-full"
          />
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            <span>R$ 0</span>
            <span>{formatBRL(projection.pgbl.limit, true)}</span>
          </div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
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
          <div className="soft-stat">
            <span>Economia potencial</span>
            <strong className="text-emerald-300">
              {formatBRL(opportunity.taxSavings)}
            </strong>
          </div>
        </div>
        {projection.pgbl.excess > 0 && (
          <div className="mt-5 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/8 p-4 text-sm text-amber-100">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-300" />
            <p>
              {formatBRL(projection.pgbl.excess)} excede o limite dedutível e
              não reduz adicionalmente a base de IRPF.
            </p>
          </div>
        )}
      </Card>
      <div className="space-y-5">
        <Card className="p-6">
          <p className="section-kicker">Cenário máximo dedutível</p>
          <h3 className="mt-1 font-semibold text-white">
            Se você usar toda a margem
          </h3>
          <div className="mt-6 space-y-4">
            <div className="scenario-row">
              <span>Aporte adicional</span>
              <strong>{formatBRL(opportunity.current.pgbl.available)}</strong>
            </div>
            <div className="scenario-row">
              <span>Imposto completo hoje</span>
              <strong>{formatBRL(opportunity.current.complete.taxDue)}</strong>
            </div>
            <div className="scenario-row">
              <span>Imposto após aporte</span>
              <strong>
                {formatBRL(opportunity.optimized.complete.taxDue)}
              </strong>
            </div>
            <div className="scenario-row border-t border-white/8 pt-4">
              <span className="text-slate-200">Ganho no saldo</span>
              <strong className="text-emerald-300">
                + {formatBRL(opportunity.balanceGain)}
              </strong>
            </div>
          </div>
        </Card>
        <Card className="border-blue-400/20 bg-blue-500/[.06] p-5">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-300" />
            <div>
              <p className="font-medium text-blue-100">
                Simulação, não recomendação de investimento
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                A dedução depende do modelo completo e das condições legais.
                Valide custos e perfil de risco antes do aporte.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}

function SettingsView({
  state,
  setState,
  onReset,
}: {
  state: TaxState;
  setState: React.Dispatch<React.SetStateAction<TaxState>>;
  onReset: () => void;
}) {
  const setEvent = (key: keyof TaxState["events"], value: number | null) =>
    setState((current) => ({
      ...current,
      events: { ...current.events, [key]: value },
    }));
  const setDeduction = (
    key: "medical" | "judicialPension" | "otherLegal",
    value: number,
  ) =>
    setState((current) => ({
      ...current,
      deductions: { ...current.deductions, [key]: value },
    }));
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "pondera-tax-2026.json";
    anchor.click();
    URL.revokeObjectURL(href);
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="p-6">
        <p className="section-kicker">Eventos exclusivos</p>
        <h2 className="mt-1 font-semibold text-white">13º salário e PLR</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <MoneyInput
            label="13º bruto"
            value={state.events.thirteenthGross}
            onChange={(value) => setEvent("thirteenthGross", value)}
          />
          <MoneyInput
            label="INSS do 13º"
            value={state.events.thirteenthInss}
            onChange={(value) => setEvent("thirteenthInss", value)}
          />
          <MoneyInput
            label="IRRF do 13º (0 = cálculo)"
            value={state.events.thirteenthIrrf ?? 0}
            onChange={(value) => setEvent("thirteenthIrrf", value || null)}
          />
          <MoneyInput
            label="PLR bruta"
            value={state.events.plrGross}
            onChange={(value) => setEvent("plrGross", value)}
          />
          <MoneyInput
            label="IRRF da PLR (0 = cálculo)"
            value={state.events.plrIrrf ?? 0}
            onChange={(value) => setEvent("plrIrrf", value || null)}
          />
        </div>
      </Card>
      <Card className="p-6">
        <p className="section-kicker">Deduções anuais</p>
        <h2 className="mt-1 font-semibold text-white">Modelo completo</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <MoneyInput
            label="Despesas médicas"
            value={state.deductions.medical}
            onChange={(value) => setDeduction("medical", value)}
          />
          <MoneyInput
            label="Pensão judicial"
            value={state.deductions.judicialPension}
            onChange={(value) => setDeduction("judicialPension", value)}
          />
          <MoneyInput
            label="Outras deduções legais comprovadas"
            value={state.deductions.otherLegal}
            onChange={(value) => setDeduction("otherLegal", value)}
          />
          <MoneyInput
            label="Educação — beneficiário 1"
            value={state.deductions.educationByBeneficiary[0] ?? 0}
            onChange={(value) =>
              setState((current) => ({
                ...current,
                deductions: {
                  ...current.deductions,
                  educationByBeneficiary: [value],
                },
              }))
            }
          />
          <label className="field-label">
            <span>Dependentes</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={state.dependents}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  dependents: Number(event.target.value) || 0,
                }))
              }
            />
          </label>
        </div>
      </Card>
      <Card className="overflow-hidden xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/7 p-5 sm:px-6">
          <div>
            <p className="section-kicker">Rule set versionado</p>
            <h2 className="mt-1 font-semibold text-white">
              Tabela anual IRPF 2026
            </h2>
          </div>
          <span className="status-pill status-actual">
            <Check /> Oficial 2026
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[620px]">
            <thead>
              <tr>
                <th>Base anual até</th>
                <th>Alíquota</th>
                <th>Parcela a deduzir</th>
              </tr>
            </thead>
            <tbody>
              {TAX_RULES_2026.annualIr.map((row) => (
                <tr key={row.upTo}>
                  <td>
                    {Number.isFinite(row.upTo)
                      ? formatBRL(row.upTo)
                      : "Acima de R$ 55.976,16"}
                  </td>
                  <td>{formatPercent(row.rate)}</td>
                  <td>{formatBRL(row.deduction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-white/7 p-5 sm:px-6">
          <Button
            variant="outline"
            onClick={exportData}
            className="border-white/10 bg-white/[.03] text-slate-200 hover:bg-white/[.07] hover:text-white"
          >
            <Download />
            Exportar dados
          </Button>
          <Button
            variant="outline"
            onClick={onReset}
            className="border-rose-400/20 bg-rose-400/[.05] text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"
          >
            <RotateCcw />
            Restaurar exemplo
          </Button>
        </div>
      </Card>
    </div>
  );
}

const editFields: Array<{ key: keyof PayrollMonth; label: string }> = [
  { key: "salary", label: "Salário tributável" },
  { key: "overtime", label: "Horas extras" },
  { key: "commission", label: "Comissões" },
  { key: "bonus", label: "Bônus" },
  { key: "vacationPay", label: "Férias tributáveis" },
  { key: "vacationOneThird", label: "1/3 de férias" },
  { key: "otherTaxable", label: "Outros tributáveis" },
  { key: "nonTaxable", label: "Não tributáveis" },
  { key: "pension", label: "Pensão judicial" },
  { key: "otherLegalDeductions", label: "Outras deduções legais" },
  { key: "pgblPayroll", label: "PGBL em folha" },
];

function MonthDialog({
  open,
  month,
  onClose,
  onSave,
}: {
  open: boolean;
  month: PayrollMonth | null;
  onClose: () => void;
  onSave: (month: PayrollMonth) => void;
}) {
  const [draft, setDraft] = useState<PayrollMonth | null>(month);
  if (!draft) return null;
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#101a2b] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar {monthLabel(draft.month)}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Informe o valor efetivo do holerite ou mantenha o cálculo projetado.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            <span>Status da competência</span>
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
                  dependents: Number(event.target.value) || 0,
                })
              }
            />
          </label>
          {editFields.map((field) => (
            <MoneyInput
              key={field.key}
              label={field.label}
              value={Number(draft[field.key]) || 0}
              onChange={(value) => setDraft({ ...draft, [field.key]: value })}
            />
          ))}
          <MoneyInput
            label="INSS efetivo (0 = cálculo)"
            value={draft.actualInss ?? 0}
            onChange={(value) =>
              setDraft({ ...draft, actualInss: value || null })
            }
          />
          <MoneyInput
            label="IRRF efetivo (0 = cálculo)"
            value={draft.actualIrrf ?? 0}
            onChange={(value) =>
              setDraft({ ...draft, actualIrrf: value || null })
            }
          />
        </div>
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

export function TaxApp() {
  const [state, setState] = useState<TaxState>(createInitialState);
  const [view, setView] = useState<View>(() => parseHash());
  const [hydrated, setHydrated] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const projection = useMemo(() => calculateProjection(state), [state]);
  const latestState = useRef(state);

  useEffect(() => {
    latestState.current = state;
  }, [state]);
  useEffect(() => {
    const onHistoryChange = () => setView(parseHash());
    window.addEventListener("hashchange", onHistoryChange);
    window.addEventListener("popstate", onHistoryChange);
    loadTaxState().then((saved) => {
      if (saved?.version === 1) setState(saved);
      setHydrated(true);
    });
    return () => {
      window.removeEventListener("hashchange", onHistoryChange);
      window.removeEventListener("popstate", onHistoryChange);
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void saveTaxState(state);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [state, hydrated]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const reportError = (error: unknown) =>
      console.warn("WebMCP indisponível", error);
    const register = (tool: WebMcpTool) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(reportError);
      } catch (error) {
        reportError(error);
      }
    };
    register({
      name: "read_tax_projection",
      title: "Ler projeção do IRPF",
      description:
        "Retorna o resumo atual da projeção tributária exibida no Pondera Tax.",
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
          grossTaxable: result.recommended.grossTaxable,
          taxDue: result.recommended.taxDue,
          withheld: result.totalWithheld,
          balance: result.recommended.balance,
          pgblAvailable: result.pgbl.available,
        };
      },
    });
    register({
      name: "update_monthly_payroll",
      title: "Atualizar holerite mensal",
      description:
        "Atualiza os principais valores de uma competência e recalcula a projeção visível.",
      inputSchema: {
        type: "object",
        properties: {
          month: { type: "integer", minimum: 1, maximum: 12 },
          salary: { type: "number", minimum: 0 },
          actualInss: { type: ["number", "null"], minimum: 0 },
          actualIrrf: { type: ["number", "null"], minimum: 0 },
          status: { type: "string", enum: ["actual", "projected"] },
        },
        required: ["month"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as {
          month?: number;
          salary?: number;
          actualInss?: number | null;
          actualIrrf?: number | null;
          status?: PayrollMonth["status"];
        };
        if (
          !Number.isInteger(value.month) ||
          value.month! < 1 ||
          value.month! > 12
        )
          throw new Error("month deve ser um inteiro entre 1 e 12");
        const monthIndex = value.month! - 1;
        let updated = latestState.current;
        setState((current) => {
          const months = current.months.map((month, index) =>
            index === monthIndex
              ? {
                  ...month,
                  ...(value.salary === undefined
                    ? {}
                    : { salary: value.salary }),
                  ...(value.actualInss === undefined
                    ? {}
                    : { actualInss: value.actualInss }),
                  ...(value.actualIrrf === undefined
                    ? {}
                    : { actualIrrf: value.actualIrrf }),
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
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const result = calculateProjection(updated);
        return {
          month: value.month,
          taxDue: result.recommended.taxDue,
          withheld: result.totalWithheld,
          balance: result.recommended.balance,
        };
      },
    });
    return () => lifecycle.abort();
  }, []);
  const navigate = (next: View) => {
    window.history.pushState(null, "", `#${next}`);
    setView(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const saveMonth = (month: PayrollMonth) => {
    setState((current) => ({
      ...current,
      months: current.months.map((item) =>
        item.id === month.id ? month : item,
      ),
    }));
    setEditingIndex(null);
  };
  const currentTitle = titles[view];
  const activeMonth = editingIndex === null ? null : state.months[editingIndex];

  return (
    <div className="min-h-screen bg-[#070d17] text-slate-200">
      <aside className="sidebar-shell">
        <div className="flex items-center gap-3 px-3">
          <span className="brand-mark">
            <span>P</span>
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">
              Pondera
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-300">
              Tax
            </p>
          </div>
        </div>
        <nav className="mt-10 space-y-1" aria-label="Navegação principal">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn("nav-item", view === item.id && "nav-item-active")}
            >
              <item.icon />
              <span>{item.label}</span>
              {view === item.id && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-300" />
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/8 bg-white/[.025] p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
            <LockKeyhole className="size-3.5" />
            Privacidade local
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            Seus dados ficam neste navegador. Nenhum holerite é enviado.
          </p>
        </div>
        <p className="mt-4 px-1 text-[10px] text-slate-600">
          v1.0.0 · Regras 2026
        </p>
      </aside>
      <div className="lg:pl-[236px]">
        <header className="topbar">
          <button
            className="icon-button lg:hidden"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Abrir menu"
          >
            {mobileMenu ? <X /> : <Menu />}
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[.025] px-3 py-1.5 text-[11px] text-slate-400 sm:inline-flex">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  hydrated ? "bg-emerald-300" : "animate-pulse bg-amber-300",
                )}
              />
              {hydrated
                ? "Salvo neste dispositivo"
                : "Carregando dados locais…"}
            </span>
            <span className="rounded-lg border border-white/8 bg-[#111a2a] px-3 py-2 text-xs font-medium text-slate-300">
              Ano-base 2026
            </span>
          </div>
        </header>
        {mobileMenu && (
          <div className="mobile-menu lg:hidden">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={cn(
                  "nav-item",
                  view === item.id && "nav-item-active",
                )}
              >
                <item.icon />
                {item.label}
              </button>
            ))}
          </div>
        )}
        <main className="mx-auto w-full max-w-[1480px] px-4 pb-28 pt-7 sm:px-7 lg:px-9 lg:pb-10 lg:pt-9">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">{currentTitle.eyebrow}</p>
              <h1 className="mt-2 text-[clamp(1.8rem,3vw,2.6rem)] font-semibold tracking-[-0.045em] text-white">
                {currentTitle.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {currentTitle.description}
              </p>
            </div>
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <CircleDollarSign className="size-4 text-blue-300" />
              Exercício 2027
            </div>
          </div>
          {view === "dashboard" && (
            <DashboardView
              projection={projection}
              onNavigate={navigate}
              onEditMonth={setEditingIndex}
            />
          )}
          {view === "holerites" && (
            <PayrollView
              projection={projection}
              onEditMonth={setEditingIndex}
            />
          )}
          {view === "comparativo" && <ComparisonView projection={projection} />}
          {view === "pgbl" && (
            <PgblView
              state={state}
              projection={projection}
              onPgblChange={(value) =>
                setState((current) => ({
                  ...current,
                  deductions: { ...current.deductions, pgblDirect: value },
                }))
              }
            />
          )}
          {view === "configuracoes" && (
            <SettingsView
              state={state}
              setState={setState}
              onReset={() => setState(createInitialState())}
            />
          )}
        </main>
      </div>
      <nav className="bottom-nav lg:hidden" aria-label="Navegação móvel">
        {navigation.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            className={cn(view === item.id && "active")}
          >
            <item.icon />
            <span>{item.short}</span>
          </button>
        ))}
      </nav>
      <MonthDialog
        key={activeMonth?.id ?? "closed"}
        open={editingIndex !== null}
        month={activeMonth}
        onClose={() => setEditingIndex(null)}
        onSave={saveMonth}
      />
    </div>
  );
}
