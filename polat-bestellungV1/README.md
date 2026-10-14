# Polat Transfer – Online-Bestellung

- **Kunden:** `https://DEINE-APP.vercel.app/` → Taxi / Krankenfahrt / Rollstuhl / Liegend / Flughafen bestellen
- **Admin:** `https://DEINE-APP.vercel.app/admin` → PIN-Login, alle Bestellungen, neue ploppen als Meldung mit Ton auf

## Einrichten (ca. 10 Minuten)

1. **GitHub:** Neues Repository anlegen (z. B. `polat-bestellung`) und den Inhalt dieses Ordners hochladen
   (auf github.com: „Add file → Upload files", alle Dateien/Ordner reinziehen, ohne `node_modules`).
2. **Vercel:** „Add New → Project" → das Repository importieren → **Deploy**.
3. **Datenbank:** Im Vercel-Projekt → **Storage → Create Database → Neon** → mit dem Projekt verbinden.
   Vercel setzt `DATABASE_URL` automatisch. Die Tabelle legt die App beim ersten Aufruf selbst an.
4. **Admin-PIN:** Vercel-Projekt → **Settings → Environment Variables**:
   - `ADMIN_PIN` = deine PIN (z. B. 6-stellig)
   - `ADMIN_SECRET` = beliebiger langer Zufallstext
5. **Redeploy:** Deployments → letzte Version → „⋯ → Redeploy" (damit die Variablen greifen).

## Meldungen als Admin

- `/admin` öffnen, PIN eingeben → einmal **„Ton aktivieren"** und **„Meldungen erlauben"** klicken.
- Die Seite prüft alle 8 Sekunden. Neue Bestellung → Popup mit Klingel, 3× Ton, Vibration (Handy),
  Windows-/Android-System-Meldung und blinkender Tab-Titel.
- **Wichtig:** Der Admin-Tab muss offen bleiben (darf im Hintergrund sein). Am besten im Büro-PC
  einen eigenen Browser-Tab anpinnen, am Handy über „Zum Startbildschirm hinzufügen" als App installieren.
- Am iPhone kommen System-Meldungen nur, wenn die App zum Home-Bildschirm hinzugefügt wurde.

## In die Website einbinden (WordPress/Avada)

Button „Jetzt Fahrt bestellen" mit Link auf die Vercel-Adresse, oder per iFrame:

```html
<iframe src="https://DEINE-APP.vercel.app/" style="width:100%;height:1500px;border:0"></iframe>
```

Eigene Adresse wie `bestellen.polattransfer.de`: Vercel → Settings → Domains → hinzufügen und den
angezeigten CNAME-Eintrag beim Domain-Anbieter eintragen.

## Serienfahrten

Im Formular „Serienfahrt" aktivieren, dann:
- **Feste Wochentage:** z. B. Mo/Mi/Fr (Dialyse), Zeitraum von–bis, Rhythmus jede / alle 2–4 Wochen.
  Einzelne Tage (Feiertag, Urlaub) im Kalender antippen → werden ausgelassen.
- **Einzelne Tage wählen:** beliebige Tage im Kalender antippen.
- Unten erscheint die Terminliste – die Uhrzeit kann pro Tag geändert werden.
- Jeder Termin wird als eigene Fahrt gespeichert (Serie 3/20 …); im Admin ganze Serie bestätigen oder ab heute stornieren.

## „Ich bin fertig – bitte abholen"

Bei Rückfahrt **„Auf Abruf"** bekommt jede Bestellung einen persönlichen Link (`/abruf/…`).
Der Fahrgast tippt den großen grünen Knopf → im Admin ploppt sofort eine orange Meldung mit eigenem Ton auf
(„Fahrgast ist fertig – bitte abholen", mit Wartepunkt). Bei Serien gilt ein Link für alle Termine – er greift immer
für die Fahrt von heute. Im Admin: Link kopieren / per WhatsApp schicken, oder „Abruf melden", wenn der Fahrgast anruft.

## Datenschutz

- Kunden müssen der Datenverarbeitung (inkl. Gesundheitsangaben bei Krankenfahrten) zustimmen – sonst wird nichts gespeichert.
- Zeitpunkt der Einwilligung wird als Nachweis gespeichert und steht im CSV-Export.
- Im Admin-Formular: „Telefonisch erteilt" / „Schriftlich liegt vor" auswählbar; fehlt sie, zeigt die Fahrt einen Hinweis.
- Bitte die Datenschutzerklärung auf polattransfer.de um die Online-Bestellung ergänzen (Hosting: Vercel, Datenbank: Neon).

## Funktionen Admin

- **+ Neue Fahrt** (`/admin/neu`): Formular wie Triptomatic – Status (Auszuführen / Bereits ausgeführt / Leerfahrt),
  Auftraggeber (Kunde / Firmenkunde), Fahrgast suchen & speichern, Transportart, 2er Team, keine Sammelfahrt,
  Haltepunkte, Grund, Anfrage (Abholung um / zwischen / Termin um / Ankommen vor), Ausrüstung, Informationen, Rückfahrt.

- Filter: Offen / Neu / Abrufe / Heute / Morgen / Serien / Alle, Suche nach Name, Telefon, Adresse, Nr.
- Status: Neu → Bestätigt → Erledigt / Storniert, interne Notiz (z. B. Fahrer, Fahrzeug)
- Direkt anrufen, Löschen, Export als CSV (öffnet in Excel mit Umlauten)
