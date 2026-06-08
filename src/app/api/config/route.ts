import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { error: "Variáveis de ambiente não configuradas." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { url, key },
    { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET" } }
  );
}
