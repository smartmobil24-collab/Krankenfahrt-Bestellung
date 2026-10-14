"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KATEGORIEN, TRANSPORTARTEN, GRUENDE, ANFRAGE_TYPEN, AUSRUESTUNG, INFORMATIONEN, RUECKFAHRT, WOCHENTAGE, MAX_TERMINE,
} from "@/lib/options";

// ---------- Datums-Helfer (UTC, damit Sommer-/Winterzeit nichts verschiebt) ----------
const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (iso) => new Date(iso + "T00:00:00Z").getUTCDay();
const fmt = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
const TAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const alter = (geb) => {
  if (!geb) return "";
  const [y, m, d] = geb.split("-").map(Number);
  const [ty, tm, td] = todayIso().split("-").map(Number);
  const a = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  return a >= 0 && a < 130 ? `${a} J.` : "";
};

// Wochentag-Serie erzeugen
function serieTermine(von, bis, tage, intervall) {
  if (!von || !bis || bis < von || !tage.length) return [];
  const out = [];
  const startMontag = addDays(von, -((dow(von) + 6) % 7));
  for (let d = von, i = 0; d <= bis && i < 800; d = addDays(d, 1), i++) {
    const woche = Math.floor((Date.parse(d) - Date.parse(startMontag)) / (7 * 864e5));
    if (tage.includes(dow(d)) && woche % intervall === 0) out.push(d);
  }
  return out;
}

const LEER = {
  status: "bestätigt", kategorie: "Krankenfahrt", auftraggeberTyp: "Kunde", auftraggeber: "", fahrgast_id: null,
  nachname: "", vorname: "", geburtsdatum: "", telefon: "", email: "", wohnanschrift: "", fahrgast_notizen: "",
  transportart: "Gehfähig", team2: false, keine_sammel: false,
  abholung: "", haltepunkte: [], ziel: "", grund: "",
  serie: false, serieModus: "wochentage", tage: [], von: "", bis: "", intervall: 1, einzeln: [], ohne: [], zeiten: {},
  datum: "", anfrage_typ: "Abholung um", zeit: "", zeit_bis: "",
  ausruestung: [], informationen: [], krankenkasse: "", kommentar: "",
  rueckfahrt: "Nein", rueck_zeit: "", datenschutz: false, einwilligung_art: "", website: "",
};

