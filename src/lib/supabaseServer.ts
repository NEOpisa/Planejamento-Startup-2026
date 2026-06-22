// Acesso server-side ao Supabase para a ESCRITA de missões.
// Usa a SECRET key (sb_secret_...), que bypassa RLS — assim a escrita só
// acontece pela rota protegida por login, e não direto do navegador (a
// publishable key exposta no client só tem permissão de leitura na tabela).

export function getServerSupabase(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function sbServerHeaders(
  key: string,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}
