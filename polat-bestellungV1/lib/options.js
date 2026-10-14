// Gemeinsame Auswahllisten für Formular, API und Admin

export const KATEGORIEN = ["Krankenfahrt", "Taxi", "Flughafentransfer"];

export const TRANSPORTARTEN = ["Gehfähig", "Tragestuhl", "Rollstuhl", "Liegend"];

export const GRUENDE = [
  "Dialyse", "Chemotherapie", "Strahlentherapie", "Arzttermin / Facharzt", "Ambulante OP",
  "Krankenhaus-Aufnahme", "Krankenhaus-Entlassung", "Verlegung", "Reha", "Therapie (Physio, Ergo …)", "Sonstiges",
];

export const ANFRAGE_TYPEN = ["Abholung um", "Abholung zwischen", "Termin um", "Ankommen vor"];

export const AUSRUESTUNG = ["Rollator", "Sauerstoff", "Tragestuhl/Treppensteiger", "Rampe", "Kindersitz", "Gepäck", "Faltrollstuhl"];

export const INFORMATIONEN = [
  "Transportschein liegt vor", "Begleitperson", "Infektion", "Übergewicht (> 130 kg)",
  "Demenz / orientierungslos", "Seh-/Hörbehinderung", "Treppen ohne Aufzug", "Abholung an der Wohnungstür",
];

export const RUECKFAHRT = ["Nein", "Auf Abruf", "Auf Abruf (mit Angabe)", "Bestimmte Zeit", "Warten am Abgabepunkt"];

// Bearbeitungs-Status. Im Admin-Formular heißen sie wie in Triptomatic.
export const STATUS = ["neu", "bestätigt", "ausgeführt", "leerfahrt", "storniert"];
export const STATUS_LABEL = {
  neu: "Neu",
  "bestätigt": "Auszuführen",
  "ausgeführt": "Bereits ausgeführt",
  leerfahrt: "Leerfahrt",
  storniert: "Storniert",
};

export const WOCHENTAGE = [
  [1, "Mo"], [2, "Di"], [3, "Mi"], [4, "Do"], [5, "Fr"], [6, "Sa"], [0, "So"],
];

export const MAX_TERMINE = 366;
