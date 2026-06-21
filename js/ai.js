/* =====================================================================
   ai.js  ·  KI-Coach (zwei Stufen)
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Sie liefert "schlaue" Analysen zu deinem Geld. Es gibt ZWEI Stufen:

   1) SMART-ANALYSE (immer an, offline, ohne Schluessel, kostenlos)
      Einfache Regeln werten deine Zahlen aus und geben Hinweise, z.B.
      "Du bist deinem Budget voraus" oder "Abos fressen X% deines Lohns".
      Das ist KEINE echte KI – nur clevere Wenn-Dann-Regeln auf dem Geraet.

   2) ECHTER KI-COACH (optional, braucht eigenen Anthropic-API-Schluessel)
      Wenn du in den Einstellungen einen Schluessel hinterlegst, kann die App
      echte Antworten von Claude (Anthropic) holen – eine persoenliche
      Auswertung deiner Ausgaben und taegliche Ideen, wie du Geld verdienen/
      sparen kannst.

   WICHTIG zur Stufe 2:
   - Der Schluessel bleibt NUR in deinem Browser (localStorage). Er wird nie
     ins Internet/Repo geschrieben ausser an Anthropic fuer deine Anfrage.
   - Die Anthropic-API kostet API-Guthaben – das ist GETRENNT von einem
     "Claude Max"-Abo. Du brauchst einen Schluessel von console.anthropic.com
     mit Guthaben.
   - Bei eingeschaltetem KI-Coach wird eine kurze Zusammenfassung deiner
     Finanzzahlen an Anthropic gesendet (damit der Coach etwas auswerten kann).
   - Nichts davon ist personalisierte Finanzberatung.
   ===================================================================== */

SK.ai = {};

/* Ist der echte KI-Coach nutzbar (eingeschaltet UND Schluessel vorhanden)? */
SK.ai.available = function () {
  return !!(SK.state.settings.aiAktiv && SK.state.settings.aiKey);
};

/* ---------------------------------------------------------------------
   STUFE 1: Smart-Analyse (Regeln, offline)
   Liefert ein Array von Hinweisen: { tone:'gut'|'warn'|'info', text }.
   --------------------------------------------------------------------- */
SK.ai.insights = function (state) {
  const c = SK.budget.compute(state);
  const out = [];

  // Tagesbudget heute schon ueberschritten?
  if (c.heuteNochVerfuegbar < 0) {
    out.push({ tone: 'warn', text: 'Du bist heute ' + SK.ui.fmt(-c.heuteNochVerfuegbar) + ' CHF über deinem Tagesbudget. Morgen wird der Spielraum dadurch kleiner.' });
  }

  // Tempo
  if (c.paceStatus === 'warnung') {
    out.push({ tone: 'warn', text: 'Tempo zu hoch: Du liegst ' + SK.ui.fmt(c.paceDiff) + ' CHF über dem, was du bis heute ausgegeben haben solltest. Ein paar ruhige Tage bringen dich zurück auf Kurs.' });
  } else if (c.paceStatus === 'gut') {
    out.push({ tone: 'gut', text: 'Gutes Tempo – du liegst ' + SK.ui.fmt(Math.abs(c.paceDiff)) + ' CHF unter dem Soll. Genau so weiter.' });
  }

  // Monats-Hochrechnung
  if (c.hochrechnungStatus === 'drueber' && c.tag > 3) {
    out.push({ tone: 'warn', text: 'Hochrechnung: Bei diesem Tempo gibst du diesen Monat rund ' + SK.ui.fmt(c.hochrechnung) + ' CHF aus – das sind ' + SK.ui.fmt(c.hochrechnung - c.verfuegbarMonat) + ' CHF über deinem verfügbaren Budget.' });
  }

  // Groesste Kategorie
  const cats = SK.budget.byCategory(state, new Date());
  if (cats.length && c.spendMonat > 0) {
    const top = cats[0];
    const anteil = Math.round((top.betrag / c.spendMonat) * 100);
    if (anteil >= 45) {
      out.push({ tone: 'info', text: top.name + ' macht ' + anteil + '% deiner Ausgaben diesen Monat aus (' + SK.ui.fmt(top.betrag) + ' CHF). Dort liegt dein grösster Hebel.' });
    }
  }

  // Abos im Verhaeltnis zum Lohn
  const aboSum = SK.budget.aboSum(state);
  if (state.settings.lohn > 0) {
    const aboAnteil = Math.round((aboSum / state.settings.lohn) * 100);
    if (aboAnteil >= 15) {
      out.push({ tone: 'warn', text: 'Deine Abos kosten ' + SK.ui.fmt(aboSum) + ' CHF/Monat – das sind ' + aboAnteil + '% deines Lohns. Im Abo-Radar findest du Kandidaten zum Kündigen.' });
    }
  }

  // Sparfortschritt (erstes aktives Ziel)
  const ziel = state.goals.find(function (g) { return !g.archiviert; });
  if (ziel) {
    const saved = SK.budget.goalSaved(state, ziel);
    if (ziel.modus !== 'monatlich' && ziel.ziel > 0) {
      const pct = Math.round((saved / ziel.ziel) * 100);
      if (pct >= 100) out.push({ tone: 'gut', text: 'Ziel "' + ziel.name + '" ist erreicht. Stark!' });
      else if (pct >= 50) out.push({ tone: 'gut', text: 'Sparziel "' + ziel.name + '": ' + pct + '% geschafft. Über die Hälfte!' });
    }
  }

  // Streak
  const streak = SK.budget.streak(state);
  if (streak >= 3) out.push({ tone: 'gut', text: streak + ' Tage in Folge unter Budget. Dranbleiben für den Streak!' });

  // offene Bussen
  const fines = SK.budget.finesOpen(state);
  if (fines > 0) out.push({ tone: 'info', text: 'Offene Bussen: ' + SK.ui.fmt(fines) + ' CHF. Schau im Schulden-Tab, dass du sie geplant abbaust.' });

  if (!out.length) out.push({ tone: 'gut', text: 'Alles im grünen Bereich – keine Auffälligkeiten. Sauber!' });
  return out;
};

