import { NextResponse } from "next/server";
import { sql, ensureTable } from "@/lib/db";

export const dynamic = "force-dynamic";

const todayBerlin = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

// Bei Serien: die Fahrt von heute; sonst die einzige Fahrt des Auftrags
async function findeFahrt(token) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) return { list: [] };
  await ensureTable();
  const list = await sql()`
    SELECT id, datum, zeit, ziel, abholung, vorname, nachname, rueckfahrt, status, abgerufen_am, abruf_erledigt
    FROM fahrten WHERE abruf_token = ${token} ORDER BY datum`;
  const heute = todayBerlin();
  return { list, fahrt: list.find((f) => f.datum === heute && f.status !== "storniert"), heute };
}

const oeffentlich = (f) => f && {
  datum: f.datum,
  zeit: f.zeit,
  ziel: f.ziel,
  abholung: f.abholung,
  name: [f.vorname, f.nachname ? f.nachname[0] + "." : ""].filter(Boolean).join(" "),
  abgerufen_am: f.abruf_erledigt ? null : f.abgerufen_am,
};

export async function GET(_req, { params }) {
  const { token } = await params;
  const { list, fahrt, heute } = await findeFahrt(token);
  if (!list.length) return NextResponse.json({ error: "Link ungültig" }, { status: 404 });
  const naechste = list.find((f) => f.datum > heute && f.status !== "storniert");
  return NextResponse.json({ fahrt: oeffentlich(fahrt), naechste: naechste ? { datum: naechste.datum, zeit: naechste.zeit } : null });
}

export async function POST(req, { params }) {
  const { token } = await params;
  const { hinweis } = await req.json().catch(() => ({}));
  const { list, fahrt } = await findeFahrt(token);
  if (!list.length) return NextResponse.json({ error: "Link ungültig" }, { status: 404 });
  if (!fahrt) return NextResponse.json({ error: "Für heute ist keine Fahrt gebucht. Bitte rufen Sie uns an: 0821 2420613" }, { status: 400 });
  // Mehrfaches Drücken innerhalb von 3 Minuten ignorieren
  if (fahrt.abgerufen_am && !fahrt.abruf_erledigt && Date.now() - new Date(fahrt.abgerufen_am).getTime() < 3 * 60 * 1000) {
    return NextResponse.json({ ok: true, abgerufen_am: fahrt.abgerufen_am });
  }
  const [r] = await sql()`
    UPDATE fahrten SET abgerufen_am = now(), abruf_erledigt = false, abruf_hinweis = ${String(hinweis || "").trim().slice(0, 300) || null}
    WHERE id = ${fahrt.id} RETURNING abgerufen_am`;
  return NextResponse.json({ ok: true, abgerufen_am: r.abgerufen_am });
}
