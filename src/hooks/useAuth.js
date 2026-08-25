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