/* ---------------------------------------------------------------------
   STUFE 2: Echter KI-Coach (Anthropic)
   --------------------------------------------------------------------- */

/* Baut eine kompakte Zusammenfassung deiner Zahlen fuer den Prompt. */
SK.ai.summary = function (state) {
  const c = SK.budget.compute(state);
  const cats = SK.budget.byCategory(state, new Date())
    .slice(0, 5).map(function (k) { return k.name + ' ' + Math.round(k.betrag) + ' CHF'; }).join(', ');
  const ziele = state.goals.filter(function (g) { return !g.archiviert; }).map(function (g) {
    const saved = Math.round(SK.budget.goalSaved(state, g));
    return g.modus === 'monatlich'
      ? (g.name + ' (' + g.monatlich + '/Monat, bisher ' + saved + ')')
      : (g.name + ' (' + saved + '/' + g.ziel + ' bis ' + g.zieldatum + ')');
  }).join('; ');
  return [
    'Monatslohn netto: ' + state.settings.lohn + ' CHF',
    'Fixkosten: ' + Math.round(c.fixkosten) + ' CHF/Monat',
    'reservierte Sparrate: ' + Math.round(c.sparrate) + ' CHF/Monat',
    'reservierte Schulden-Rate: ' + Math.round(c.schuldenRate) + ' CHF/Monat',
    'verfügbar diesen Monat: ' + Math.round(c.verfuegbarMonat) + ' CHF',
    'diesen Monat bereits ausgegeben: ' + Math.round(c.spendMonat) + ' CHF',
    'Tagesbudget heute: ' + Math.round(c.tagesbudget) + ' CHF',
    'Tempo: ' + (c.paceDiff > 0 ? (Math.round(c.paceDiff) + ' CHF voraus') : (Math.round(-c.paceDiff) + ' CHF unter Soll')),
    'Monats-Hochrechnung: ' + Math.round(c.hochrechnung) + ' CHF',
    'grösste Kategorien: ' + (cats || 'keine'),
    'Abos: ' + Math.round(SK.budget.aboSum(state)) + ' CHF/Monat',
    'offene Schulden: ' + Math.round(SK.budget.debtsTotalOpen(state)) + ' CHF',
    'Sparziele: ' + (ziele || 'keine')
  ].join('\n');
};

/* Schickt eine Anfrage an die Anthropic Messages API (direkt aus dem Browser).
   Rein: system-Prompt, user-Text, optional max_tokens.
   Raus: Promise mit dem Antworttext. Wirft bei Fehler. */
