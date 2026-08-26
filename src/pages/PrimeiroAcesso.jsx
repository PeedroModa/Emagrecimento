import { useState } from "react";
import { Cake } from "lucide-react";
import { ageFromBirthDate, isValidBirthDate, todayISO, parseDecimal } from "../lib/calculations.js";

function Pill({ active, onClick, children }) {
  return <button type="button" className={"toggle-pill" + (active ? " active" : "")} onClick={onClick}>{children}</button>;
}

// Primeiro acesso: em vez de herdar em silêncio os defaults de user_settings
// (que fazem sentido como fallback técnico, mas seriam um perfil errado para
// um desconhecido), o usuário confirma explicitamente sexo, altura, meta,
// treinos e déficit — os dados mínimos para o Mifflin-St Jeor e o progresso
// até a meta fazerem sentido desde o primeiro dia. Peso atual não é pedido
// aqui: já é coletado no fluxo natural de "Registrar pesagem" da Hoje.
export default function PrimeiroAcesso({ onSave, erroSalvar }) {
  const [date, setDate] = useState("");
  const [sex, setSex] = useState(null);
  const [height, setHeight] = useState("");
  const [goal, setGoal] = useState("");
  const [trainDays, setTrainDays] = useState(3);
  const [deficitPct, setDeficitPct] = useState(15);
  const [state, setState] = useState("idle"); // idle | saving | error
  const [errMsg, setErrMsg] = useState("");

  const preview = ageFromBirthDate(date);

  function handleSubmit(e) {
    e.preventDefault();
    if (!isValidBirthDate(date)) {
      setState("error");
      setErrMsg("Informe uma data de nascimento válida.");
      return;
    }
    if (sex !== "M" && sex !== "F") {
      setState("error");
      setErrMsg("Escolha seu sexo biológico — o cálculo de calorias depende disso.");
      return;
    }
    const h = parseDecimal(height);
    if (isNaN(h) || h < 100 || h > 250) {
      setState("error");
      setErrMsg("Informe uma altura válida, em cm (entre 100 e 250).");
      return;
    }
    const g = parseDecimal(goal);
    if (isNaN(g) || g <= 0 || g > 400) {
      setState("error");
      setErrMsg("Informe um peso meta válido, em kg.");
      return;
    }
    setState("saving");
    setErrMsg("");
    onSave({
      birth_date: date,
      sex,
      height_cm: Math.round(h),
      goal_kg: +g.toFixed(1),
      train_days: trainDays,
      deficit_pct: deficitPct,
    });
  }

  return (
    <div className="login-screen">
      <div className="login-box" style={{ maxWidth: 440 }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className="sidebar-logo" style={{ width: 56, height: 56, marginBottom: 0 }}>
            <Cake size={26} />
          </div>
        </div>
        <div>
          <h1 className="login-title">Quase lá</h1>
          <p className="login-sub">
            Alguns dados para o painel calcular certo desde o primeiro dia.
            <br />Dá para mudar tudo isso depois em Ajustes.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }} noValidate>
          <label>
            <span className="small-label">data de nascimento</span>
            <input
              type="date" value={date} max={todayISO()} min="1906-01-01" autoFocus
              onChange={(e) => { setDate(e.target.value); setState("idle"); }}
            />
            {preview != null && (
              <span style={{ fontSize: ".76rem", color: "var(--t3)", display: "block", marginTop: 3 }}>{preview} anos</span>
            )}
          </label>

          <div>
            <span className="small-label">sexo biológico</span>
            <div className="flex-row" style={{ gap: 4, marginTop: 4 }}>
              <Pill active={sex === "M"} onClick={() => { setSex("M"); setState("idle"); }}>Masc</Pill>
              <Pill active={sex === "F"} onClick={() => { setSex("F"); setState("idle"); }}>Fem</Pill>
            </div>
            <span style={{ fontSize: ".72rem", color: "var(--t3)", display: "block", marginTop: 3 }}>
              usado só na fórmula de calorias (Mifflin-St Jeor)
            </span>
          </div>

          <div className="flex-row" style={{ gap: 16 }}>
            <label style={{ width: 110 }}>
              <span className="small-label">altura</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <input
                  type="text" inputMode="decimal" value={height} placeholder="175"
                  onChange={(e) => { setHeight(e.target.value); setState("idle"); }}
                />
                <span style={{ fontSize: ".8rem", color: "var(--t2)" }}>cm</span>
              </div>
            </label>
            <label style={{ width: 110 }}>
              <span className="small-label">peso meta</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <input
                  type="text" inputMode="decimal" value={goal} placeholder="ex: 75"
                  onChange={(e) => { setGoal(e.target.value); setState("idle"); }}
                />
                <span style={{ fontSize: ".8rem", color: "var(--t2)" }}>kg</span>
              </div>
            </label>
          </div>

          <div>
            <span className="small-label">treinos por semana</span>
            <div className="flex-row" style={{ gap: 4, marginTop: 4 }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
                <Pill key={d} active={trainDays === d} onClick={() => setTrainDays(d)}>{d}×</Pill>
              ))}
            </div>
          </div>

          <div>
            <span className="small-label">déficit calórico desejado</span>
            <div className="flex-row" style={{ gap: 4, marginTop: 4 }}>
              {[10, 15, 20].map((d) => (
                <Pill key={d} active={deficitPct === d} onClick={() => setDeficitPct(d)}>{d}%</Pill>
              ))}
            </div>
          </div>

          {state === "error" && <p className="msg-error" role="alert">{errMsg}</p>}
          {erroSalvar && <p className="msg-error" role="alert">{erroSalvar}</p>}

          <button type="submit" className="btn-primary" disabled={state === "saving"}>
            {state === "saving" ? "Salvando..." : "Continuar"}
          </button>
        </form>

        <p style={{ fontSize: ".74rem", color: "var(--t3)", textAlign: "center", lineHeight: 1.5 }}>
          Dá para mudar tudo isso depois em Ajustes.
        </p>
      </div>
    </div>
  );
}
