/* =====================================================================
   defaults.js  ·  Standardwerte & Stammdaten von Sparkurs
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Hier stehen alle "Startwerte" der App an EINEM Ort:
     - der Schluessel, unter dem im Browser gespeichert wird
     - der komplette Anfangszustand (Einstellungen, Kategorien,
       Sparziele, Abos) beim allerersten Start
     - ein paar Hilfsfunktionen (eindeutige ID, heutiges Datum)

   WIE HAENGT SIE MIT DEN ANDEREN DATEIEN ZUSAMMEN?
     defaults.js  ->  storage.js  (laedt/speichert diesen Zustand)
                  ->  budget.js   (rechnet mit Lohn/Fixkosten/Zielen)
                  ->  ui.js       (zeigt Kategorien, Abos, Ziele an)

   WICHTIG: Alle Werte hier kannst du spaeter auch direkt in der App
   unter "Einstellungen" aendern. Diese Datei ist nur der Ausgangspunkt
   beim ersten Oeffnen (oder nach "Daten zuruecksetzen").

   Alle Dateien haengen sich an ein einziges globales Objekt "SK"
   (kurz fuer Sparkurs), damit nichts durcheinanderkommt.
   ===================================================================== */

const SK = window.SK || {};
window.SK = SK;

/* Version des Datenformats. Wird im Export mitgespeichert, damit ein
   spaeterer Import weiss, wie die Daten aufgebaut sind. */
SK.VERSION = 1;

/* Unter diesem Schluessel liegt der gesamte App-Zustand im localStorage
   des Browsers. Aendere ihn nicht, sonst findet die App alte Daten nicht. */
SK.STORAGE_KEY = 'sparkurs_v1';

/* ---------------------------------------------------------------------
   Hilfsfunktion: erzeugt eine eindeutige ID (z.B. fuer eine neue Ausgabe).
   Rein: nichts. Raus: ein kurzer, einmaliger Text wie "k7f3a9q2".
   --------------------------------------------------------------------- */
SK.uid = function () {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};

/* ---------------------------------------------------------------------
   Hilfsfunktion: heutiges Datum als Text "JJJJ-MM-TT" (z.B. 2026-06-21).
   Wir benutzen dieses Format ueberall, weil man es einfach vergleichen
   und nach Monat filtern kann.
   Rein: optional ein Date-Objekt. Raus: Datums-Text.
   --------------------------------------------------------------------- */
SK.dateKey = function (d) {
  d = d || new Date();
  const j = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0'); // Monat 1..12
  const t = String(d.getDate()).padStart(2, '0');      // Tag 1..31
  return j + '-' + m + '-' + t;
};

/* ---------------------------------------------------------------------
   Die Standard-Ausgabenkategorien.
   Jede Kategorie hat: id, Name, Farbe (fuer das Tortendiagramm) und ein
   kleines Symbol (Emoji) zur schnellen Erkennung.
   In den Einstellungen kannst du Kategorien hinzufuegen oder loeschen.
   --------------------------------------------------------------------- */
/* "icon" ist hier ein NAME aus js/icons.js (kein Emoji), z.B. 'food'. */
SK.DEFAULT_CATEGORIES = [
  { id: 'essen',     name: 'Essen',     color: '#ff8c42', icon: 'food' },
  { id: 'material',  name: 'Material',  color: '#4f9dff', icon: 'box' },
  { id: 'ausgang',   name: 'Ausgang',   color: '#c879ff', icon: 'glass' },
  { id: 'transport', name: 'Transport', color: '#2dd4bf', icon: 'tram' },
  { id: 'sonstiges', name: 'Sonstiges', color: '#94a3b8', icon: 'tag' }
];

/* Spezielle, fest eingebaute Kategorie fuer Geld, das du ins Sparziel
   verschiebst. Sie taucht NICHT in der normalen Kategorie-Auswahl auf und
   wird in der Ausgaben-Statistik (Tortendiagramm) ausgeblendet, weil
   Sparen ja keine "Ausgabe" im klassischen Sinn ist. */
SK.SAVING_CATEGORY = { id: 'sparen', name: 'Sparen', color: '#f4c14b', icon: 'coins' };

/* ---------------------------------------------------------------------
   Der komplette Anfangszustand der App.
   Wir geben eine FUNKTION zurueck (nicht ein festes Objekt), damit bei
   jedem Aufruf eine frische, unabhaengige Kopie entsteht.
   --------------------------------------------------------------------- */
