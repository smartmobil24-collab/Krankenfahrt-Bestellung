"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { STATUS, STATUS_LABEL } from "@/lib/options";

const POLL_MS = 8000;

const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
const fmtTs = (ts) => new Date(ts).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const fmtUhr = (ts) => new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const wtag = (iso) => TAG[new Date(iso + "T00:00:00Z").getUTCDay()];
const name = (o) => [o.nachname, o.vorname].filter(Boolean).join(", ");
const zeitText = (o) => ({
  "Abholung um": `Abholung ${o.zeit}`,
  "Abholung zwischen": `Abholung ${o.zeit}–${o.zeit_bis}`,
  "Termin um": `Termin ${o.zeit}`,
  "Ankommen vor": `Ankunft vor ${o.zeit}`,
}[o.anfrage_typ] || o.zeit);
const rueckText = (o) => o.rueckfahrt === "Nein" ? "" : o.rueckfahrt + (o.rueck_zeit ? ` ${o.rueck_zeit}` : "");
const istAbruf = (o) => o.rueckfahrt?.startsWith("Auf Abruf");
const offenerAbruf = (o) => o.abgerufen_am && !o.abruf_erledigt;
const abrufLink = (o) => `${location.origin}/abruf/${o.abruf_token}`;

// Neue Fahrten einer Serie zu einem Eintrag zusammenfassen
function gruppiere(list) {
  const m = new Map();
  for (const o of list) {
    const k = o.serie_id || "E" + o.id;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(o);
  }
  return [...m.values()].map((g) => g.sort((a, b) => a.datum.localeCompare(b.datum)));
}

