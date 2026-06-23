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
   requestPersistence()  -> bittet den Browser, die Daten NICHT zu loeschen.
   Wichtig auf dem iPhone/Handy: ohne diese Bitte raeumt das Betriebssystem
   den lokalen Speicher einer Web-App nach einiger Zeit der Nichtnutzung
   oder bei Speichermangel von selbst weg ("eviction"). Mit der Bitte um
   "persistenten" Speicher bleibt er deutlich zuverlaessiger erhalten.
   (Wird trotzdem nicht garantiert -> zusaetzlich ab und zu ein Backup!)
   --------------------------------------------------------------------- */
SK.storage.requestPersistence = function () {
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(function (already) {
        if (!already) navigator.storage.persist().catch(function () {});
      }).catch(function () {});
    }
  } catch (e) { /* nicht unterstuetzt -> egal */ }
};

/* ---------------------------------------------------------------------
   load()  -> laedt den Zustand aus dem localStorage.
   ROBUST: zerstoert NIE vorhandene Daten. Reihenfolge:
     1) Haupt-Schluessel lesen. Klappt das Parsen nicht, werden die
        Rohdaten unter CORRUPT_KEY aufbewahrt (nichts geht verloren).
     2) Sonst aus der Sicherungs-Kopie (BACKUP_KEY) wiederherstellen.
     3) Erst wenn wirklich gar nichts da ist: frischer Standardzustand.
   Rein: nichts. Raus: der Zustand (liegt danach in SK.state).
   --------------------------------------------------------------------- */
SK.storage.load = function () {
  let state = null;
  let raw = null;
  try {
    raw = localStorage.getItem(SK.STORAGE_KEY);
    if (raw) state = mergeDefaults(JSON.parse(raw)); // vorhandene Daten
  } catch (e) {
    // Haupt-Schluessel unleserlich -> Rohdaten sichern (NICHT ueberschreiben!)
    console.warn('Sparkurs: Hauptdaten unleserlich – versuche Sicherungspunkt.', e);
    try { if (raw) localStorage.setItem(SK.CORRUPT_KEY, raw); } catch (_) { /* egal */ }
    state = null;
  }
  // Fallback: aus der Sicherungs-Kopie wiederherstellen
  if (!state) {
    try {
      const bak = localStorage.getItem(SK.BACKUP_KEY);
      if (bak) { state = mergeDefaults(JSON.parse(bak)); console.warn('Sparkurs: aus Sicherungspunkt wiederhergestellt.'); }
    } catch (_) { state = null; }
  }
  // Letzter Ausweg: frischer Standardzustand (erster Start oder alles weg)
  if (!state) state = SK.defaultState();

  SK.state = state;
  SK.storage.save();             // sofort wieder gueltig + Sicherungspunkt anlegen
  SK.storage.requestPersistence();
  return state;
};

/* ---------------------------------------------------------------------
   save()  -> schreibt SK.state zurueck in den localStorage.
   Schreibt ZWEI Kopien: den Haupt-Schluessel und einen Sicherungspunkt.
   Wird nach jeder Aenderung aufgerufen. Sehr guenstig, da rein lokal.
   --------------------------------------------------------------------- */
SK.storage.save = function () {
  let json;
  try { json = JSON.stringify(SK.state); }
  catch (e) { console.error('Sparkurs: Zustand nicht serialisierbar.', e); return; }
  try {
    localStorage.setItem(SK.STORAGE_KEY, json);
    // Sicherungs-Kopie (best effort – darf das Hauptspeichern nicht stoeren)
    try { localStorage.setItem(SK.BACKUP_KEY, json); } catch (_) { /* egal */ }
  } catch (e) {
    console.error('Sparkurs: Speichern fehlgeschlagen (Speicher voll?).', e);
    if (SK.ui && SK.ui.toast) SK.ui.toast('Speichern fehlgeschlagen – Speicher voll?', true);
    else alert('Speichern fehlgeschlagen. Eventuell ist der Browser-Speicher voll.');
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
  // Datum des Backups merken (fuer die Backup-Erinnerung auf "Heute")
  SK.state.meta.lastBackupAt = SK.dateKey();
  SK.storage.save();
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