SK.defaultState = function () {
  return {
    version: SK.VERSION,

    /* ---- Grundeinstellungen (Funktion: Tagesbudget-Berechnung) ---- */
    settings: {
      lohn: 1600,              // Monatslohn netto in CHF
      fixkosten: 580,          // Fixkosten pro Monat in CHF (Miete, etc.)
      abosInFixkosten: false,  // Sollen die Abos automatisch zu den Fixkosten dazugezaehlt werden?
                               //   AUS lassen, wenn deine 580 Fixkosten die Abos schon enthalten
                               //   (sonst werden sie doppelt gerechnet).
      schuldenRateAktiv: false,// Soll eine monatliche Schulden-Rate vom verfuegbaren Geld
                               //   abgezogen werden (genau wie die Sparrate)?
      schuldenRate: 0,         // Wenn aktiv: dieser Betrag pro Monat fuer den Schuldenabbau.
      waehrung: 'CHF'
    },

    /* ---- Ausgabenkategorien ---- */
    categories: SK.DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); }),

    /* ---- Sparziele (Funktion: Sparziel) ----
       Mehrere moeglich. "saved" wird NICHT hier gespeichert, sondern
       jederzeit aus den Spar-Buchungen + startGespart berechnet
       (siehe budget.js -> SK.budget.goalSaved). */
    goals: [
      {
        id: 'kroatien',
        name: 'Kroatien',
        ziel: 1000,               // Zielbetrag in CHF
        startGespart: 0,          // was du beim Anlegen schon hattest
        zieldatum: '2026-08-14',  // Wunschdatum JJJJ-MM-TT
        farbe: '#19e3a6',
        archiviert: false
      }
    ],

    /* ---- Abos (Funktion: Abo-Radar) ----
       betrag = Preis pro Monat. tag = Tag im Monat, an dem sich das Abo
       verlaengert (fuer die 3-Tage-Erinnerung); null = unbekannt/kein
       fixer Tag. aktiv = laeuft noch (false = gekuendigt). */
    abos: [
      { id: 'krankenkasse', name: 'Krankenkasse',     betrag: 200,  tag: null, aktiv: true, hinweis: '' },
      { id: 'claudemax',    name: 'Claude Max',        betrag: 100,  tag: null, aktiv: true, hinweis: '' },
      { id: 'gym',          name: 'Gym',               betrag: 60,   tag: null, aktiv: true, hinweis: '' },
      { id: 'chatgpt',      name: 'ChatGPT',           betrag: 20,   tag: null, aktiv: true, hinweis: '' },
      { id: 'revolut',      name: 'Revolut Premium',   betrag: 20,   tag: null, aktiv: true, hinweis: '' },
      { id: 'streaming',    name: 'Streaming/Musik',   betrag: 70,   tag: null, aktiv: true, hinweis: 'Netflix, Disney+, Prime Video, Apple Music, Spotify' },
      { id: 'discord',      name: 'Discord Nitro',     betrag: 9.5,  tag: 7,    aktiv: true, hinweis: '' },
      { id: 'gmx',          name: 'GMX Premium',       betrag: 4.5,  tag: 23,   aktiv: true, hinweis: '' },
      { id: 'icloud',       name: 'iCloud+',           betrag: 3,    tag: 15,   aktiv: true, hinweis: '' },
      { id: 'peakwatch',    name: 'PeakWatch PRO',     betrag: 6,    tag: 11,   aktiv: true, hinweis: '' },
      { id: 'psplus',       name: 'PS Plus',           betrag: 15,   tag: null, aktiv: true, hinweis: '' },
      { id: 'miro',         name: 'Miro',              betrag: 20,   tag: null, aktiv: true, hinweis: 'kündigen erwägen' }
    ],

    /* ---- Alle Geld-Buchungen (Funktion: Erfassen / Verlauf) ----
       Eine Buchung sieht so aus:
         { id, datum:'JJJJ-MM-TT', betrag: Zahl, typ:'ausgabe'|'sparen',
           kategorie: id (bei Ausgaben), goalId: id (bei Spar-Buchungen),
           notiz: Text }
       Es gibt KEINEN monatlichen "Reset": der Monatszaehler ergibt sich
       immer aus dem Datum (alle Buchungen des laufenden Monats). Dadurch
       bleiben vergangene Monate automatisch fuer die Statistik erhalten. */
    entries: [],

    /* ---- Schulden / Sonderausgaben (eigener Bereich) ----
       Einmalige groessere Verpflichtungen (z.B. Werkstattrechnung), die
       getrennt vom Alltags-Budget abbezahlt werden. Ein Posten sieht so aus:
         { id, name, gesamt: Zahl, faellig:'JJJJ-MM-TT'|null, notiz: Text,
           erledigt: false, zahlungen: [{ id, datum, betrag, notiz }] }
       WICHTIG: Diese Posten und ihre Teilzahlungen beeinflussen das normale
       Tagesbudget NICHT. Nur die optionale monatliche Schulden-Rate aus den
       Einstellungen (settings.schuldenRate) wird – wie die Sparrate – vorab
       vom verfuegbaren Monatsgeld abgezogen. */
    debts: [],

    /* ---- Tages-Logbuch (Funktion: Streak) ----
       Pro Tag merken wir uns: wie hoch war das Tagesbudget und wie viel
       wurde ausgegeben -> daraus entsteht die "Tage in Folge unter Budget".
       Schluessel = Datum, Wert = { budget, ausgegeben, unterBudget }. */
    dailyLog: {},

    /* ---- interne Notizen ---- */
    meta: {
      erstellt: SK.dateKey(),  // Datum des ersten Starts
      lastOpen: SK.dateKey()   // zuletzt geoeffnet (fuer Monatswechsel-Erkennung)
    }
  };
};
