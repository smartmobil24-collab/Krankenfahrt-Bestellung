"use client";
import { useEffect, useState, use } from "react";

const fmt = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
const uhr = (ts) => new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export default function Abruf({ params }) {
  const { token } = use(params);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [hinweis, setHinweis] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`/api/abruf/${token}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) return setErr(j.error || "Fehler");
    setData(j);
  }
  useEffect(() => { load(); }, []);

  async function fertig() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/abruf/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hinweis }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData((d) => ({ ...d, fahrt: { ...d.fahrt, abgerufen_am: j.abgerufen_am } }));
      if (navigator.vibrate) navigator.vibrate(200);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const f = data?.fahrt;
  return (
    <>
      <header className="top">
        <div className="inner">
          <div className="brand"><b>Polat <span>Transfer</span></b><small>Rückfahrt abrufen</small></div>
          <a className="tel" href="tel:+498212420613">📞 0821 2420613</a>
        </div>
      </header>
      <main>
        {!data && !err && <div className="empty">Lädt …</div>}
        {err && !data && <div className="card"><div className="err">{err}</div></div>}

        {data && !f && (
          <div className="card ok-box">
            <div className="big">📅</div>
            <h1>Heute keine Fahrt gebucht</h1>
            {data.naechste
              ? <p>Ihre nächste Fahrt: <b>{fmt(data.naechste.datum)}, {data.naechste.zeit} Uhr</b>. Dieser Link funktioniert dann wieder.</p>
              : <p>Für diesen Auftrag sind keine weiteren Fahrten geplant.</p>}
            <p className="lead">Fragen? <a href="tel:+498212420613">0821 2420613</a></p>
          </div>
        )}

        {f && (
          <div className="card abruf">
            <p className="lead" style={{ textAlign: "center", marginBottom: 6 }}>
              {f.name} · {fmt(f.datum)}
            </p>
            <p style={{ textAlign: "center", margin: "0 0 18px" }}>
              Abholung bei: <b>{f.ziel}</b>
            </p>

            {f.abgerufen_am ? (
              <div className="ok-box" style={{ padding: "10px 0" }}>
                <div className="big">✅</div>
                <h1>Wir sind informiert!</h1>
                <p>Gemeldet um <b>{uhr(f.abgerufen_am)} Uhr</b>. Ein Fahrzeug ist auf dem Weg zu Ihnen.<br />Bitte halten Sie Ihr Telefon bereit.</p>
                <button className="btn ghost" onClick={load}>Aktualisieren</button>
              </div>
            ) : (
              <>
                <label>Wo warten Sie? <span className="opt">(optional)</span></label>
                <input placeholder="z. B. Haupteingang, Station 3, Raum 12" value={hinweis} onChange={(e) => setHinweis(e.target.value)} />
                <button className="btn abruf-btn" disabled={busy} onClick={fertig}>
                  {busy ? "Wird gesendet …" : <>Ich bin fertig<br /><small>Bitte abholen</small></>}
                </button>
              </>
            )}
            {err && <div className="err">{err}</div>}
          </div>
        )}
      </main>
    </>
  );
}
