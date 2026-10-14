import { neon } from "@neondatabase/serverless";

let _sql;
let _ready;

export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL fehlt – Neon-Datenbank in Vercel verbinden.");
    _sql = neon(url);
  }
  return _sql;
}

// Tabellen werden beim ersten Aufruf automatisch angelegt – keine Migration nötig.
// Datumsfelder als Text 'YYYY-MM-DD' (sortierbar, keine Zeitzonen-Probleme).
export async function ensureTable() {
  if (!_ready) {
    const db = sql();
    _ready = (async () => {
      await db`
        CREATE TABLE IF NOT EXISTS fahrten (
          id               SERIAL PRIMARY KEY,
          erstellt_am      TIMESTAMPTZ NOT NULL DEFAULT now(),
          quelle           TEXT NOT NULL DEFAULT 'online',
          status           TEXT NOT NULL DEFAULT 'neu',
          serie_id         TEXT,
          serie_nr         INT,
          serie_anzahl     INT,
          kategorie        TEXT NOT NULL DEFAULT 'Krankenfahrt',
          auftraggeber     TEXT,
          fahrgast_id      INT,
          nachname         TEXT NOT NULL,
          vorname          TEXT,
          geburtsdatum     TEXT,
          telefon          TEXT,
          email            TEXT,
          wohnanschrift    TEXT,
          fahrgast_notizen TEXT,
          transportart     TEXT NOT NULL DEFAULT 'Gehfähig',
          team2            BOOLEAN NOT NULL DEFAULT false,
          keine_sammel     BOOLEAN NOT NULL DEFAULT false,
          abholung         TEXT NOT NULL,
          haltepunkte      JSONB NOT NULL DEFAULT '[]',
          ziel             TEXT NOT NULL,
          grund            TEXT,
          datum            TEXT NOT NULL,
          anfrage_typ      TEXT NOT NULL DEFAULT 'Abholung um',
          zeit             TEXT NOT NULL,
          zeit_bis         TEXT,
          ausruestung      JSONB NOT NULL DEFAULT '[]',
          informationen    JSONB NOT NULL DEFAULT '[]',
          krankenkasse     TEXT,
          kommentar        TEXT,
          rueckfahrt       TEXT NOT NULL DEFAULT 'Nein',
          rueck_zeit       TEXT,
          notiz            TEXT
        )`;
      // "Ich bin fertig – bitte abholen": ein Link pro Auftrag (bei Serien für alle Termine gleich)
      await db`ALTER TABLE fahrten ADD COLUMN IF NOT EXISTS abruf_token TEXT`;
      await db`ALTER TABLE fahrten ADD COLUMN IF NOT EXISTS abgerufen_am TIMESTAMPTZ`;
      await db`ALTER TABLE fahrten ADD COLUMN IF NOT EXISTS abruf_hinweis TEXT`;
      await db`ALTER TABLE fahrten ADD COLUMN IF NOT EXISTS abruf_erledigt BOOLEAN NOT NULL DEFAULT false`;
      await db`CREATE INDEX IF NOT EXISTS fahrten_abruf_idx ON fahrten (abruf_token)`;
      // DSGVO-Nachweis: wann und wie eingewilligt wurde
      await db`ALTER TABLE fahrten ADD COLUMN IF NOT EXISTS einwilligung_am TIMESTAMPTZ`;
      await db`ALTER TABLE fahrten ADD COLUMN IF NOT EXISTS einwilligung_art TEXT`;
      await db`CREATE INDEX IF NOT EXISTS fahrten_datum_idx ON fahrten (datum, zeit)`;
      await db`CREATE INDEX IF NOT EXISTS fahrten_serie_idx ON fahrten (serie_id)`;
      await db`
        CREATE TABLE IF NOT EXISTS fahrgaeste (
          id            SERIAL PRIMARY KEY,
          aktualisiert  TIMESTAMPTZ NOT NULL DEFAULT now(),
          nachname      TEXT NOT NULL,
          vorname       TEXT,
          geburtsdatum  TEXT,
          telefon       TEXT,
          email         TEXT,
          wohnanschrift TEXT,
          notizen       TEXT
        )`;
    })().catch((e) => {
      _ready = null;
      throw e;
    });
  }
  return _ready;
}
