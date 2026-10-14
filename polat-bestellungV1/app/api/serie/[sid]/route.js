import { NextResponse } from "next/server";
import { sql, ensureTable } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { STATUS } from "@/lib/options";

export const dynamic = "force-dynamic";

// Status für eine ganze Serie setzen. ab = 'YYYY-MM-DD' → nur Termine ab diesem Tag.
// Bereits ausgeführte Fahrten und Leerfahrten bleiben unverändert.
export async function PATCH(req, { params }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { sid } = await params;
  const { status, ab } = await req.json();
  if (!STATUS.includes(status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  const von = /^\d{4}-\d{2}-\d{2}$/.test(ab || "") ? ab : "0000-00-00";
  await ensureTable();
  const rows = await sql()`
    UPDATE fahrten SET status = ${status}
    WHERE serie_id = ${sid} AND datum >= ${von} AND status NOT IN ('ausgeführt', 'leerfahrt')
    RETURNING id`;
  return NextResponse.json({ ok: true, ids: rows.map((r) => r.id) });
}