export default function FahrtForm({ admin = false, onDone }) {
  const [f, setF] = useState(() => ({ ...LEER, datum: todayIso(), von: todayIso(), bis: addDays(todayIso(), 27) }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const up = (patch) => setF((o) => ({ ...o, ...patch }));
  const set = (k) => (e) => up({ [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const toggleIn = (k, v) => up({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });

  const minDatum = admin ? undefined : todayIso();
  const kranken = f.kategorie === "Krankenfahrt";

  // ---------- Termine ----------
  const termine = useMemo(() => {
    let list;
    if (!f.serie) list = f.datum ? [f.datum] : [];
    else if (f.serieModus === "wochentage") list = serieTermine(f.von, f.bis, f.tage, Number(f.intervall)).filter((d) => !f.ohne.includes(d));
    else list = [...f.einzeln].sort();
    if (!admin) list = list.filter((d) => d >= todayIso());
    return list;
  }, [f.serie, f.serieModus, f.datum, f.von, f.bis, f.tage, f.intervall, f.ohne, f.einzeln, admin]);

  const kalenderAuswahl = useMemo(() => new Set(termine), [termine]);
  const kalenderKlick = (d) => {
    if (f.serieModus === "einzeln") return toggleIn("einzeln", d);
    // Wochentage: Klick schließt einzelne Tage aus bzw. wieder ein
    if (serieTermine(f.von, f.bis, f.tage, Number(f.intervall)).includes(d)) toggleIn("ohne", d);
  };
  const entferne = (d) => (f.serieModus === "einzeln" ? toggleIn("einzeln", d) : toggleIn("ohne", d));
  const setZeit = (d, z) => up({ zeiten: { ...f.zeiten, [d]: z } });

  // ---------- Admin: Fahrgast-Suche & Firmenkunden ----------
  const [treffer, setTreffer] = useState([]);
  const [firmen, setFirmen] = useState([]);
  const [gespeichert, setGespeichert] = useState("");
  const suchTimer = useRef();
  useEffect(() => {
    if (!admin) return;
    fetch("/api/fahrgaeste?firmen=1").then((r) => r.json()).then((j) => setFirmen(j.firmen || [])).catch(() => {});
  }, [admin]);
  const sucheFahrgast = (q) => {
    if (!admin) return;
    clearTimeout(suchTimer.current);
    if (q.trim().length < 2) return setTreffer([]);
    suchTimer.current = setTimeout(async () => {
      const r = await fetch(`/api/fahrgaeste?q=${encodeURIComponent(q)}`);
      const j = await r.json().catch(() => ({}));
      setTreffer(j.fahrgaeste || []);
    }, 250);
  };
  const waehleFahrgast = (g) => {
    up({
      fahrgast_id: g.id, nachname: g.nachname || "", vorname: g.vorname || "", geburtsdatum: g.geburtsdatum || "",
      telefon: g.telefon || "", email: g.email || "", wohnanschrift: g.wohnanschrift || "", fahrgast_notizen: g.notizen || "",
      abholung: f.abholung || g.wohnanschrift || "",
    });
    setTreffer([]);
  };
  async function speichereFahrgast() {
    setGespeichert("");
    const r = await fetch("/api/fahrgaeste", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, id: f.fahrgast_id }),
    });
    const j = await r.json();
    if (r.ok) { up({ fahrgast_id: j.id }); setGespeichert("Gespeichert ✓"); } else setGespeichert(j.error || "Fehler");
  }

  // ---------- Absenden ----------
  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!termine.length) return setErr("Bitte mindestens einen Termin auswählen.");
    if (termine.length > MAX_TERMINE) return setErr(`Maximal ${MAX_TERMINE} Termine.`);
    setBusy(true);
    try {
      const body = {
        ...f,
        auftraggeber: f.auftraggeberTyp === "Firmenkunde" ? f.auftraggeber : "",
        geburtsdatum: f.geburtsdatum || null,
        grund: kranken ? f.grund : "",
        krankenkasse: kranken ? f.krankenkasse : "",
        haltepunkte: f.haltepunkte.filter((h) => h.trim()),
        termine: termine.map((d) => ({ datum: d, zeit: f.zeiten[d] || f.zeit, zeit_bis: f.zeit_bis })),
      };
      const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Fehler");
      setDone({ ...j, rueckfahrt: f.rueckfahrt, name: [f.vorname, f.nachname].filter(Boolean).join(" "), telefon: f.telefon });
      window.scrollTo(0, 0);
      onDone?.(j);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Erfolg done={done} admin={admin} onNeu={() => { setDone(null); setF({ ...LEER, datum: todayIso(), von: todayIso(), bis: addDays(todayIso(), 27) }); }} />;

  return (
    <form onSubmit={submit} className="fahrtform">
      {/* ---------------- Status / Auftraggeber (nur Admin) ---------------- */}
      {admin && (
        <div className="card">
          <h2>Status</h2>
          <Seg options={[["bestätigt", "Auszuführen"], ["ausgeführt", "Bereits ausgeführt"], ["leerfahrt", "Leerfahrt"]]} value={f.status} onChange={(v) => up({ status: v })} />
          <h2 style={{ marginTop: 18 }}>Auftraggeber</h2>
          <Seg options={[["Kunde", "Kunde"], ["Firmenkunde", "Firmenkunde"]]} value={f.auftraggeberTyp} onChange={(v) => up({ auftraggeberTyp: v })} />
          {f.auftraggeberTyp === "Firmenkunde" && (
            <>
              <input list="firmen" style={{ marginTop: 8 }} placeholder="Firmenkunden auswählen oder eingeben" value={f.auftraggeber} onChange={set("auftraggeber")} />
              <datalist id="firmen">{firmen.map((x) => <option key={x} value={x} />)}</datalist>
            </>
          )}
        </div>
      )}

      {/* ---------------- Fahrtart ---------------- */}
      {!admin && <h1>Fahrt bestellen</h1>}
      {!admin && <p className="lead">Taxi, Krankenfahrten und Serienfahrten (z. B. Dialyse, Bestrahlung) in Augsburg und Umgebung. Wir bestätigen Ihre Bestellung telefonisch.</p>}
      <div className="card">
        <h2>Art der Fahrt</h2>
        <Seg options={KATEGORIEN.map((k) => [k, k])} value={f.kategorie} onChange={(v) => up({ kategorie: v })} />
      </div>

      {/* ---------------- Fahrgast ---------------- */}
      <div className="card">
        <h2>Fahrgast</h2>
        <div className="row">
          <div className="ac">
            <label>Nachname *</label>
            <input required value={f.nachname} autoComplete="off"
              onChange={(e) => { up({ nachname: e.target.value, fahrgast_id: admin ? null : f.fahrgast_id }); sucheFahrgast(e.target.value); setGespeichert(""); }} />
            {treffer.length > 0 && (
              <div className="ac-list">
                {treffer.map((g) => (
                  <button type="button" key={g.id} onClick={() => waehleFahrgast(g)}>
                    <b>{g.nachname}{g.vorname ? ", " + g.vorname : ""}</b>
                    <small>{[g.geburtsdatum && fmt(g.geburtsdatum), g.telefon, g.wohnanschrift].filter(Boolean).join(" · ")}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div><label>Vorname</label><input value={f.vorname} onChange={set("vorname")} /></div>
        </div>
        <div className="row">
          <div><label>Geburtsdatum</label><input type="date" value={f.geburtsdatum} max={todayIso()} onChange={set("geburtsdatum")} /></div>
          <div><label>Alter</label><input value={alter(f.geburtsdatum)} readOnly tabIndex={-1} className="ro" /></div>
        </div>
        <div className="row">
          <div><label>Telefonnummer {!admin && "*"}</label><input type="tel" required={!admin} value={f.telefon} onChange={set("telefon")} autoComplete="tel" /></div>
          <div><label>E-Mail</label><input type="email" value={f.email} onChange={set("email")} autoComplete="email" /></div>
        </div>
        <label>Wohnanschrift</label>
        <input value={f.wohnanschrift} onChange={set("wohnanschrift")} autoComplete="street-address" />
        <label>Fahrgast-Notizen</label>
        <textarea maxLength={5000} value={f.fahrgast_notizen} onChange={set("fahrgast_notizen")} placeholder="z. B. schwerhörig, Schlüssel bei Nachbarn" />
        <div className="count">{f.fahrgast_notizen.length} / 5000</div>
        {admin && (
          <div className="actions">
            <button type="button" className="btn sm ghost" onClick={speichereFahrgast} disabled={!f.nachname}>{f.fahrgast_id ? "Fahrgast aktualisieren" : "Fahrgast speichern"}</button>
            <small className="meta">{gespeichert}</small>
          </div>
        )}
      </div>

      {/* ---------------- Fahrt ---------------- */}
      <div className="card">
        <h2>Fahrt</h2>
        <label>Transportart</label>
        <Seg options={TRANSPORTARTEN.map((t) => [t, t])} value={f.transportart} onChange={(v) => up({ transportart: v })} />

        <Switch checked={f.team2} onChange={(v) => up({ team2: v })} title="2er Team" text="Aktivieren, wenn für die Ausführung mindestens zwei Personen erforderlich sind." />
        {admin && <Switch checked={f.keine_sammel} onChange={(v) => up({ keine_sammel: v })} title="Keine Sammelfahrt erlaubt" text="Aktivieren, wenn diese Fahrt bei der Disposition nie mit einer anderen Fahrt verbunden werden darf." />}

        <label>Abholung *</label>
        <input required value={f.abholung} onChange={set("abholung")} placeholder="Straße, Hausnummer, Ort" />
        {f.wohnanschrift && f.abholung !== f.wohnanschrift && (
          <button type="button" className="link" onClick={() => up({ abholung: f.wohnanschrift })}>↳ Wohnanschrift übernehmen</button>
        )}

        {f.haltepunkte.map((h, i) => (
          <div key={i} className="stop">
            <label>Haltepunkt {i + 1}</label>
            <div className="inrow">
              <input value={h} onChange={(e) => up({ haltepunkte: f.haltepunkte.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className="btn sm ghost" onClick={() => up({ haltepunkte: f.haltepunkte.filter((_, j) => j !== i) })}>✕</button>
            </div>
          </div>
        ))}
        {f.haltepunkte.length < 10 && <button type="button" className="link" onClick={() => up({ haltepunkte: [...f.haltepunkte, ""] })}>+ Haltepunkt hinzufügen</button>}

        <label>Ziel *</label>
        <input required value={f.ziel} onChange={set("ziel")} placeholder="z. B. Universitätsklinikum Augsburg, Dialyse" />

        {kranken && (
          <>
            <label>Grund</label>
            <select value={f.grund} onChange={set("grund")}>
              <option value="">– bitte wählen –</option>
              {GRUENDE.map((g) => <option key={g}>{g}</option>)}
            </select>
          </>
        )}
      </div>

      {/* ---------------- Termin(e) ---------------- */}
      <div className="card">
        <h2>Termin</h2>
        <Switch checked={f.serie} onChange={(v) => up({ serie: v })} title="Serienfahrt" text="Aktivieren, wenn Fahrten an mehreren Terminen stattfinden (z. B. Dialyse, Bestrahlung, Physiotherapie)." />

        {!f.serie ? (
          <>
            <label>Datum *</label>
            <input type="date" required min={minDatum} value={f.datum} onChange={set("datum")} />
          </>
        ) : (
          <div className="serie">
            <Seg options={[["wochentage", "Feste Wochentage"], ["einzeln", "Einzelne Tage wählen"]]} value={f.serieModus} onChange={(v) => up({ serieModus: v })} />
            {f.serieModus === "wochentage" && (
              <>
                <label>Wochentage</label>
                <div className="days">
                  {WOCHENTAGE.map(([n, l]) => (
                    <button type="button" key={n} className={f.tage.includes(n) ? "on" : ""} onClick={() => toggleIn("tage", n)}>{l}</button>
                  ))}
                </div>
                <div className="quick">
                  <button type="button" className="link" onClick={() => up({ tage: [1, 3, 5] })}>Mo/Mi/Fr (Dialyse)</button>
                  <button type="button" className="link" onClick={() => up({ tage: [2, 4, 6] })}>Di/Do/Sa</button>
                  <button type="button" className="link" onClick={() => up({ tage: [1, 2, 3, 4, 5] })}>Mo–Fr</button>
                </div>
                <div className="row3">
                  <div><label>Von</label><input type="date" min={minDatum} value={f.von} onChange={set("von")} /></div>
                  <div><label>Bis</label><input type="date" min={f.von} value={f.bis} onChange={set("bis")} /></div>
                  <div>
                    <label>Rhythmus</label>
                    <select value={f.intervall} onChange={set("intervall")}>
                      <option value={1}>jede Woche</option>
                      <option value={2}>alle 2 Wochen</option>
                      <option value={3}>alle 3 Wochen</option>
                      <option value={4}>alle 4 Wochen</option>
                    </select>
                  </div>
                </div>
                <div className="quick">
                  {[[4, "4 Wochen"], [8, "8 Wochen"], [13, "3 Monate"], [26, "6 Monate"]].map(([w, l]) => (
                    <button type="button" key={w} className="link" onClick={() => up({ bis: addDays(f.von || todayIso(), w * 7 - 1) })}>{l}</button>
                  ))}
                </div>
                <p className="hint">Im Kalender einzelne Tage antippen, um sie auszulassen (z. B. Feiertage, Urlaub).</p>
              </>
            )}
            {f.serieModus === "einzeln" && <p className="hint">Tippen Sie im Kalender alle gewünschten Tage an.</p>}
            <Kalender auswahl={kalenderAuswahl} ausgelassen={f.serieModus === "wochentage" ? new Set(f.ohne) : null}
              min={minDatum} start={f.serieModus === "wochentage" ? f.von : null} onKlick={kalenderKlick} />
          </div>
        )}

        <label>Anfrage</label>
        <Seg options={ANFRAGE_TYPEN.map((a) => [a, a])} value={f.anfrage_typ} onChange={(v) => up({ anfrage_typ: v })} />
        <div className="row">
          <div><label>{f.anfrage_typ === "Abholung zwischen" ? "Von *" : "Uhrzeit *"}</label><input type="time" required value={f.zeit} onChange={set("zeit")} /></div>
          {f.anfrage_typ === "Abholung zwischen" && <div><label>Bis *</label><input type="time" required value={f.zeit_bis} onChange={set("zeit_bis")} /></div>}
        </div>

        {f.serie && termine.length > 0 && (
          <div className="terminliste">
            <div className="tl-head"><b>{termine.length} Termine</b><small>Uhrzeit pro Tag änderbar</small></div>
            <div className="tl-body">
              {termine.map((d) => (
                <div key={d} className="tl-row">
                  <span>{TAG[dow(d)]}, {fmt(d)}</span>
                  <input type="time" value={f.zeiten[d] || f.zeit} onChange={(e) => setZeit(d, e.target.value)} />
                  <button type="button" className="btn sm ghost" onClick={() => entferne(d)} title="Termin entfernen">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {f.serie && !termine.length && <p className="hint warn">Noch keine Termine – bitte Wochentage bzw. Tage im Kalender wählen.</p>}
      </div>

      {/* ---------------- Ausrüstung / Informationen ---------------- */}
      <div className="card">
        <h2>Ausrüstung</h2>
        <Chips list={AUSRUESTUNG} value={f.ausruestung} onToggle={(v) => toggleIn("ausruestung", v)} />
        <h2 style={{ marginTop: 18 }}>Informationen</h2>
        <Chips list={INFORMATIONEN} value={f.informationen} onToggle={(v) => toggleIn("informationen", v)} />
        {kranken && (
          <>
            <label>Krankenkasse</label>
            <input placeholder="z. B. AOK Bayern" value={f.krankenkasse} onChange={set("krankenkasse")} />
          </>
        )}
        <label>Kommentar</label>
        <textarea maxLength={5000} value={f.kommentar} onChange={set("kommentar")} placeholder="z. B. Stockwerk, Klingel, Begleitperson" />
        <div className="count">{f.kommentar.length} / 5000</div>
      </div>

      {/* ---------------- Rückfahrt ---------------- */}
      <div className="card">
        <h2>Rückfahrt</h2>
        <Seg options={RUECKFAHRT.map((r) => [r, r])} value={f.rueckfahrt} onChange={(v) => up({ rueckfahrt: v })} />
        {(f.rueckfahrt === "Bestimmte Zeit" || f.rueckfahrt === "Auf Abruf (mit Angabe)") && (
          <div className="row">
            <div>
              <label>{f.rueckfahrt === "Bestimmte Zeit" ? "Uhrzeit Rückfahrt *" : "Voraussichtlich gegen"}</label>
              <input type="time" required={f.rueckfahrt === "Bestimmte Zeit"} value={f.rueck_zeit} onChange={set("rueck_zeit")} />
            </div>
          </div>
        )}
        {f.rueckfahrt.startsWith("Auf Abruf") && (
          <p className="hint">Nach der Buchung {admin ? "bekommt der Fahrgast" : "bekommen Sie"} einen Link mit dem Knopf <b>„Ich bin fertig – bitte abholen"</b>. Ein Tipp darauf genügt, und wir kommen.</p>
        )}
      </div>

      {/* ---------------- Absenden ---------------- */}
      <div className="card">
        <input className="hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} aria-hidden="true" />
        <h2>Datenschutz</h2>
        {!admin ? (
          <label className="check consent">
            <input type="checkbox" required checked={f.datenschutz} onChange={set("datenschutz")} />
            <span>
              Ich bin damit einverstanden, dass Polat Transfer meine Angaben – bei Krankenfahrten einschließlich
              gesundheitsbezogener Angaben (z. B. Transportart, Grund der Fahrt, Hinweise) – zur Planung, Durchführung
              und Abrechnung der Fahrt speichert und verarbeitet. Ich kann die Einwilligung jederzeit per E-Mail an{" "}
              <a href="mailto:fahrdienst.polat@outlook.de">fahrdienst.polat@outlook.de</a> widerrufen.
              Weitere Informationen in der <a href="https://polattransfer.de/datenschutz" target="_blank">Datenschutzerklärung</a>. *
            </span>
          </label>
        ) : (
          <>
            <label>Einwilligung des Fahrgasts zur Datenverarbeitung</label>
            <Seg options={[["", "Nicht erfasst"], ["telefonisch", "Telefonisch erteilt"], ["schriftlich", "Schriftlich liegt vor"]]}
              value={f.einwilligung_art} onChange={(v) => up({ einwilligung_art: v })} />
          </>
        )}
        {err && <div className="err">{err}</div>}
        <button className="btn block" disabled={busy}>
          {busy ? "Wird gespeichert …" : admin
            ? (termine.length > 1 ? `${termine.length} Fahrten anlegen` : "Fahrt anlegen")
            : (termine.length > 1 ? `${termine.length} Fahrten verbindlich anfragen` : "Fahrt verbindlich anfragen")}
        </button>
      </div>
    </form>
  );
}

// ---------- Erfolgsseite mit Abruf-Link ----------
function Erfolg({ done, admin, onNeu }) {
  const [kopiert, setKopiert] = useState(false);
  const link = typeof window !== "undefined" ? `${location.origin}/abruf/${done.abruf_token}` : "";
  const mitAbruf = done.rueckfahrt?.startsWith("Auf Abruf");
  const text = `Polat Transfer: Wenn Sie fertig sind, tippen Sie hier für Ihre Rückfahrt: ${link}`;
  const kopieren = async () => { try { await navigator.clipboard.writeText(link); setKopiert(true); } catch {} };
  const tel = (done.telefon || "").replace(/[^\d+]/g, "");
  return (
    <div className="card ok-box">
      <div className="big">✅</div>
      <h1>{admin ? (done.anzahl > 1 ? `${done.anzahl} Fahrten angelegt` : "Fahrt angelegt") : "Vielen Dank!"}</h1>
      {!admin && <p>Ihre Bestellung {done.anzahl > 1 ? `(${done.anzahl} Termine)` : ""} ist bei uns eingegangen. Wir melden uns in Kürze telefonisch zur Bestätigung.</p>}
      {mitAbruf && (
        <div className="abruf-info">
          <b>🔔 Rückfahrt auf Abruf</b>
          <p>{admin ? "Diesen Link an den Fahrgast schicken" : "Speichern Sie diesen Link"} – wenn {admin ? "er" : "Sie"} fertig {admin ? "ist" : "sind"}, genügt ein Tipp auf „Ich bin fertig – bitte abholen"{done.anzahl > 1 ? ". Gilt für alle Termine der Serie" : ""}.</p>
          <div className="linkbox">{link}</div>
          <div className="actions" style={{ justifyContent: "center" }}>
            <button type="button" className="btn sm dark" onClick={kopieren}>{kopiert ? "Kopiert ✓" : "Link kopieren"}</button>
            <a className="btn sm ghost" href={`https://wa.me/${tel.replace(/^0/, "49").replace(/^\+/, "")}?text=${encodeURIComponent(text)}`} target="_blank">WhatsApp</a>
            <a className="btn sm ghost" href={`sms:${tel}?body=${encodeURIComponent(text)}`}>SMS</a>
            {!admin && <a className="btn sm ghost" href={link} target="_blank">Öffnen</a>}
          </div>
        </div>
      )}
      {!admin && <p className="lead">Bei dringenden Fahrten bitte direkt anrufen: <a href="tel:+498212420613">0821 2420613</a></p>}
      <div className="actions" style={{ justifyContent: "center" }}>
        <button className="btn dark" onClick={onNeu}>Weitere Fahrt {admin ? "anlegen" : "bestellen"}</button>
        {admin && <a className="btn ghost" href="/admin">Zur Übersicht</a>}
      </div>
    </div>
  );
}

// ---------- Kleine Bausteine ----------
function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button type="button" key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, title, text }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="knob" />
      <span><b>{title}</b><small>{text}</small></span>
    </label>
  );
}

function Chips({ list, value, onToggle }) {
  return (
    <div className="chips">
      {list.map((x) => (
        <button type="button" key={x} className={"chip" + (value.includes(x) ? " on" : "")} onClick={() => onToggle(x)}>{value.includes(x) ? "✓ " : ""}{x}</button>
      ))}
    </div>
  );
}

function Kalender({ auswahl, ausgelassen, min, start, onKlick }) {
  const basis = start || todayIso();
  const [monat, setMonat] = useState(basis.slice(0, 7));
  useEffect(() => { if (start) setMonat(start.slice(0, 7)); }, [start]);
  const erster = monat + "-01";
  const versatz = (dow(erster) + 6) % 7;
  const [y, m] = monat.split("-").map(Number);
  const tageImMonat = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const zellen = [...Array(versatz).fill(null), ...Array.from({ length: tageImMonat }, (_, i) => addDays(erster, i))];
  const blaettern = (n) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonat(d.toISOString().slice(0, 7)); };
  const heute = todayIso();
  const imMonat = [...auswahl].filter((d) => d.startsWith(monat)).length;
  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" onClick={() => blaettern(-1)}>‹</button>
        <b>{MONATE[m - 1]} {y}{imMonat ? <small> · {imMonat} Termine</small> : null}</b>
        <button type="button" onClick={() => blaettern(1)}>›</button>
      </div>
      <div className="cal-grid">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((t) => <div key={t} className="cal-dow">{t}</div>)}
        {zellen.map((d, i) => d ? (
          <button type="button" key={d} disabled={!!min && d < min}
            className={[auswahl.has(d) && "on", ausgelassen?.has(d) && "off", d === heute && "today"].filter(Boolean).join(" ")}
            onClick={() => onKlick(d)}>{Number(d.slice(8))}</button>
        ) : <div key={"x" + i} />)}
      </div>
    </div>
  );
}
