import { NextResponse } from "next/server";
import { sql, ensureTable } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { STATUS } from "@/lib/options";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  await ensureTable();
  const db = sql();
  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    await db`UPDATE fahrten SET status = ${b.status} WHERE id = ${id}`;
  }
  if (b.abruf === true) {
    // Fahrgast hat telefonisch Bescheid gegeben → Abruf manuell melden
    await db`UPDATE fahrten SET abgerufen_am = now(), abruf_erledigt = false, abruf_hinweis = 'telefonisch' WHERE id = ${id}`;
  }
  if (b.abruf_erledigt !== undefined) {
    await db`UPDATE fahrten SET abruf_erledigt = ${!!b.abruf_erledigt} WHERE id = ${id}`;
  }
  if (b.notiz !== undefined) {
    await db`UPDATE fahrten SET notiz = ${String(b.notiz).slice(0, 1000)} WHERE id = ${id}`;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req, { params }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { id } = await params;
  await ensureTable();
  await sql()`DELETE FROM fahrten WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
