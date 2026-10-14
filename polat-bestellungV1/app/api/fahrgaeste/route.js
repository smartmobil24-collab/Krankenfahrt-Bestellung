import { NextResponse } from "next/server";
import { sql, ensureTable } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const clean = (v, max = 300) => String(v ?? "").trim().slice(0, max) || null;

// Admin: Fahrgäste suchen (?q=) bzw. Firmenkunden-Liste (?firmen=1)
export async function GET(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  await ensureTable();
  const db = sql();
  const p = new URL(req.url).searchParams;
  if (p.get("firmen")) {
    const rows = await db`SELECT DISTINCT auftraggeber FROM fahrten WHERE auftraggeber IS NOT NULL ORDER BY auftraggeber LIMIT 200`;
    return NextResponse.json({ firmen: rows.map((r) => r.auftraggeber) });
  }
  const q = String(p.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ fahrgaeste: [] });
  const like = "%" + q.replace(/[%_]/g, "") + "%";
  const rows = await db`
    SELECT * FROM fahrgaeste
    WHERE nachname ILIKE ${like} OR vorname ILIKE ${like} OR (coalesce(vorname,'') || ' ' || nachname) ILIKE ${like}
    ORDER BY nachname, vorname LIMIT 10`;
  return NextResponse.json({ fahrgaeste: rows });
}

// Admin: Fahrgast speichern (mit id → aktualisieren)
export async function POST(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const b = await req.json();
  const g = {
    nachname: clean(b.nachname, 100),
    vorname: clean(b.vorname, 100),
    geburtsdatum: /^\d{4}-\d{2}-\d{2}$/.test(b.geburtsdatum || "") ? b.geburtsdatum : null,
    telefon: clean(b.telefon, 40),
    email: clean(b.email, 120),
    wohnanschrift: clean(b.wohnanschrift),
    notizen: clean(b.fahrgast_notizen, 5000),
  };
  if (!g.nachname) return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  await ensureTable();
  const db = sql();
  const rows = Number.isInteger(b.id)
    ? await db`
        UPDATE fahrgaeste SET nachname=${g.nachname}, vorname=${g.vorname}, geburtsdatum=${g.geburtsdatum},
          telefon=${g.telefon}, email=${g.email}, wohnanschrift=${g.wohnanschrift}, notizen=${g.notizen}, aktualisiert=now()
        WHERE id=${b.id} RETURNING id`
    : await db`
        INSERT INTO fahrgaeste (nachname, vorname, geburtsdatum, telefon, email, wohnanschrift, notizen)
        VALUES (${g.nachname}, ${g.vorname}, ${g.geburtsdatum}, ${g.telefon}, ${g.email}, ${g.wohnanschrift}, ${g.notizen})
        RETURNING id`;
  return NextResponse.json({ ok: true, id: rows[0]?.id });
}
