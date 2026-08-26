import { useState } from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { updatePassword, signOut } from "../hooks/useAuth.js";

export const MIN_PASSWORD = 8;

const COPY = {
  obrigatorio: {
    title: "Troque a senha",
    subtitle: <>Você entrou com a senha provisória.<br />Escolha uma senha sua antes de continuar — mínimo {MIN_PASSWORD} caracteres.</>,
  },
  recovery: {
    title: "Redefinir senha",
    subtitle: <>Você pediu para redefinir sua senha.<br />Escolha uma senha nova — mínimo {MIN_PASSWORD} caracteres.</>,
  },
};

// Tela de troca de senha. Três usos com o mesmo formulário: porta obrigatória
// logo após o login com senha provisória (mode="obrigatorio"), fluxo de
// redefinição vindo do e-mail (mode="recovery"), e troca voluntária inline
// dentro de Ajustes (sem mode).
export default function TrocarSenha({ mode, onDone, onCancel }) {
  const fullScreen = mode === "obrigatorio" || mode === "recovery";
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [state, setState] = useState("idle"); // idle | saving | error | done
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (pw1.length < MIN_PASSWORD) {
      setState("error");
      setErrMsg(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (pw1 !== pw2) {
      setState("error");
      setErrMsg("As duas senhas não são iguais.");
      return;
    }
    setState("saving");
    setErrMsg("");
    const { error } = await updatePassword(pw1);
    if (error) {
      setState("error");
      setErrMsg(error);
      return;
    }
    setState("done");
    onDone?.();
  }

  const form = (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }} noValidate>
      <label>
        <span className="small-label">nova senha</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type={show ? "text" : "password"} value={pw1} placeholder="••••••••"
            autoComplete="new-password" autoFocus={fullScreen}
            onChange={(e) => setPw1(e.target.value)}
          />
          <button
            type="button" className="btn-ghost"
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShow((v) => !v)}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>
      <label>
        <span className="small-label">repita a nova senha</span>
        <input
          type={show ? "text" : "password"} value={pw2} placeholder="••••••••"
          autoComplete="new-password"
          onChange={(e) => setPw2(e.target.value)}
        />
      </label>

      {state === "error" && <p className="msg-error" role="alert">{errMsg}</p>}
      {state === "done" && !fullScreen && <p className="msg-ok" role="status">Senha alterada.</p>}

      <div className="flex-row" style={{ gap: 8 }}>
        <button type="submit" className="btn-primary" disabled={state === "saving"}>
          <KeyRound size={16} /> {state === "saving" ? "Salvando..." : "Salvar nova senha"}
        </button>
        {!fullScreen && onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        )}
      </div>
    </form>
  );

  if (!fullScreen) return form;

  const copy = COPY[mode];
  return (
    <div className="login-screen">
      <div className="login-box">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className="sidebar-logo" style={{ width: 56, height: 56, marginBottom: 0 }}>
            <KeyRound size={26} />
          </div>
        </div>
        <div>
          <h1 className="login-title">{copy.title}</h1>
          <p className="login-sub">{copy.subtitle}</p>
        </div>
        {form}
        <button className="btn-ghost" style={{ alignSelf: "center" }} onClick={() => signOut()}>
          sair
        </button>
      </div>
    </div>
  );
}