SK.ai.ask = async function (system, user, maxTokens) {
  const s = SK.state.settings;
  if (!s.aiKey) throw new Error('Kein API-Schlüssel hinterlegt (Einstellungen → KI-Coach).');
  // Notbremse: nach 60 s abbrechen, damit die App bei toter Verbindung nicht haengt.
  // (LLM-Antworten dauern laenger als ein Kurs-Abruf, darum grosszuegig.)
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 60000);
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': s.aiKey,
        'anthropic-version': '2023-06-01',
        // genau dieser Header erlaubt den direkten Browser-Aufruf (CORS)
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: s.aiModel || 'claude-opus-4-8',
        max_tokens: maxTokens || 800,
        system: system,
        messages: [{ role: 'user', content: user }]
      })
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Zeitüberschreitung – Verbindung zu Anthropic fehlgeschlagen.');
    throw new Error('Keine Verbindung zu Anthropic (offline?).');
  }
  clearTimeout(timer);
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const e = await res.json(); msg = (e.error && e.error.message) || msg; } catch (_) { /* ignore */ }
    if (res.status === 401) msg = 'API-Schlüssel ungültig oder kein Guthaben (401).';
    if (res.status === 429) msg = 'Zu viele Anfragen / Limit erreicht (429). Später nochmals.';
    throw new Error(msg);
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('Die Anfrage wurde abgelehnt.');
  const tb = (data.content || []).find(function (b) { return b.type === 'text'; });
  return tb ? tb.text : '';
};

const COACH_SYSTEM =
  'Du bist ein nüchterner, motivierender Finanz- und Budget-Coach für einen jungen Erwachsenen in der Schweiz. '
  + 'Antworte auf Deutsch in Schweizer Schreibweise (immer "ss", nie "ß"), kurz und konkret (höchstens ~160 Wörter), '
  + 'mit 2–4 umsetzbaren Tipps, die direkt auf die genannten Zahlen Bezug nehmen. Sei ehrlich, aber ermutigend. '
  + 'Antworte nur mit der finalen Antwort, ohne Gedankengang. '
  + 'Schliesse mit dem Satz: "Keine personalisierte Finanzberatung."';

/* Holt eine persoenliche Ausgaben-Analyse von Claude. */
SK.ai.analyze = function () {
  const user = 'Hier sind meine aktuellen Finanzzahlen für diesen Monat:\n\n' + SK.ai.summary(SK.state)
    + '\n\nGib mir eine kurze, ehrliche Einschätzung: Wo läuft es gut, wo gebe ich zu viel aus, und was sollte ich konkret als Nächstes tun?';
  return SK.ai.ask(COACH_SYSTEM, user, 800);
};

const IDEAS_SYSTEM =
  'Du bist ein nüchterner Finanz- und Karriere-Coach für einen 21-jährigen Gebäudetechnikplaner Lüftung in Zürich '
  + '(ca. 5000 CHF netto/Monat ab Sep 2026, wohnt günstig bei der Mutter, will Überausgaben stoppen und sparen, '
  + 'interessiert an Ethereum/Krypto und KI-Tools). Antworte auf Deutsch (Schweizer Schreibweise, immer "ss"). '
  + 'Antworte nur mit der finalen Antwort, ohne Gedankengang.';

/* Holt EINE konkrete Geld-Idee fuer heute. */
SK.ai.idea = function () {
  const user = 'Gib mir EINE konkrete, legale, realistische Idee für heute, um Geld zu verdienen oder Vermögen aufzubauen – '
    + 'aus genau einer dieser Kategorien: (1) mehr Lohn im Beruf, (2) skill-basiertes Nebeneinkommen, '
    + '(3) Gig/flexibel in Zürich, (4) sparen/investieren (Säule 3a, günstige ETF, DCA, Notgroschen, Krypto nur klein). '
    + 'Format: Titel, 2 Sätze Beschreibung, Aufwand/Ertrag, ein realistischer Haken. '
    + 'Keine Get-rich-quick-Tipps, kein Dropshipping-Hype, keine Scams. '
    + 'Schliesse mit dem Satz: "Keine personalisierte Finanzberatung."';
  return SK.ai.ask(IDEAS_SYSTEM, user, 600);
};
