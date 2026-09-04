import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { clearWeighInsCache } from "./useWeighIns.js";
import { clearSettingsCache } from "./useSettings.js";
import { clearAppStateCache } from "./useAppState.js";
import { clearInsightStateCache } from "./useInsightState.js";
import { clearMeasurementsCache } from "./useMeasurements.js";

const RECOVERY_FLAG_KEY = "pwRecoveryPending";

// O evento PASSWORD_RECOVERY é efêmero — um refresh de página no meio do
// fluxo de redefinição perde o sinal (a sessão de recovery passa a parecer
// uma sessão comum). Por isso o sinal também vive no sessionStorage, restrito
// à aba atual, sem nenhum dado do usuário — só a informação "estou no meio
// da troca de senha por e-mail".
function readRecoveryFlag() {
  try { return sessionStorage.getItem(RECOVERY_FLAG_KEY) === "1"; } catch { return false; }
}
function setRecoveryFlag() {
  try { sessionStorage.setItem(RECOVERY_FLAG_KEY, "1"); } catch { /* sessionStorage indisponível */ }
}
function clearRecoveryFlag() {
  try { sessionStorage.removeItem(RECOVERY_FLAG_KEY); } catch { /* sessionStorage indisponível */ }
}

// Setada por signOut() um instante antes de chamar a API — permite o handler
// de SIGNED_OUT distinguir "usuário pediu para sair" de "sessão expirou/foi
// revogada" (o supabase-js emite o MESMO evento nos dois casos).
let explicitSignOut = false;

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(() => readRecoveryFlag());
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryFlag();
        setPasswordRecovery(true);
      }
      // Um login normal (senha/magic link) nunca deve herdar uma flag de
      // recovery órfã de um link anterior que expirou sem ser concluído —
      // sem isso, esse login legítimo cairia na tela de "definir nova senha"
      // por engano.
      if (event === "SIGNED_IN") {
        clearRecoveryFlag();
        setPasswordRecovery(false);
      }
      if (event === "SIGNED_OUT") {
        clearWeighInsCache();
        clearSettingsCache();
        clearAppStateCache();
        clearInsightStateCache();
        clearMeasurementsCache();
        clearRecoveryFlag();
        setPasswordRecovery(false);
        setSessionExpired(!explicitSignOut);
        explicitSignOut = false;
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
    // true só quando a sessão atual veio de um link de redefinição de senha —
    // App.jsx usa isso para forçar a tela de nova senha antes de qualquer
    // outra coisa, mesmo já existindo uma "session" válida.
    passwordRecovery,
    dismissSessionExpired: () => setSessionExpired(false),
    markRecoveryDone: () => { clearRecoveryFlag(); setPasswordRecovery(false); },
    sessionExpired,
  };
}

// Login por e-mail + senha. É o caminho principal: não depende de o e-mail
// (link mágico / confirmação) chegar na caixa de entrada.
export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { error: null };
  const msg = /invalid login credentials/i.test(error.message)
    ? "E-mail ou senha incorretos."
    : /email not confirmed/i.test(error.message)
      ? "Confirme seu e-mail antes de entrar — veja o link que mandamos na sua caixa de entrada."
      : "Não consegui entrar. Verifique a conexão e tente de novo.";
  return { error: msg };
}

// Interpretação pura do retorno de signUp(), separada da chamada de rede
// para ficar testável sem mockar o Supabase. O GoTrue moderno (com
// "Confirm email" ligado) NÃO gera erro em "e-mail já cadastrado" — devolve
// sucesso "fantasma", de propósito, para não revelar quais e-mails existem.
// O único jeito de detectar isso é checar `identities: []` no retorno.
export function interpretSignUpResult(data, error) {
  if (error) {
    if (/rate limit/i.test(error.message) || error.status === 429) {
      return { error: "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.", needsEmailConfirmation: false };
    }
    if (/already registered/i.test(error.message)) {
      return { error: "Esse e-mail já tem conta. Tente entrar ou recuperar a senha.", needsEmailConfirmation: false };
    }
    if (/should be at least|password.*(short|length)/i.test(error.message)) {
      return { error: "Senha muito curta — use pelo menos 6 caracteres.", needsEmailConfirmation: false };
    }
    return {
      error: error.status === 422 && error.message ? error.message : "Não consegui criar a conta. Verifique os dados e tente de novo.",
      needsEmailConfirmation: false,
    };
  }
  if (data?.user?.identities?.length === 0) {
    return { error: "Esse e-mail já tem conta. Tente entrar ou recuperar a senha.", needsEmailConfirmation: false };
  }
  if (data?.session) {
    return { error: null, needsEmailConfirmation: false };
  }
  if (data?.user) {
    return { error: null, needsEmailConfirmation: true };
  }
  return { error: "Não consegui criar a conta. Tente de novo.", needsEmailConfirmation: false };
}

// Cadastro self-service. Se a confirmação de e-mail estiver ligada no
// projeto Supabase, needsEmailConfirmation vem true e a UI mostra "confira
// seu e-mail"; senão, a sessão já chega ativa e onAuthStateChange cuida do
// resto sozinho.
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  return interpretSignUpResult(data, error);
}

// Pede o e-mail de redefinição de senha. Sempre retorna sucesso genérico —
// o Supabase já não revela se o e-mail existe, e a UI não deve revelar isso
// por conta própria (evita enumeração de contas).
export async function requestPasswordReset(email) {
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  return { error: null };
}

// Troca de senha do usuário logado. Também limpa a flag que obriga a troca.
// Usada tanto na senha provisória quanto na redefinição via e-mail quanto na
// troca voluntária em Ajustes.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false },
  });
  if (!error) return { error: null };
  const msg = /should be at least|password.*(short|length)/i.test(error.message)
    ? "A senha é curta demais para as regras do Supabase (mínimo 6 caracteres)."
    : /different from the old password|same as the old/i.test(error.message)
      ? "A nova senha precisa ser diferente da atual."
      : "Não consegui salvar a nova senha. Tente de novo.";
  return { error: msg };
}

// Flag gravada no user_metadata (pelo criar-usuario.sql) que força a troca da
// senha provisória logo depois do primeiro login.
export function mustChangePassword(user) {
  return user?.user_metadata?.must_change_password === true;
}

export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return { error };
}

export async function signOut() {
  explicitSignOut = true;
  await supabase.auth.signOut();
}
