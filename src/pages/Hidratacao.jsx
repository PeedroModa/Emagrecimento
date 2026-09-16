import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Droplet, Droplets, Trash2, Clock } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { useWeighIns } from "../hooks/useWeighIns.js";
import { useSettings } from "../hooks/useSettings.js";
import { useWaterLogs } from "../hooks/useWaterLogs.js";
import { computeTrend, fmtDateBR, addDaysISO, DEFAULT_GOAL } from "../lib/calculations.js";
import {
  QUICK_AMOUNTS_ML, localDateISO, localTimeHM, timestampForDay, hydrationGoalMl,
  weightForDay, logsForDay, hydrationStatus, STAGE_MESSAGES, reminderMessage, fmtLiters,
} from "../lib/hydration.js";
import HydrationBody from "../components/hydration/HydrationBody.jsx";
import SectionHeader from "../components/layout/SectionHeader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useToast, Toast } from "../components/ui/Toast.jsx";

const PAGE_SIZE = 5;

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Número que "corre" até o alvo (ease-out), para percentual e litros
// acompanharem a água subindo em vez de saltar.
function useTween(target, ms = 1200) {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (reducedMotion() || cur.current === target) { cur.current = target; setV(target); return; }
    const from = cur.current;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      cur.current = from + (target - from) * e;
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function dayWord(dateISO, today) {
  if (dateISO === today) return "Hoje";
  if (dateISO === addDaysISO(today, -1)) return "Ontem";
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
}

export default function Hidratacao() {
  const { user } = useAuth();
  const { weighIns } = useWeighIns();
  const { settings } = useSettings();
  const { logs, loading, error, retry, add, remove } = useWaterLogs();
  const { toast, show } = useToast();

  const today = localDateISO();
  const [date, setDate] = useState(today);
  const isToday = date === today;
  const [page, setPage] = useState(0);
  const [swap, setSwap] = useState(false);
  const [floats, setFloats] = useState([]); // rótulos "+650 ml" flutuando sobre o corpo
  const [celebrate, setCelebrate] = useState(false);
  const [pending, setPending] = useState(null);

  // Meta: peso oficial (weigh_ins) até o dia analisado × 50 ml/kg.
  const weightKg = useMemo(() => weightForDay(weighIns, date), [weighIns, date]);
  const goalMl = hydrationGoalMl(weightKg);
  const dayLogs = useMemo(() => logsForDay(logs, date), [logs, date]);
  const totalMl = dayLogs.reduce((s, l) => s + l.amount_ml, 0);
  const status = useMemo(() => hydrationStatus({ totalMl, goalMl }), [totalMl, goalMl]);

  const trend = useMemo(
    () => computeTrend(weighIns, settings.goal_kg ?? DEFAULT_GOAL, settings.height_cm),
    [weighIns, settings.goal_kg, settings.height_cm]
  );
  const weighToday = weighIns.find((w) => w.date === date) ?? null;

  const pctAnim = useTween(status.pct ?? 0);
  const totalAnim = useTween(totalMl);

  // Celebração só na TRANSIÇÃO para a meta dentro da sessão — nunca ao abrir
  // a página com a meta já batida (isso seria ruído, não recompensa).
  const prevStage = useRef(status.stage);
  useEffect(() => {
    const was = prevStage.current;
    prevStage.current = status.stage;
    const reached = (status.stage === "goal" || status.stage === "over") && was && was !== "goal" && was !== "over";
    if (!reached) return;
    setCelebrate(true);
    show(status.stage === "over" ? "Meta ultrapassada." : "Meta do dia atingida.");
    const t = setTimeout(() => setCelebrate(false), 1600);
    return () => clearTimeout(t);
  }, [status.stage, show]);

  function changeDate(next) {
    if (next > today) return;
    setDate(next);
    setPage(0);
    setSwap(true);
    setTimeout(() => setSwap(false), 520);
  }

  async function handleAdd(amountMl) {
    if (pending) return;
    setPending(amountMl);
    const id = Date.now();
    setFloats((f) => [...f, { id, text: `+${fmtLiters(amountMl)}` }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1500);
    const { error: err } = await add({ amountMl, loggedAt: timestampForDay(date), userId: user.id });
    setPending(null);
    if (err) { show(err, "error"); return; }
    if (status.stage !== "goal" && status.stage !== "over") show(`${fmtLiters(amountMl)} registrado.`);
    setPage(0);
  }

  async function handleRemove(log) {
    const { error: err } = await remove(log.id);
    if (err) show(err, "error");
  }

  const pageCount = Math.max(1, Math.ceil(dayLogs.length / PAGE_SIZE));
  const visible = dayLogs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const reminder = isToday ? reminderMessage({ logsToday: dayLogs, status }) : null;
  const glow = status.level ? 0.06 + status.level * 0.22 : 0.04;

  if (loading) {
    return (
      <div>
        <div className="page-hdr"><h1 className="page-title">Hidratação</h1><p className="page-sub">carregando seus registros...</p></div>
        <div className="skeleton" style={{ height: 320, marginBottom: 16 }} />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <div className="page-hdr"><h1 className="page-title">Hidratação</h1></div>
        <EmptyState title="Não consegui carregar" text={error} />
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="btn-secondary" onClick={retry}>Tentar de novo</button>
        </div>
      </div>
    );
  }

  const bodyLabel = status.pct == null
    ? "Hidratação sem meta: registre seu peso"
    : `Hidratação de ${dayWord(date, today).toLowerCase()}: ${status.pct}% da meta, ${fmtLiters(totalMl)} de ${fmtLiters(goalMl)}`;

  return (
    <div className="hy-page">
      <div className="page-hdr hy-hdr">
        <div>
          <h1 className="page-title">Hidratação</h1>
          <p className="page-sub">o estado de hidratação do seu corpo, dia a dia</p>
        </div>
        <div className="hy-datenav" role="group" aria-label="Dia analisado">
          <button type="button" className="btn-ghost" aria-label="Dia anterior" onClick={() => changeDate(addDaysISO(date, -1))}>
            <ChevronLeft size={18} />
          </button>
          <div className="hy-datelabel" aria-live="polite">
            <span className="hy-dateword">{dayWord(date, today)}</span>
            <span className="hy-datefull num">{fmtDateBR(date)}</span>
          </div>
          <button type="button" className="btn-ghost" aria-label="Dia seguinte" disabled={isToday} onClick={() => changeDate(addDaysISO(date, 1))}>
            <ChevronRight size={18} />
          </button>
          {!isToday && (
            <button type="button" className="hy-today-link" onClick={() => changeDate(today)}>voltar para hoje</button>
          )}
        </div>
      </div>

      <section className={`hy-stage${swap ? " hy-swap" : ""}`}>
        <div className="hy-body-wrap" style={{ "--hy-glow": glow }}>
          <HydrationBody level={status.level} stage={status.stage} celebrate={celebrate} label={bodyLabel} />
          {floats.map((f) => <span key={f.id} className="hy-float num" aria-hidden="true">{f.text}</span>)}
          {status.stage === "over" && (
            <span className="hy-over-badge num">+{fmtLiters(status.excessMl)} além da meta</span>
          )}
        </div>

        <div className="hy-panel">
          {goalMl ? (
            <>
              <div className="hy-pct" aria-hidden="true">
                <span className="hy-pct-num">{Math.round(pctAnim)}</span>
                <span className="hy-pct-sign">%</span>
              </div>
              <div className="hy-amount" aria-live="polite">
                <span className="hy-amount-num num">{fmtLiters(totalAnim)}</span>
                <span className="hy-amount-of">de {fmtLiters(goalMl)}</span>
              </div>
              <p className={`hy-stage-msg hy-msg-${status.stage}`}>{STAGE_MESSAGES[status.stage]}</p>
              {status.stage !== "goal" && status.stage !== "over" && (
                <p className="hy-remaining">faltam <span className="num">{fmtLiters(status.remainingMl)}</span></p>
              )}
            </>
          ) : (
            <p className="hy-stage-msg">
              A meta de hidratação usa o seu peso (× 50 ml/kg). Registre uma pesagem na página Hoje para ela aparecer.
            </p>
          )}

          <div className="hy-quick" role="group" aria-label="Registrar água">
            {QUICK_AMOUNTS_ML.map((ml, i) => (
              <button
                key={ml} type="button" className="hy-btn"
                disabled={pending != null}
                onClick={() => handleAdd(ml)}
                aria-label={`Registrar ${fmtLiters(ml)}`}
              >
                <Droplet size={13 + i * 3} />
                <span className="num">{fmtLiters(ml)}</span>
              </button>
            ))}
          </div>
          {goalMl && (
            <p className="hy-goal-note">meta de <span className="num">{fmtLiters(goalMl)}</span> = <span className="num">{weightKg}</span> kg × 50 ml/kg{!isToday ? " (peso da época)" : ""}</p>
          )}

          {reminder && (
            <div className="hy-reminder" role="status">
              <Droplets size={15} />
              <span>{reminder}</span>
            </div>
          )}
        </div>
      </section>

      {goalMl && (
        <section className="hy-section">
          <SectionHeader title="Hidratação e peso" subtitle="a hidratação é contexto para ler a balança, não uma explicação automática" />
          <div className="hy-strip">
            <div>
              <span className="small-label">peso {isToday ? "hoje" : "no dia"}</span>
              <span className="hy-strip-v">{weighToday ? <><span className="num">{weighToday.weight}</span> <small>kg</small></> : <small>sem pesagem</small>}</span>
            </div>
            <div>
              <span className="small-label">tendência</span>
              <span className="hy-strip-v">{trend ? <><span className="num">{trend.perWeek > 0 ? "+" : ""}{trend.perWeek.toFixed(1)}</span> <small>kg/sem</small></> : <small>calibrando</small>}</span>
            </div>
            <div>
              <span className="small-label">hidratação</span>
              <span className="hy-strip-v"><span className="num">{status.pct}</span> <small>%</small></span>
            </div>
          </div>
          <p className="hy-insight">
            A tendência de peso continua sendo mais importante do que uma medição isolada. A hidratação {isToday ? "de hoje" : "desse dia"} entra apenas como contexto adicional.
          </p>
        </section>
      )}

      {goalMl && (
        <section className="hy-section">
          <SectionHeader title="Leitura do dia" />
          <ul className="hy-insights">
            <li>Você consumiu <strong className="num">{status.pct}%</strong> da sua meta {isToday ? "hoje" : "nesse dia"}.</li>
            {status.stage !== "goal" && status.stage !== "over"
              ? <li>Você ainda está abaixo da meta diária de hidratação.</li>
              : <li>Meta diária de hidratação alcançada{status.stage === "over" ? ", com excedente" : ""}.</li>}
            <li>Sua hidratação recente pode ser considerada como contexto ao interpretar pequenas oscilações no peso.</li>
            <li>A balança varia por diversos motivos. A hidratação é apenas uma das variáveis que podem influenciar o peso observado.</li>
          </ul>
        </section>
      )}

      <section className="hy-section">
        <SectionHeader title="Registros" subtitle={`${dayLogs.length} ${dayLogs.length === 1 ? "registro" : "registros"} em ${fmtDateBR(date)}`} />
        {dayLogs.length === 0 ? (
          <p className="hy-empty">Nenhum registro {isToday ? "hoje ainda" : "nesse dia"}.</p>
        ) : (
          <>
            <div key={`${date}-${page}`} className="hy-history">
              {visible.map((l) => (
                <div key={l.id} className="history-item hy-history-item">
                  <div className="history-row">
                    <span className="history-date"><Clock size={12} /> {fmtDateBR(date)} · <span className="num">{localTimeHM(l.logged_at)}</span></span>
                    <span className="history-weight">{fmtLiters(l.amount_ml)}</span>
                    <div className="history-actions" style={{ marginLeft: "auto" }}>
                      <button className="btn-ghost btn-danger-ghost" aria-label={`Remover registro de ${fmtLiters(l.amount_ml)} às ${localTimeHM(l.logged_at)}`} onClick={() => handleRemove(l)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pageCount > 1 && (
              <div className="hy-pager">
                <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ChevronLeft size={16} /> anteriores</button>
                <span className="num">{page + 1} / {pageCount}</span>
                <button className="btn-ghost" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">seguintes <ChevronRight size={16} /></button>
              </div>
            )}
          </>
        )}
      </section>

      <Toast toast={toast} />
    </div>
  );
}
