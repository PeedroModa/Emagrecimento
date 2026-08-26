import { useState } from "react";
import { Weight, Mail, LogIn, Eye, EyeOff, UserPlus, KeyRound } from "lucide-react";
import { signInWithPassword, signInWithMagicLink, signUp, requestPasswordReset } from "../hooks/useAuth.js";

const TITLES = {
  signin: "Entre com seu e-mail e senha.",
  signup: "Crie sua conta com e-mail e senha.",
  forgot: "Informe seu e-mail para redefinir a senha.",
  magic: "Entre com o link mágico por e-mail — sem senha.",
};

export default function Login({ sessionExpired, dismissSessionExpired }) {
  const [mode, setMode] = useState("signin"); // signin | signup | forgot | magic
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [errMsg, setErrMsg] = useState("");

  function fail(msg) {
    setState("error");
    setErrMsg(msg);
  }

  async function handleSignin(e) {
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

  async function handleSignup(e) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) return fail("Digite um e-mail válido.");
    if (password.length < 6) return fail("A senha precisa ter pelo menos 6 caracteres.");
    if (password !== password2) return fail("As duas senhas não são iguais.");
    setState("sending");
    setErrMsg("");
    const { error, needsEmailConfirmation } = await signUp(clean, password);
    if (error) fail(error);
    else if (needsEmailConfirmation) setState("sent");
    // sem confirmação pendente: onAuthStateChange já loga sozinho
  }

  async function handleForgot(e) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) return fail("Digite um e-mail válido.");
    setState("sending");
    setErrMsg("");
    await requestPasswordReset(clean);
    setState("sent");
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

  const HANDLERS = { signin: handleSignin, signup: handleSignup, forgot: handleForgot, magic: handleMagic };

  function switchMode(next) {
    setMode(next);
    setState("idle");
    setErrMsg("");
    dismissSessionExpired?.();
  }

  const sentCopy = {
    signup: "Confira seu e-mail e clique no link de confirmação para ativar a conta.",
    forgot: "Se esse e-mail tiver conta, você vai receber um link para escolher uma senha nova.",
    magic: "Abra o e-mail e clique no link para entrar.",
  }[mode];

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
            {TITLES[mode]}
          </p>
        </div>

        {sessionExpired && state !== "sent" && (
          <p className="msg-warn" role="alert" style={{ textAlign: "center" }}>
            Sua sessão expirou. Entre novamente.
          </p>
        )}

        {state === "sent" ? (
          <div role="status" style={{ textAlign: "center" }}>
            <p className="msg-ok" style={{ fontSize: ".92rem", lineHeight: 1.6 }}>
              {mode !== "forgot" && (
                <>
                  {mode === "signup" ? "Conta criada para " : "Link enviado para "}
                  <strong>{email.trim().toLowerCase()}</strong>.<br />
                </>
              )}
              {sentCopy}
            </p>
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => switchMode("signin")}>
              voltar para o login
            </button>
          </div>
        ) : (
          <form onSubmit={HANDLERS[mode]} style={{ display: "flex", flexDirection: "column", gap: 12 }} noValidate>
            <label>
              <span className="small-label">e-mail</span>
              <input
                type="email" value={email} placeholder="seu@email.com"
                autoComplete="email" autoFocus
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {(mode === "signin" || mode === "signup") && (
              <label>
                <span className="small-label">senha</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type={showPw ? "text" : "password"} value={password} placeholder="••••••••"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
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

            {mode === "signup" && (
              <label>
                <span className="small-label">repita a senha</span>
                <input
                  type={showPw ? "text" : "password"} value={password2} placeholder="••••••••"
                  autoComplete="new-password"
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </label>
            )}

            {state === "error" && <p className="msg-error" role="alert">{errMsg}</p>}

            <button type="submit" className="btn-primary" disabled={state === "sending"}>
              {mode === "signin" && <><LogIn size={16} /> {state === "sending" ? "Entrando..." : "Entrar"}</>}
              {mode === "signup" && <><UserPlus size={16} /> {state === "sending" ? "Criando..." : "Criar conta"}</>}
              {mode === "forgot" && <><KeyRound size={16} /> {state === "sending" ? "Enviando..." : "Enviar link de redefinição"}</>}
              {mode === "magic" && <><Mail size={16} /> {state === "sending" ? "Enviando..." : "Enviar link de acesso"}</>}
            </button>

            <div className="flex-row" style={{ justifyContent: "center", gap: 4, fontSize: ".82rem" }}>
              {mode === "signin" && (
                <>
                  <button type="button" className="btn-ghost" onClick={() => switchMode("signup")}>criar conta</button>
                  <span style={{ color: "var(--t3)" }}>·</span>
                  <button type="button" className="btn-ghost" onClick={() => switchMode("forgot")}>esqueci minha senha</button>
                  <span style={{ color: "var(--t3)" }}>·</span>
                  <button type="button" className="btn-ghost" onClick={() => switchMode("magic")}>link mágico</button>
                </>
              )}
              {mode !== "signin" && (
                <button type="button" className="btn-ghost" onClick={() => switchMode("signin")}>voltar para o login</button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
