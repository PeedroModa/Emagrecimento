import { useState } from "react";
import { Cake } from "lucide-react";
import { ageFromBirthDate, isValidBirthDate, todayISO } from "../lib/calculations.js";

// Primeiro acesso: em vez de idade fixa, o usuário informa a data de nascimento
// uma única vez. A idade usada no Mifflin-St Jeor passa a se atualizar sozinha.
export default function PrimeiroAcesso({ onSave, erroSalvar }) {
  const [date, setDate] = useState("");
  const [state, setState] = useState("idle"); // idle | saving | error
  const [errMsg, setErrMsg] = useState("");

  const preview = ageFromBirthDate(date);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValidBirthDate(date)) {
      setState("error");
      setErrMsg("Informe uma data de nascimento válida.");
      return;
    }
    setState("saving");
    setErrMsg("");
    onSave(date);
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className="sidebar-logo" style={{ width: 56, height: 56, marginBottom: 0 }}>
            <Cake size={26} />
          </div>
        </div>
        <div>
          <h1 className="login-title">Quase lá</h1>
          <p className="login-sub">
            Qual é a sua data de nascimento?
            <br />A idade entra no cálculo de calorias (Mifflin-St Jeor) e passa a
            se atualizar sozinha a cada aniversário.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }} noValidate>
          <label>
            <span className="small-label">data de nascimento</span>
            <input
              type="date" value={date} max={todayISO()} min="1906-01-01" autoFocus
              onChange={(e) => { setDate(e.target.value); setState("idle"); }}
            />
          </label>

          {preview != null && (
            <p style={{ fontSize: ".85rem", color: "var(--t2)", textAlign: "center" }}>
              Você tem <strong>{preview} anos</strong>.
            </p>
          )}
          {state === "error" && <p className="msg-error" role="alert">{errMsg}</p>}
          {erroSalvar && <p className="msg-error" role="alert">{erroSalvar}</p>}

          <button type="submit" className="btn-primary" disabled={state === "saving"}>
            {state === "saving" ? "Salvando..." : "Continuar"}
          </button>
        </form>

        <p style={{ fontSize: ".74rem", color: "var(--t3)", textAlign: "center", lineHeight: 1.5 }}>
          Dá para mudar depois em Ajustes → Perfil físico.
        </p>
      </div>
    </div>
  );
}
