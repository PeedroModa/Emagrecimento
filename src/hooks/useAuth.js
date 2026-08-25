import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { clearWeighInsCache } from "./useWeighIns.js";
import { clearSettingsCache } from "./useSettings.js";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "SIGNED_OUT") {
        clearWeighInsCache();
        clearSettingsCache();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

// Login por e-mail + senha. É o caminho principal: não depende de o e-mail
// (link mágico / confirmação) chegar na caixa de entrada.
export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { error: null };
  const msg = /invalid login credentials/i.test(error.message)
    ? "E-mail ou senha incorretos."
    : /email not confirmed/i.test(error.message)
      ? "Esse e-mail ainda não foi confirmado no Supabase. Rode supabase/criar-usuario.sql."
      : "Não consegui entrar. Verifique a conexão e tente de novo.";
  return { error: msg };
}

// Troca de senha do usuário logado. Também limpa a flag que obriga a troca.
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
  await supabase.auth.signOut();
}
