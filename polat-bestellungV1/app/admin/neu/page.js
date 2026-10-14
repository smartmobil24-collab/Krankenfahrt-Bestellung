"use client";
import { useEffect, useState } from "react";
import FahrtForm from "@/components/FahrtForm";

export default function NeueFahrt() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    fetch("/api/fahrgaeste?firmen=1").then((r) => setOk(r.ok)).catch(() => setOk(false));
  }, []);
  return (
    <>
      <header className="top">
        <div className="inner">
          <div className="brand"><b>Polat <span>Transfer</span></b><small>Neue Fahrt anlegen</small></div>
          <a className="btn sm ghost" style={{ color: "#fff", borderColor: "#41607f" }} href="/admin">← Übersicht</a>
        </div>
      </header>
      <main>
        {ok === null && <div className="empty">Lädt …</div>}
        {ok === false && <div className="card">Bitte zuerst im <a href="/admin">Admin-Bereich</a> anmelden.</div>}
        {ok && <FahrtForm admin />}
      </main>
    </>
  );
}
