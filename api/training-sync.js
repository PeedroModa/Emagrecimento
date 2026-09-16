// Vercel Serverless Function: recebe treinos (formato bruto do Gravl ou já
// normalizado) e faz upsert em training_sessions para UM usuário fixo.
//
//   POST /api/training-sync
//   Authorization: Bearer <SYNC_TOKEN>
//   { "workouts": [ { externalId, startDate, duration, name, volume, calories }, ... ] }
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   VITE_SUPABASE_URL            já existe
//   SUPABASE_SERVICE_ROLE_KEY    chave service_role (NUNCA no frontend/.env do Vite)
//   SYNC_TOKEN                   segredo longo, gerado por você
//   SYNC_USER_ID                 uuid do usuário em auth.users
//
// ponytail: um usuário fixo (SYNC_USER_ID). Multiusuário = token por usuário
// numa tabela; não antes de existir um segundo usuário sincronizando.
import { parseTrainingImport } from "../src/lib/training.js";

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // .trim(): valores colados no painel da Vercel costumam vir com espaço/quebra de linha no fim.
  const [url, key, token, userId] = ["VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SYNC_TOKEN", "SYNC_USER_ID"].map((k) => (process.env[k] || "").trim());
  if (!url || !key || !token || !userId) return res.status(500).json({ error: "sync não configurado (variáveis de ambiente)" });

  const auth = req.headers.authorization || "";
  if (!timingSafeEqual(auth.trim(), `Bearer ${token}`)) return res.status(401).json({ error: "não autorizado" });

  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  const { error, sessions } = parseTrainingImport(body);
  if (error) return res.status(400).json({ error });

  const rows = sessions.map((s) => ({ ...s, user_id: userId }));
  const r = await fetch(`${url}/rest/v1/training_sessions?on_conflict=user_id,external_id`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) return res.status(502).json({ error: "supabase recusou", detail: await r.text() });
  return res.status(200).json({ ok: true, upserted: rows.length, from: sessions[0].date, to: sessions[sessions.length - 1].date });
}
