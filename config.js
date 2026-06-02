export default function handler(req, res) {
  // CORS — permite só o próprio site chamar esta rota
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas.' });
  }

  return res.status(200).json({ url, key });
}
