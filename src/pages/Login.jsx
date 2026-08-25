import { useState } from "react";
import { Weight, Mail } from "lucide-react";
import { signInWithMagicLink } from "../hooks/useAuth.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setState("error");
      setErrMsg("Digite um e-mail válido.");
      return;
    }
    setState("sending");
    setErrMsg("");
    const { error } = await signInWithMagicLink(clean);
    if (error) {
      setState("error");
      setErrMsg("Não consegui enviar o link. Verifique o e-mail e tente de novo.");
    } else {
      setState("sent");
    }
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className="sidebar-logo" style={{ width: 56, height: 56, marginBottom: 0 }}>
            <Weight size={26} />
          </div>
        </div>
        <div>
          <h1 className="login-title">Painel de Peso</h1>
          <p className="login-sub">Acompanhamento de peso e composição corporal.<br />Entre com o link mágico por e-mail — sem senha.</p>
        </div>

        {state === "sent" ? (
          <div role="status" style={{ textAlign: "center" }}>
            <p className="msg-ok" style={{ fontSize: ".92rem", lineHeight: 1.6 }}>
              Link enviado para <strong>{email.trim().toLowerCase()}</strong>.
              <br />Abra o e-mail e clique no link para entrar.
            </p>
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setState("idle")}>
              usar outro e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }} noValidate>
            <label>
              <span className="small-label">e-mail</span>
              <input
                type="email" value={email} placeholder="seu@email.com"
                autoComplete="email" autoFocus
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {state === "error" && <p className="msg-error" role="alert">{errMsg}</p>}
            <button type="submit" className="btn-primary" disabled={state === "sending"}>
              <Mail size={16} /> {state === "sending" ? "Enviando..." : "Enviar link de acesso"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
