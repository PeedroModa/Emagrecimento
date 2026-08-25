import { useState } from "react";
import { Weight, Mail, LogIn, Eye, EyeOff } from "lucide-react";
import { signInWithPassword, signInWithMagicLink } from "../hooks/useAuth.js";

export default function Login() {
  const [mode, setMode] = useState("password"); // password | magic
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [errMsg, setErrMsg] = useState("");

  function fail(msg) {
    setState("error");
    setErrMsg(msg);
  }

  async function handlePassword(e) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) return fail("Digite um e-mail válido.");
    if (!password) return fail("Digite a senha.");
    setState("sending");
    setErrMsg("");
    const { error } = await signInWithPassword(clean, password);
    if (error) fail(error);
    // sucesso: o onAuthStateChange do useAuth troca a tela sozinho
  }

  async function handleMagic(e) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) return fail("Digite um e-mail válido.");
    setState("sending");
    setErrMsg("");
    const { error } = await signInWithMagicLink(clean);
    if (error) fail("Não consegui enviar o link. Verifique o e-mail e tente de novo.");
    else setState("sent");
  }

  function switchMode(next) {
    setMode(next);
    setState("idle");
    setErrMsg("");
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
          <p className="login-sub">
            Acompanhamento de peso e composição corporal.
            <br />
            {mode === "password" ? "Entre com seu e-mail e senha." : "Entre com o link mágico por e-mail — sem senha."}
          </p>
        </div>

        {mode === "magic" && state === "sent" ? (
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
          <form
            onSubmit={mode === "password" ? handlePassword : handleMagic}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
            noValidate
          >
            <label>
              <span className="small-label">e-mail</span>
              <input
                type="email" value={email} placeholder="seu@email.com"
                autoComplete="email" autoFocus
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {mode === "password" && (
              <label>
                <span className="small-label">senha</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type={showPw ? "text" : "password"} value={password} placeholder="••••••••"
                    autoComplete="current-password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button" className="btn-ghost"
                    aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setShowPw((v) => !v)}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            )}

            {state === "error" && <p className="msg-error" role="alert">{errMsg}</p>}

            <button type="submit" className="btn-primary" disabled={state === "sending"}>
              {mode === "password" ? (
                <><LogIn size={16} /> {state === "sending" ? "Entrando..." : "Entrar"}</>
              ) : (
                <><Mail size={16} /> {state === "sending" ? "Enviando..." : "Enviar link de acesso"}</>
              )}
            </button>

            <button
              type="button" className="btn-ghost" style={{ alignSelf: "center" }}
              onClick={() => switchMode(mode === "password" ? "magic" : "password")}
            >
              {mode === "password" ? "entrar com link mágico" : "entrar com senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
