/* =====================================================================
   storage.js  ·  Speichern & Laden (localStorage) + Backup
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Sie ist die "Festplatte" der App. Alles, was du eingibst, liegt im
   localStorage des Browsers (also lokal auf deinem Geraet, ohne Server).
   Diese Datei kuemmert sich um:
     - Laden des gespeicherten Zustands beim Start  (load)
     - Speichern nach jeder Aenderung               (save)
     - Backup als JSON-Datei exportieren / importieren
     - Alles zuruecksetzen

   ZUSAMMENHANG:
     defaults.js  liefert den Anfangszustand, falls noch nichts da ist.
     app.js       ruft load() beim Start und save() nach jeder Aktion.

   Der aktuelle Zustand liegt waehrend der Laufzeit in  SK.state .
   ===================================================================== */

const SK_ = window.SK; // Abkuerzung
SK.storage = {};

/* ---------------------------------------------------------------------
   Ergaenzt fehlende Felder.
   Wenn die App spaeter ein neues Einstellungs-Feld bekommt, fehlt es in
   alten gespeicherten Daten. Diese Funktion fuellt solche Luecken mit den
   Standardwerten auf, ohne deine vorhandenen Werte zu ueberschreiben.
   Rein: gespeicherter Zustand. Raus: vervollstaendigter Zustand.
   --------------------------------------------------------------------- */
function mergeDefaults(saved) {
  const def = SK.defaultState();
  // Oberste Ebene
  const out = Object.assign({}, def, saved);
  // Einstellungen einzeln auffuellen (damit neue Optionen erscheinen)
  out.settings = Object.assign({}, def.settings, saved.settings || {});
  out.meta = Object.assign({}, def.meta, saved.meta || {});
  // Listen/Objekte: vorhandene benutzen, sonst Standard
  out.categories = saved.categories || def.categories;
  out.goals = saved.goals || def.goals;
  out.abos = saved.abos || def.abos;
  out.entries = saved.entries || [];
  out.debts = saved.debts || [];
  out.lists = saved.lists || def.lists;
  out.watchlist = saved.watchlist || def.watchlist;
  out.cryptoCache = saved.cryptoCache || { ts: 0, data: null };
  out.moneyResearch = saved.moneyResearch || { datum: '', text: '' };
  out.dailyLog = saved.dailyLog || {};
  /* Ferienmodus: fehlende Felder mit den Standardwerten auffuellen, vorhandene
     behalten (so bekommen Bestandsdaten den neuen Topf, ohne Datenverlust). */
  out.ferien = Object.assign({}, def.ferien, saved.ferien || {});
  if (!Array.isArray(out.ferien.ausgaben)) out.ferien.ausgaben = [];

  /* Einmalige v2-Nachruestung fuer bereits bestehende Installationen:
     fuegt die monatlichen Spar-Toepfe (Motorrad/Sparkonto) und die
     Wunschliste hinzu, falls sie noch fehlen. Laeuft genau einmal.
     Wichtig: am GESPEICHERTEN Zustand pruefen (nicht am mit Defaults
     aufgefuellten "out"), sonst greift der Marker nie. */
  if (!(saved.meta && saved.meta.seedV2)) {
    // alte Ziele auf das neue Format normalisieren (modus/monatlich ergaenzen)
    out.goals.forEach(function (g) {
      if (!g.modus) g.modus = 'ziel';
      if (g.monatlich == null) g.monatlich = 0;
    });
    const habenIds = out.goals.map(function (g) { return g.id; });
    def.goals.forEach(function (g) {
      if (g.modus === 'monatlich' && habenIds.indexOf(g.id) === -1) out.goals.push(g);
    });
    if (!out.lists || !out.lists.length) out.lists = def.lists;
    out.meta.seedV2 = true;
  }
  return out;
}

/* ---------------------------------------------------------------------
   load()  -> laedt den Zustand aus dem localStorage.
   Gibt es noch keine Daten (erster Start), wird der Standardzustand aus
   defaults.js genommen und gleich gespeichert.
   Rein: nichts. Raus: der Zustand (liegt danach in SK.state).
   --------------------------------------------------------------------- */
SK.storage.load = function () {
  let state;
  try {
    const raw = localStorage.getItem(SK.STORAGE_KEY);
    if (raw) {
      state = mergeDefaults(JSON.parse(raw)); // vorhandene Daten
    } else {
      state = SK.defaultState();               // allererster Start
    }
  } catch (e) {
    // Falls die Daten kaputt sind, lieber neu starten als abstuerzen.
    console.warn('Sparkurs: Konnte gespeicherte Daten nicht lesen, starte neu.', e);
    state = SK.defaultState();
  }
  SK.state = state;
  SK.storage.save(); // sicherstellen, dass etwas Gueltiges gespeichert ist
  return state;
};

/* ---------------------------------------------------------------------
   save()  -> schreibt SK.state zurueck in den localStorage.
   Wird nach jeder Aenderung aufgerufen. Sehr guenstig, da rein lokal.
   --------------------------------------------------------------------- */
SK.storage.save = function () {
  try {
    localStorage.setItem(SK.STORAGE_KEY, JSON.stringify(SK.state));
  } catch (e) {
    console.error('Sparkurs: Speichern fehlgeschlagen (Speicher voll?).', e);
    alert('Speichern fehlgeschlagen. Eventuell ist der Browser-Speicher voll.');
  }
};

/* ---------------------------------------------------------------------
   exportJSON()  -> gibt den gesamten Zustand als lesbaren JSON-Text zurueck.
   Wird fuer das manuelle Backup gebraucht.
   --------------------------------------------------------------------- */
SK.storage.exportJSON = function () {
  return JSON.stringify(SK.state, null, 2);
};

/* ---------------------------------------------------------------------
   downloadBackup()  -> bietet die Daten als Datei zum Herunterladen an.
   Dateiname enthaelt das heutige Datum, z.B. sparkurs-backup-2026-06-21.json
   --------------------------------------------------------------------- */
SK.storage.downloadBackup = function () {
  const text = SK.storage.exportJSON();
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sparkurs-backup-' + SK.dateKey() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ---------------------------------------------------------------------
   importFromText(text)  -> ersetzt den aktuellen Zustand durch ein Backup.
   Rein: der Textinhalt einer zuvor exportierten JSON-Datei.
   Raus: true bei Erfolg, sonst wird ein Fehler geworfen.
   ACHTUNG: ueberschreibt die aktuellen Daten komplett.
   --------------------------------------------------------------------- */
SK.storage.importFromText = function (text) {
  const parsed = JSON.parse(text); // wirft Fehler, wenn kein gueltiges JSON
  if (!parsed || typeof parsed !== 'object' || !parsed.settings) {
    throw new Error('Das sieht nicht nach einem Sparkurs-Backup aus.');
  }
  SK.state = mergeDefaults(parsed);
  SK.storage.save();
  return true;
};

/* ---------------------------------------------------------------------
   reset()  -> loescht alles und startet mit den Standardwerten neu.
   --------------------------------------------------------------------- */
SK.storage.reset = function () {
  SK.state = SK.defaultState();
  SK.storage.save();
};
