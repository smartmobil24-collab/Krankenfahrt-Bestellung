import FahrtForm from "@/components/FahrtForm";

export default function Bestellung() {
  return (
    <>
      <header className="top">
        <div className="inner">
          <div className="brand"><b>Polat <span>Transfer</span></b><small>Taxi &amp; Patientenfahrdienst Augsburg</small></div>
          <a className="tel" href="tel:+498212420613">📞 0821 2420613</a>
        </div>
      </header>
      <main>
        <FahrtForm />
      </main>
      <footer>
        Polat Transfer · Werner-von-Siemens-Str. 6 · 86159 Augsburg · <a href="mailto:fahrdienst.polat@outlook.de">fahrdienst.polat@outlook.de</a>
        <br /><a href="https://polattransfer.de/impressum">Impressum</a> · <a href="https://polattransfer.de/datenschutz">Datenschutz</a>
      </footer>
    </>
  );
}
