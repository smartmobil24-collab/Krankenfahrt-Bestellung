import { NextResponse } from "next/server";
import crypto from "crypto";
import { sql, ensureTable } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import {
  KATEGORIEN, TRANSPORTARTEN, GRUENDE, ANFRAGE_TYPEN, AUSRUESTUNG, INFORMATIONEN, RUECKFAHRT, STATUS, MAX_TERMINE,
} from "@/lib/options";

export const dynamic = "force-dynamic";

const clean = (v, max = 300) => String(v ?? "").trim().slice(0, max);
const pick = (v, list, def) => (list.includes(v) ? v : def);
const pickMany = (arr, list) => (Array.isArray(arr) ? [...new Set(arr.filter((x) => list.includes(x)))] : []);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const todayBerlin = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

// Neue Fahrt / Serienfahrt anlegen (öffentlich + Admin)
export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  if (b.website) return NextResponse.json({ ok: true, ids: [] }); // Spam-Falle

  const admin = await isAdmin();
  const fail = (msg) => NextResponse.json({ error: msg }, { status: 400 });

  const f = {
    quelle: admin ? "admin" : "online",
    status: admin ? pick(b.status, STATUS, "bestätigt") : "neu",
    kategorie: pick(b.kategorie, KATEGORIEN, "Krankenfahrt"),
    auftraggeber: admin ? clean(b.auftraggeber, 150) || null : null,
    fahrgast_id: admin && Number.isInteger(b.fahrgast_id) ? b.fahrgast_id : null,
    nachname: clean(b.nachname, 100),
    vorname: clean(b.vorname, 100) || null,
    geburtsdatum: isDate(b.geburtsdatum) ? b.geburtsdatum : null,
    telefon: clean(b.telefon, 40) || null,
    email: clean(b.email, 120) || null,
    wohnanschrift: clean(b.wohnanschrift) || null,
    fahrgast_notizen: clean(b.fahrgast_notizen, 5000) || null,
    transportart: pick(b.transportart, TRANSPORTARTEN, "Gehfähig"),
    team2: !!b.team2,
    keine_sammel: !!b.keine_sammel,
    abholung: clean(b.abholung),
    haltepunkte: (Array.isArray(b.haltepunkte) ? b.haltepunkte : []).map((h) => clean(h)).filter(Boolean).slice(0, 10),
    ziel: clean(b.ziel),
    grund: GRUENDE.includes(b.grund) ? b.grund : null,
    anfrage_typ: pick(b.anfrage_typ, ANFRAGE_TYPEN, "Abholung um"),
    ausruestung: pickMany(b.ausruestung, AUSRUESTUNG),
    informationen: pickMany(b.informationen, INFORMATIONEN),
    krankenkasse: clean(b.krankenkasse, 120) || null,
    kommentar: clean(b.kommentar, 5000) || null,
    rueckfahrt: pick(b.rueckfahrt, RUECKFAHRT, "Nein"),
    rueck_zeit: isTime(b.rueck_zeit) ? b.rueck_zeit : null,
  };

  if (!f.nachname) return fail("Bitte den Namen des Fahrgasts angeben.");
  if (!admin && !f.telefon) return fail("Bitte eine Telefonnummer für Rückfragen angeben.");
  if (!f.abholung || !f.ziel) return fail("Bitte Abholung und Ziel angeben.");
  if (!admin && !b.datenschutz) return fail("Bitte der Datenschutzerklärung zustimmen.");
  if ((f.rueckfahrt === "Bestimmte Zeit") && !f.rueck_zeit) return fail("Bitte die Uhrzeit der Rückfahrt angeben.");

  // Termine: [{datum, zeit, zeit_bis}]
  const heute = todayBerlin();
  const seen = new Set();
  const termine = [];
  for (const t of Array.isArray(b.termine) ? b.termine : []) {
    const datum = clean(t?.datum, 10);
    const zeit = clean(t?.zeit, 5);
    const zeit_bis = clean(t?.zeit_bis, 5);
    if (!isDate(datum) || seen.has(datum)) continue;
    if (!admin && datum < heute) continue;
    if (!isTime(zeit)) return fail(`Bitte eine gültige Uhrzeit für den ${datum.split("-").reverse().join(".")} angeben.`);
    if (f.anfrage_typ === "Abholung zwischen" && !isTime(zeit_bis)) return fail("Bitte das Zeitfenster (von – bis) angeben.");
    seen.add(datum);
    termine.push({ datum, zeit, zeit_bis: f.anfrage_typ === "Abholung zwischen" ? zeit_bis : null });
  }
  if (!termine.length) return fail("Bitte mindestens einen gültigen Termin auswählen.");
  if (termine.length > MAX_TERMINE) return fail(`Maximal ${MAX_TERMINE} Termine pro Serie.`);
  termine.sort((a, b) => a.datum.localeCompare(b.datum));

  const serie_id = termine.length > 1 ? "S" + crypto.randomBytes(4).toString("hex").toUpperCase() : null;
  const n = termine.length;
  const abruf_token = crypto.randomBytes(9).toString("base64url");
  // Online: Zustimmung ist Pflicht (oben geprüft). Admin: optional, z. B. telefonisch eingeholt.
  const einwilligung_art = admin
    ? (["telefonisch", "schriftlich"].includes(b.einwilligung_art) ? b.einwilligung_art : null)
    : "online";

  try {
    await ensureTable();
    const db = sql();
    const hp = JSON.stringify(f.haltepunkte), au = JSON.stringify(f.ausruestung), inf = JSON.stringify(f.informationen);
    const queries = termine.map((t, i) => db`
      INSERT INTO fahrten
        (quelle, status, serie_id, serie_nr, serie_anzahl, kategorie, auftraggeber, fahrgast_id,
         nachname, vorname, geburtsdatum, telefon, email, wohnanschrift, fahrgast_notizen,
         transportart, team2, keine_sammel, abholung, haltepunkte, ziel, grund,
         datum, anfrage_typ, zeit, zeit_bis, ausruestung, informationen, krankenkasse, kommentar,
         rueckfahrt, rueck_zeit, abruf_token, einwilligung_am, einwilligung_art)
      VALUES
        (${f.quelle}, ${f.status}, ${serie_id}, ${serie_id ? i + 1 : null}, ${serie_id ? n : null},
         ${f.kategorie}, ${f.auftraggeber}, ${f.fahrgast_id},
         ${f.nachname}, ${f.vorname}, ${f.geburtsdatum}, ${f.telefon}, ${f.email}, ${f.wohnanschrift}, ${f.fahrgast_notizen},
         ${f.transportart}, ${f.team2}, ${f.keine_sammel}, ${f.abholung}, ${hp}::jsonb, ${f.ziel}, ${f.grund},
         ${t.datum}, ${f.anfrage_typ}, ${t.zeit}, ${t.zeit_bis}, ${au}::jsonb, ${inf}::jsonb, ${f.krankenkasse}, ${f.kommentar},
         ${f.rueckfahrt}, ${f.rueck_zeit}, ${abruf_token},
         ${einwilligung_art ? new Date().toISOString() : null}, ${einwilligung_art})
      RETURNING id`);
    const res = await db.transaction(queries);
    return NextResponse.json({ ok: true, ids: res.map((r) => r[0].id), serie_id, anzahl: n, abruf_token });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Speichern fehlgeschlagen. Bitte telefonisch bestellen: 0821 2420613" }, { status: 500 });
  }
}

// Admin: Fahrten abrufen.
// ?since=ID   → nur neuere Fahrten
// &abruf=ISO  → zusätzlich Fahrten, deren Rückfahrt seitdem abgerufen wurde
export async function GET(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  await ensureTable();
  const db = sql();
  const p = new URL(req.url).searchParams;
  const since = parseInt(p.get("since")) || 0;
  const abrufSeit = p.get("abruf");
  const [{ now }] = await db`SELECT now() AS now`;
  if (!since) {
    const rows = await db`SELECT * FROM fahrten WHERE datum >= to_char(now() - interval '60 days', 'YYYY-MM-DD') OR status = 'neu' ORDER BY id DESC LIMIT 3000`;
    return NextResponse.json({ orders: rows, now });
  }
  const rows = await db`SELECT * FROM fahrten WHERE id > ${since} ORDER BY id DESC`;
  const abrufe = abrufSeit && !isNaN(Date.parse(abrufSeit))
    ? await db`SELECT * FROM fahrten WHERE abgerufen_am > ${abrufSeit} AND id <= ${since} ORDER BY abgerufen_am`
    : [];
  return NextResponse.json({ orders: rows, abrufe, now });
}