export default function Admin() {
  const [auth, setAuth] = useState(null);
  const [pin, setPin] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("offen");
  const [q, setQ] = useState("");
  const [popNeu, setPopNeu] = useState([]);
  const [popAbruf, setPopAbruf] = useState([]);
  const [flash, setFlash] = useState(new Set());
  const [live, setLive] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [notifPerm, setNotifPerm] = useState("default");

  const maxId = useRef(0);
  const lastNow = useRef(null);
  const audio = useRef(null);
  const blink = useRef(null);
  const soundRef = useRef(false);
  soundRef.current = soundOn;

  // ---------- Ton ----------
  const unlockSound = () => {
    try {
      audio.current = audio.current || new (window.AudioContext || window.webkitAudioContext)();
      audio.current.resume();
      setSoundOn(true);
      ton([880, 1175], 1);
    } catch {}
  };
  const ton = (freqs, times) => {
    const ctx = audio.current;
    if (!ctx) return;
    for (let i = 0; i < times; i++) {
      freqs.forEach((freq, j) => {
        const t = ctx.currentTime + i * 0.7 + j * 0.18;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 0.4);
      });
    }
  };

  const systemMeldung = (titel, text, tag) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(titel, { body: text, tag, requireInteraction: true }); } catch {}
    }
  };
  const titelBlinken = (text) => {
    clearInterval(blink.current);
    let on = false;
    blink.current = setInterval(() => { document.title = (on = !on) ? text : "Polat Admin"; }, 900);
  };

  // ---------- Daten ----------
  const load = useCallback(async () => {
    const r = await fetch("/api/orders", { cache: "no-store" });
    if (r.status === 401) return setAuth(false);
    const j = await r.json();
    setOrders(j.orders || []);
    maxId.current = Math.max(0, ...(j.orders || []).map((o) => o.id));
    lastNow.current = j.now;
    setAuth(true);
  }, []);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/orders?since=${maxId.current}&abruf=${encodeURIComponent(lastNow.current || "")}`, { cache: "no-store" });
      if (r.status === 401) return setAuth(false);
      const j = await r.json();
      setLive(true);
      lastNow.current = j.now;
      const neu = j.orders || [];
      const abrufe = j.abrufe || [];
      if (!neu.length && !abrufe.length) return;
      const upd = [...neu, ...abrufe];
      if (neu.length) maxId.current = Math.max(maxId.current, ...neu.map((o) => o.id));
      setOrders((old) => [...neu, ...old.filter((o) => !upd.some((n) => n.id === o.id)).concat(abrufe)].sort((a, b) => b.id - a.id));
      setFlash((s) => new Set([...s, ...upd.map((o) => o.id)]));

      if (abrufe.length) {
        setPopAbruf((p) => [...abrufe, ...p.filter((x) => !abrufe.some((a) => a.id === x.id))]);
        if (soundRef.current) ton([1320, 990, 1320], 4);
        if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
        abrufe.forEach((o) => systemMeldung(`🔁 ABHOLEN: ${name(o)} ist fertig`, `${o.ziel}${o.abruf_hinweis ? "\n📍 " + o.abruf_hinweis : ""}`, "abruf-" + o.id));
        titelBlinken("🟠 RÜCKFAHRT ABRUFEN");
      }
      const online = neu.filter((o) => o.quelle !== "admin");
      if (online.length) {
        setPopNeu((p) => [...online, ...p]);
        if (soundRef.current) ton([880, 1175], 3);
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
        gruppiere(online).forEach((g) => {
          const o = g[0];
          systemMeldung(`🚕 Neue ${g.length > 1 ? "Serienfahrt (" + g.length + " Termine)" : "Bestellung"}: ${o.kategorie}`,
            `${fmtDate(o.datum)} ${o.zeit} · ${name(o)}\n${o.abholung} → ${o.ziel}`, "neu-" + o.id);
        });
        if (!abrufe.length) titelBlinken(`🔴 ${gruppiere(online).length} NEUE BESTELLUNG`);
      }
    } catch {
      setLive(false);
    }
  }, []);

  const schliessen = () => {
    setPopNeu([]);
    setPopAbruf([]);
    clearInterval(blink.current);
    document.title = "Polat Admin";
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!auth) return;
    if ("Notification" in window) setNotifPerm(Notification.permission);
    const t = setInterval(poll, POLL_MS);
    const vis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [auth, poll]);

  // ---------- Aktionen ----------
  const patchLocal = (ids, patch) => setOrders((os) => os.map((o) => (ids.includes(o.id) ? { ...o, ...patch } : o)));
  const api = (url, method, body) => fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());

  async function login(e) {
    e.preventDefault();
    setLoginErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    if (!r.ok) return setLoginErr("Falsche PIN");
    unlockSound();
    load();
  }
  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuth(false);
  }
  async function setStatus(id, status) {
    patchLocal([id], { status });
    setPopNeu((p) => p.filter((o) => o.id !== id));
    await api(`/api/orders/${id}`, "PATCH", { status });
  }
  async function serieStatus(o, status, abHeute) {
    const ab = abHeute ? todayIso() : null;
    if (status === "storniert" && !confirm(`Alle ${abHeute ? "künftigen " : ""}Termine dieser Serie (${name(o)}) stornieren?`)) return;
    const j = await api(`/api/serie/${o.serie_id}`, "PATCH", { status, ab });
    if (j.ids) patchLocal(j.ids, { status });
    setPopNeu((p) => p.filter((x) => x.serie_id !== o.serie_id));
  }
  async function abrufMelden(o) {
    patchLocal([o.id], { abgerufen_am: new Date().toISOString(), abruf_erledigt: false, abruf_hinweis: "telefonisch" });
    await api(`/api/orders/${o.id}`, "PATCH", { abruf: true });
  }
  async function abgeholt(o) {
    patchLocal([o.id], { abruf_erledigt: true });
    setPopAbruf((p) => p.filter((x) => x.id !== o.id));
    await api(`/api/orders/${o.id}`, "PATCH", { abruf_erledigt: true });
  }
  const saveNote = (id, notiz) => { patchLocal([id], { notiz }); api(`/api/orders/${id}`, "PATCH", { notiz }); };
  async function remove(id) {
    if (!confirm(`Fahrt Nr. ${id} endgültig löschen?`)) return;
    setOrders((os) => os.filter((o) => o.id !== id));
    await fetch(`/api/orders/${id}`, { method: "DELETE" });
  }
  async function askNotif() {
    setNotifPerm(await Notification.requestPermission());
  }

  function exportCsv(list) {
    const cols = ["Nr", "Serie", "Eingang", "Quelle", "Status", "Kategorie", "Auftraggeber", "Datum", "Anfrage", "Uhrzeit", "Bis", "Nachname", "Vorname", "Geburtsdatum", "Telefon", "E-Mail", "Wohnanschrift", "Transportart", "2er Team", "Keine Sammelfahrt", "Abholung", "Haltepunkte", "Ziel", "Grund", "Ausrüstung", "Informationen", "Krankenkasse", "Rückfahrt", "Rückfahrt Zeit", "Abgerufen", "Kommentar", "Fahrgast-Notizen", "Notiz intern", "Einwilligung"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = list.map((o) => [
      o.id, o.serie_id ? `${o.serie_id} (${o.serie_nr}/${o.serie_anzahl})` : "", fmtTs(o.erstellt_am), o.quelle, STATUS_LABEL[o.status], o.kategorie, o.auftraggeber,
      fmtDate(o.datum), o.anfrage_typ, o.zeit, o.zeit_bis, o.nachname, o.vorname, o.geburtsdatum ? fmtDate(o.geburtsdatum) : "", o.telefon, o.email, o.wohnanschrift,
      o.transportart, o.team2 ? "ja" : "", o.keine_sammel ? "ja" : "", o.abholung, (o.haltepunkte || []).join(" | "), o.ziel, o.grund,
      (o.ausruestung || []).join(", "), (o.informationen || []).join(", "), o.krankenkasse, o.rueckfahrt, o.rueck_zeit,
      o.abgerufen_am ? fmtTs(o.abgerufen_am) : "", o.kommentar, o.fahrgast_notizen, o.notiz,
      o.einwilligung_am ? `${o.einwilligung_art} ${fmtTs(o.einwilligung_am)}` : "",
    ].map(esc).join(";"));
    const blob = new Blob(["﻿" + [cols.join(";"), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Fahrten_${todayIso()}.csv`;
    a.click();
  }

  // ---------- Ansicht ----------
  if (auth === null) return <Shell><div className="empty">Lädt …</div></Shell>;
  if (auth === false)
    return (
      <Shell>
        <form className="card" onSubmit={login} style={{ maxWidth: 360, margin: "40px auto" }}>
          <h1>Admin-Bereich</h1>
          <label>PIN</label>
          <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} />
          {loginErr && <div className="err">{loginErr}</div>}
          <button className="btn block dark">Anmelden</button>
        </form>
      </Shell>
    );

  const t = todayIso(), morgen = addDays(t, 1);
  const aktiv = (o) => o.status !== "storniert";
  const F = {
    offen: (o) => o.status === "neu" || (o.status === "bestätigt" && o.datum >= t),
    neu: (o) => o.status === "neu",
    abrufe: (o) => offenerAbruf(o),
    heute: (o) => o.datum === t && aktiv(o),
    morgen: (o) => o.datum === morgen && aktiv(o),
    serien: (o) => !!o.serie_id && o.datum >= t && aktiv(o),
    alle: () => true,
  };
  const counts = Object.fromEntries(Object.entries(F).map(([k, fn]) => [k, orders.filter(fn).length]));
  const ql = q.trim().toLowerCase();
  const list = orders
    .filter(F[filter])
    .filter((o) => !ql || [o.nachname, o.vorname, o.telefon, o.abholung, o.ziel, o.kategorie, o.auftraggeber, String(o.id), o.serie_id].join(" ").toLowerCase().includes(ql))
    .sort((a, b) => filter === "alle" ? b.id - a.id : (a.datum + a.zeit).localeCompare(b.datum + b.zeit));

  const gruppenNeu = gruppiere(popNeu);

  return (
    <Shell admin onLogout={logout}>
      {(!soundOn || notifPerm !== "granted") && (
        <div className="banner">
          <span>🔔 Damit neue Bestellungen und Abrufe mit Ton und als System-Meldung erscheinen:</span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {!soundOn && <button className="btn sm" onClick={unlockSound}>Ton aktivieren</button>}
            {typeof Notification !== "undefined" && notifPerm === "default" && <button className="btn sm dark" onClick={askNotif}>Meldungen erlauben</button>}
            {notifPerm === "denied" && <small>Meldungen im Browser blockiert – in den Seiteneinstellungen erlauben.</small>}
          </span>
        </div>
      )}

      <div className="toolbar">
        <a className="btn" href="/admin/neu">+ Neue Fahrt</a>
        <div className="chips">
          {[["offen", "Offen"], ["neu", "Neu"], ["abrufe", "🔁 Abrufe"], ["heute", "Heute"], ["morgen", "Morgen"], ["serien", "Serien"], ["alle", "Alle"]].map(([k, l]) => (
            <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{l}<span className="n">{counts[k]}</span></button>
          ))}
        </div>
        <div className="grow" />
        <input placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 200 }} />
        <button className="btn ghost sm" onClick={() => exportCsv(list)}>⬇ Excel (CSV)</button>
      </div>

      <div className="meta" style={{ marginBottom: 10 }}>
        <span className={"dotlive" + (live ? "" : " off")} />
        {live ? `Live – prüft alle ${POLL_MS / 1000} Sek. auf neue Bestellungen und Abrufe` : "Keine Verbindung – versuche erneut …"}
      </div>

      {list.length === 0 ? <div className="empty">Keine Fahrten in dieser Ansicht.</div> :
        list.map((o) => (
          <Fahrt key={o.id} o={o} flash={flash.has(o.id)} onStatus={setStatus} onSerie={serieStatus}
            onAbruf={abrufMelden} onAbgeholt={abgeholt} onNote={saveNote} onDelete={remove} />
        ))}

      {/* -------- Popup: Rückfahrt abgerufen (hat Vorrang) -------- */}
      {popAbruf.length > 0 ? (
        <div className="pop-wrap" onClick={schliessen}>
          <div className="pop abruf-pop" onClick={(e) => e.stopPropagation()}>
            <div className="ring">🔁</div>
            <h2>{popAbruf.length === 1 ? "Fahrgast ist fertig – bitte abholen!" : `${popAbruf.length} Fahrgäste warten auf Abholung`}</h2>
            <div style={{ maxHeight: "55vh", overflow: "auto" }}>
              {popAbruf.map((o) => (
                <div key={o.id} className="order abgerufen">
                  <div className="when">{name(o)} <span className="tag abruf">seit {fmtUhr(o.abgerufen_am)}</span></div>
                  <div className="route"><div><span className="dot">●</span><b>{o.ziel}</b></div><div><span className="dot">▸</span>{o.abholung}</div></div>
                  {o.abruf_hinweis && <div className="meta">📍 {o.abruf_hinweis}</div>}
                  <div className="meta">{o.transportart}{o.team2 ? " · 2er Team" : ""}{o.telefon && <> · <a href={`tel:${o.telefon}`}>{o.telefon}</a></>}</div>
                  <div className="actions">
                    <button className="btn sm dark" onClick={() => abgeholt(o)}>Fahrer ist unterwegs ✓</button>
                    {o.telefon && <a className="btn sm ghost" href={`tel:${o.telefon}`}>Anrufen</a>}
                  </div>
                </div>
              ))}
            </div>
            <div className="btns"><button className="btn" onClick={schliessen}>OK, gesehen</button></div>
          </div>
        </div>
      ) : gruppenNeu.length > 0 && (
        /* -------- Popup: neue Bestellung -------- */
        <div className="pop-wrap" onClick={schliessen}>
          <div className="pop" onClick={(e) => e.stopPropagation()}>
            <div className="ring">🔔</div>
            <h2>{gruppenNeu.length === 1 ? "Neue Bestellung eingegangen" : `${gruppenNeu.length} neue Bestellungen`}</h2>
            <div style={{ maxHeight: "55vh", overflow: "auto" }}>
              {gruppenNeu.map((g) => {
                const o = g[0];
                return (
                  <div key={o.id} className="order s-neu">
                    <div className="when">
                      {g.length > 1 ? `Serie: ${g.length} Termine` : `${wtag(o.datum)}, ${fmtDate(o.datum)} · ${zeitText(o)}`}
                      <span className="tag">{o.kategorie}</span>
                    </div>
                    {g.length > 1 && (
                      <div className="meta">
                        {[...new Set(g.map((x) => wtag(x.datum)))].join("/")} · {fmtDate(g[0].datum)} – {fmtDate(g[g.length - 1].datum)} · {zeitText(o)}
                      </div>
                    )}
                    <div className="route"><div><span className="dot">●</span>{o.abholung}</div><div><span className="dot">▸</span>{o.ziel}</div></div>
                    <div className="meta">{name(o)} · {o.transportart}{o.telefon && <> · <a href={`tel:${o.telefon}`}>{o.telefon}</a></>}{rueckText(o) && <> · Rückfahrt: {rueckText(o)}</>}</div>
                    <div className="actions">
                      {g.length > 1
                        ? <button className="btn sm dark" onClick={() => serieStatus(o, "bestätigt", false)}>Alle {g.length} bestätigen</button>
                        : <button className="btn sm dark" onClick={() => setStatus(o.id, "bestätigt")}>Bestätigen</button>}
                      {o.telefon && <a className="btn sm ghost" href={`tel:${o.telefon}`}>Anrufen</a>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="btns"><button className="btn" onClick={schliessen}>OK, gesehen</button></div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Fahrt({ o, flash, onStatus, onSerie, onAbruf, onAbgeholt, onNote, onDelete }) {
  const [note, setNote] = useState(o.notiz || "");
  const [mehr, setMehr] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const kopiere = async () => { try { await navigator.clipboard.writeText(abrufLink(o)); setKopiert(true); setTimeout(() => setKopiert(false), 2000); } catch {} };
  const extras = [...(o.ausruestung || []), ...(o.informationen || [])];
  return (
    <div className={`order s-${o.status}${offenerAbruf(o) ? " abgerufen" : ""}${flash ? " flash" : ""}`}>
      <div className="head">
        <div className="when">
          {wtag(o.datum)}, {fmtDate(o.datum)} · {zeitText(o)}
          <span className="tag">{o.kategorie}</span>
          {o.status === "neu" && <span className="tag new">NEU</span>}
          {o.serie_id && <span className="tag serie">Serie {o.serie_nr}/{o.serie_anzahl}</span>}
          {offenerAbruf(o) && <span className="tag abruf">🔁 ABGERUFEN {fmtUhr(o.abgerufen_am)}</span>}
        </div>
        <div className="meta">Nr. {o.id} · {o.quelle === "admin" ? "angelegt" : "online"} {fmtTs(o.erstellt_am)}</div>
      </div>
      <div className="route">
        <div><span className="dot">●</span>{o.abholung}</div>
        {(o.haltepunkte || []).map((h, i) => <div key={i}><span className="dot">○</span>{h}</div>)}
        <div><span className="dot">▸</span>{o.ziel}</div>
      </div>
      <div className="meta">
        <b style={{ color: "var(--text)" }}>{name(o)}</b>
        {o.telefon && <> · <a href={`tel:${o.telefon}`}>{o.telefon}</a></>}
        {" · "}{o.transportart}
        {o.team2 && <span className="tag warn">2er Team</span>}
        {o.keine_sammel && <span className="tag warn">Keine Sammelfahrt</span>}
        {o.grund && <> · {o.grund}</>}
        {o.auftraggeber && <> · 🏢 {o.auftraggeber}</>}
        {rueckText(o) && <> · Rückfahrt: {rueckText(o)}</>}
      </div>
      {extras.length > 0 && <div className="meta" style={{ marginTop: 4 }}>🧰 {extras.join(" · ")}</div>}
      {offenerAbruf(o) && o.abruf_hinweis && <div className="meta" style={{ marginTop: 4 }}>📍 {o.abruf_hinweis}</div>}
      {o.kommentar && <div className="meta" style={{ marginTop: 4 }}>💬 {o.kommentar}</div>}

      <div className="actions">
        <select value={o.status} onChange={(e) => onStatus(o.id, e.target.value)}>
          {STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {o.status === "neu" && <button className="btn sm dark" onClick={() => onStatus(o.id, "bestätigt")}>Bestätigen</button>}
        {offenerAbruf(o) && <button className="btn sm dark" onClick={() => onAbgeholt(o)}>Fahrer unterwegs ✓</button>}
        {istAbruf(o) && !offenerAbruf(o) && o.datum === todayIso() && <button className="btn sm ghost" onClick={() => onAbruf(o)}>🔁 Abruf melden</button>}
        {o.telefon && <a className="btn sm ghost" href={`tel:${o.telefon}`}>Anrufen</a>}
        <button className="btn sm ghost" onClick={() => setMehr(!mehr)}>{mehr ? "Weniger" : "Mehr"}{o.notiz ? " ✎" : ""}</button>
      </div>

      {mehr && (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <div className="meta">
            {o.vorname && <>Vorname: {o.vorname} · </>}
            {o.geburtsdatum && <>Geb.: {fmtDate(o.geburtsdatum)} · </>}
            {o.email && <><a href={`mailto:${o.email}`}>{o.email}</a> · </>}
            {o.wohnanschrift && <>Wohnanschrift: {o.wohnanschrift} · </>}
            {o.krankenkasse && <>Kasse: {o.krankenkasse} · </>}
            {o.einwilligung_am
              ? <>✓ Datenschutz-Einwilligung {o.einwilligung_art} am {fmtTs(o.einwilligung_am)}</>
              : <span style={{ color: "#9a5b00" }}>⚠ Keine Datenschutz-Einwilligung erfasst</span>}
          </div>
          {o.fahrgast_notizen && <div className="meta" style={{ marginTop: 4 }}>👤 {o.fahrgast_notizen}</div>}
          {istAbruf(o) && o.abruf_token && (
            <div className="actions">
              <span className="meta">Abruf-Link für Fahrgast:</span>
              <button className="btn sm ghost" onClick={kopiere}>{kopiert ? "Kopiert ✓" : "Link kopieren"}</button>
              {o.telefon && <a className="btn sm ghost" target="_blank"
                href={`https://wa.me/${o.telefon.replace(/[^\d+]/g, "").replace(/^0/, "49").replace(/^\+/, "")}?text=${encodeURIComponent("Polat Transfer: Wenn Sie fertig sind, tippen Sie hier für Ihre Rückfahrt: " + abrufLink(o))}`}>WhatsApp</a>}
              <a className="btn sm ghost" href={abrufLink(o)} target="_blank">Öffnen</a>
            </div>
          )}
          {o.serie_id && (
            <div className="actions">
              <span className="meta">Ganze Serie:</span>
              <button className="btn sm ghost" onClick={() => onSerie(o, "bestätigt", false)}>Alle bestätigen</button>
              <button className="btn sm ghost" onClick={() => onSerie(o, "storniert", true)}>Ab heute stornieren</button>
            </div>
          )}
          <textarea style={{ marginTop: 8 }} value={note} placeholder="Interne Notiz, z. B. Fahrer, Fahrzeug" onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (o.notiz || "") && onNote(o.id, note)} />
          <div className="actions"><button className="btn sm ghost" onClick={() => onDelete(o.id)}>🗑 Fahrt löschen</button></div>
        </div>
      )}
    </div>
  );
}

function Shell({ children, admin, onLogout }) {
  return (
    <>
      <header className="top">
        <div className="inner">
          <div className="brand"><b>Polat <span>Transfer</span></b><small>Fahrten · Admin</small></div>
          {admin && <button className="btn sm ghost" style={{ color: "#fff", borderColor: "#41607f" }} onClick={onLogout}>Abmelden</button>}
        </div>
      </header>
      <main className="wide">{children}</main>
    </>
  );
}
