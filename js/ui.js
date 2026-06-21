/* =====================================================================
   ui.js  ·  Anzeige / Darstellung (das, was du siehst)
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Sie verwandelt die Daten und Berechnungen in das, was auf dem
   Bildschirm erscheint: Zahlen, Listen, Balken, Diagramme. Sie aendert
   selbst KEINE Daten und rechnet nicht (das machen storage.js & budget.js) –
   sie liest nur ab und zeichnet.

   ZUSAMMENHANG:
     budget.js  -> liefert die Kennzahlen
     ui.js      -> zeigt sie an
     app.js     -> ruft SK.ui.render() nach jeder Aenderung auf

   Aufbau:
     A) kleine Helfer (Zahlen formatieren, hochzaehlen, Toast, Datum)
     B) eine render-Funktion pro Bildschirm
     C) SK.ui.render() ruft alles zusammen auf
   ===================================================================== */

SK.ui = {};
SK.ui.verlaufFilter = 'alle';   // aktueller Filter im Verlauf-Tab
SK.ui.debtArchiveOpen = false;  // ist das Schulden-Archiv aufgeklappt?
SK.ui.debtExpanded = {};        // welche Schulden-Posten zeigen ihre Zahlungsliste? (id -> true)

/* ============ A) HELFER ============ */

const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WOCHENTAGE = ['So','Mo','Di','Mi','Do','Fr','Sa'];

/* Recherchierte, bodenständige Wege zum Geldverdienen/-sparen (Schweiz, 2026).
   Werden im Geld-Ideen-Tab angezeigt – auch ohne KI. Quelle: eigene Recherche. */
SK.MONEY_IDEAS = [
  { gruppe: 'Mehr Einkommen im Beruf', items: [
    { t: 'Weiterbildung Techniker HF / Fachausweis', d: 'Der grösste Lohnhebel langfristig: erfahrene Gebäudetechnikplaner liegen bei ~8000+ CHF statt ~5300 als Einsteiger. Arbeitgeber zahlt oft mit. Erst nach 1–2 Jahren Praxis.' },
    { t: 'Auf gefragte Nische spezialisieren', d: 'Reinraum-/Spital-Lüftung, SIA-380-Nachweise, Inbetriebnahme/Messtechnik – Nischenwissen wird besser bezahlt und macht unkündbar.' },
    { t: 'Stellenwechsel nach ~2 Jahren', d: 'Der grösste Lohnsprung kommt in der CH meist durch Wechsel (+10–20%), nicht durch interne Erhöhung. Aber: die ersten Jahre Lernkurve nicht zu früh wegwerfen.' }
  ]},
  { gruppe: 'Skill-basiertes Nebeneinkommen', items: [
    { t: 'CAD / Revit / BIM-Freelancing', d: 'Plan-/Modellierarbeit remote für Büros mit Engpässen, 50–100 CHF/h. Erst Nebenbeschäftigungsklausel im Vertrag prüfen.' },
    { t: 'Nachhilfe / LAP-Vorbereitung', d: 'Lernende in Lüftung/Gebäudetechnik auf die LAP vorbereiten – dein frisches Wissen, 40–70 CHF/h. Deine LAP-Trainer-Apps sind ein perfektes Sprungbrett.' },
    { t: 'KI-gestützte Mikro-Dienste für KMU', d: 'Offerten-/Berichtstexte, kleine Tools, Foto-Doku für lokale Handwerker. Ergebnisse immer prüfen (Haftung). Echte Arbeit, kein „KI-Kurs"-Hype.' }
  ]},
  { gruppe: 'Flexibel / Gig in Zürich', items: [
    { t: 'Velo-/Foodkurier, Eventarbeit', d: 'Flexible Schichten via Coople/Adecco, ~25–35 CHF/h. Reine Zeit-gegen-Geld-Sache ohne Karrierewert – als kurzfristiger Spar-Booster.' }
  ]},
  { gruppe: 'Schlau sparen & investieren (CH)', items: [
    { t: 'Zuerst Notgroschen + Dauerauftrag', d: '3–6 Monatsausgaben auf ein separates Konto. Am Zahltag automatisch sparen („pay yourself first"). Der grösste Hebel ist die Sparrate, nicht die Rendite.' },
    { t: 'Säule 3a – der Steuer-Hebel', d: '2026 max. 7258 CHF/Jahr, voll vom steuerbaren Einkommen abziehbar (spart grob 1000–1500 CHF Steuern). Wertschriften-3a (ETF, z.B. finpension/VIAC/frankly) statt Zins-3a.' },
    { t: 'Günstiger Welt-ETF mit Sparplan (DCA)', d: 'Breit diversifiziert (z.B. FTSE All-World), monatlich gleichbleibend investieren. Schweizer Neobroker mit tiefen Gebühren: Saxo, neon, Yuh, Swissquote.' },
    { t: 'Krypto/ETH bewusst klein halten', d: 'Nur als kleine Beimischung (Faustregel ≤5–10%), nachdem Notgroschen, 3a und ETF stehen. Klumpenrisiko ist die Hauptgefahr. Seed-Phrase sichern, „garantierte Rendite" = Scam.' }
  ]}
];

/* Zahl als CHF-Text mit Schweizer Tausender-Trennzeichen (').
   fmt(1234.5)      -> "1'235"
   fmt(1234.5, 2)   -> "1'234.50"  */
SK.ui.fmt = function (n, dec) {
  dec = (dec == null) ? 0 : dec;
  if (!isFinite(n)) n = 0;
  const neg = n < 0;
  n = Math.abs(n);
  let s = n.toFixed(dec);
  let teile = s.split('.');
  teile[0] = teile[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return (neg ? '−' : '') + teile.join('.');
};

/* Zaehlt eine Zahl im Element weich von ihrem alten auf den neuen Wert hoch.
   So wirken Aktualisierungen lebendig statt "springend".
   Rein: das Element, der Zielwert, optional Nachkommastellen. */
SK.ui.countUp = function (el, to, dec) {
  dec = dec || 0;
  if (!el) return;
  const from = parseFloat(el.dataset.val || '0') || 0;
  el.dataset.val = to;
  if (Math.abs(to - from) < 0.5 && dec === 0) { el.textContent = SK.ui.fmt(to, dec); return; }
  const start = performance.now(), dauer = 550;
  function schritt(t) {
    const p = Math.min(1, (t - start) / dauer);
    const ease = 1 - Math.pow(1 - p, 3); // weich auslaufend
    el.textContent = SK.ui.fmt(from + (to - from) * ease, dec);
    if (p < 1) requestAnimationFrame(schritt); else el.textContent = SK.ui.fmt(to, dec);
  }
  requestAnimationFrame(schritt);
};

/* Kurze Bestaetigungs-Meldung unten ("Toast"). danger=true faerbt rot. */
SK.ui.toast = function (text, danger) {
  const t = document.getElementById('toast');
  document.getElementById('toast-text').textContent = text;
  t.classList.toggle('danger', !!danger);
  t.classList.add('show');
  clearTimeout(SK.ui._toastTimer);
  SK.ui._toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1900);
};

/* Findet eine Kategorie anhand ihrer id (mit sinnvollem Notfall-Wert). */
SK.ui.cat = function (id) {
  if (id === 'sparen') return SK.SAVING_CATEGORY;
  return SK.state.categories.find(function (c) { return c.id === id; })
      || { id: id, name: id || 'Sonstiges', color: '#94a3b8', icon: 'box' };
};

/* Wandelt ein Datum "JJJJ-MM-TT" in eine lesbare Tages-Ueberschrift.
   Heute/Gestern werden als solche benannt. */
SK.ui.dayLabel = function (datum) {
  const heute = SK.dateKey();
  const g = new Date(); g.setDate(g.getDate() - 1);
  if (datum === heute) return 'Heute';
  if (datum === SK.dateKey(g)) return 'Gestern';
  const d = new Date(datum + 'T00:00:00');
  return WOCHENTAGE[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()];
};

/* Tage bis zur naechsten Verlaengerung eines Abos (oder null). */
SK.ui.aboDaysUntil = function (abo) {
  if (!abo.aktiv || abo.tag == null) return null;
  const heute = new Date();
  const tagHeute = heute.getDate();
  const tageImMonat = SK.budget.daysInMonth(heute);
  let ziel = Math.min(abo.tag, tageImMonat);
  let diff = ziel - tagHeute;
  if (diff < 0) {
    // schon vorbei -> naechster Monat
    const naechster = new Date(heute.getFullYear(), heute.getMonth() + 1, Math.min(abo.tag, 28));
    diff = Math.round((naechster - new Date(heute.getFullYear(), heute.getMonth(), tagHeute)) / 86400000);
  }
  return diff;
};

/* ============ B) BILDSCHIRME ============ */

/* ---- Kopf: aktueller Monat ---- */
SK.ui.renderTop = function () {
  const d = new Date();
  document.getElementById('top-month').textContent = MONATE[d.getMonth()] + ' ' + d.getFullYear();
};

/* ---- HEUTE (Dashboard) ---- */
SK.ui.renderHeute = function () {
  const c = SK.budget.compute(SK.state);

  // Hero: grosse Zahl + Ampel
  const hero = document.getElementById('hero-card');
  hero.classList.remove('ampel-gruen', 'ampel-gelb', 'ampel-rot');
  hero.classList.add('ampel-' + c.ampel);
  SK.ui.countUp(document.getElementById('hd-heute'), Math.round(c.heuteNochVerfuegbar), 0);
  document.getElementById('hd-tagesbudget').textContent = SK.ui.fmt(c.tagesbudget);
  document.getElementById('hd-resttage').textContent = c.restTage;
  let pct = c.tagesbudget > 0 ? (c.heuteNochVerfuegbar / c.tagesbudget) * 100 : 0;
  pct = Math.max(0, Math.min(100, pct));
  document.getElementById('hd-ampelbar').style.width = pct + '%';

  // Tempo-Karte
  const pace = document.getElementById('pace-card');
  pace.classList.remove('gut', 'knapp', 'warnung');
  pace.classList.add(c.paceStatus);
  const paceIco = document.getElementById('hd-pace-icon');
  const paceTxt = document.getElementById('hd-pace');
  if (c.paceStatus === 'gut') {
    paceIco.innerHTML = SK.icon('check');
    paceTxt.innerHTML = 'Gut unterwegs! Du liegst <strong>' + SK.ui.fmt(Math.abs(c.paceDiff)) + ' CHF</strong> unter dem Soll für heute.';
  } else if (c.paceStatus === 'knapp') {
    paceIco.innerHTML = SK.icon('clock');
    paceTxt.innerHTML = 'Leicht über dem Schnitt – <strong>' + SK.ui.fmt(c.paceDiff) + ' CHF</strong> voraus. Heute etwas bremsen.';
  } else {
    paceIco.innerHTML = SK.icon('alert');
    paceTxt.innerHTML = 'Du bist deinem Budget <strong>' + SK.ui.fmt(c.paceDiff) + ' CHF</strong> voraus – heute besser zurückhalten.';
  }

  // Abo-Erinnerung (Verlaengerung in <= 3 Tagen)
  const bald = SK.state.abos
    .filter(function (a) { const d = SK.ui.aboDaysUntil(a); return d != null && d <= 3; })
    .map(function (a) { const d = SK.ui.aboDaysUntil(a); return a.name + ' (' + (d === 0 ? 'heute' : 'in ' + d + ' T') + ', ' + SK.ui.fmt(a.betrag, 2) + ' CHF)'; });
  const aboCard = document.getElementById('aboalert-card');
  if (bald.length) {
    aboCard.classList.remove('hidden');
    document.getElementById('hd-aboalert').textContent = bald.join(' · ');
  } else {
    aboCard.classList.add('hidden');
  }

  // Monatszahlen
  document.getElementById('hd-monat').textContent = SK.ui.fmt(c.spendMonat);
  document.getElementById('hd-rest').textContent = SK.ui.fmt(c.nochVerfuegbarMonat);

  // Hauptsparziel
  SK.ui.renderGoalMini();

  // Smart-Analyse (oben, max 3 Hinweise)
  SK.ui.renderInsights(document.getElementById('hd-insights'), 3);

  // Hero-Sparkline: Ausgaben der letzten 7 Tage (kumuliert -> Trend)
  document.getElementById('hd-spark').innerHTML = SK.charts.spark(SK.ui.last7DaysSpend(), { w: 120, h: 30 });

  // ETH-Mini
  SK.ui.renderEthMini();

  // Letzte Ausgaben (max 4)
  const letzte = SK.state.entries.slice().sort(SK.ui._sortEntries).slice(0, 4);
  document.getElementById('hd-letzte').innerHTML = letzte.length
    ? letzte.map(SK.ui._entryRow).join('')
    : '<div class="empty-hint">Noch keine Ausgaben. Tippe auf ＋ um zu starten.</div>';
};

/* Tages-Ausgaben der letzten 7 Tage (fuer die Hero-Sparkline). */
SK.ui.last7DaysSpend = function () {
  const arr = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = SK.dateKey(d);
    let s = 0;
    for (const e of SK.state.entries) {
      if (e.typ !== 'sparen' && e.datum === key) s += e.betrag;
    }
    arr.push(s);
  }
  return arr;
};

/* Wie viel wurde diesen Monat in EIN Ziel eingezahlt (fuer monatliche Toepfe). */
SK.ui.goalSavedThisMonth = function (goal) {
  const mk = SK.budget.monthKey(new Date());
  let s = 0;
  for (const e of SK.state.entries) {
    if (e.typ === 'sparen' && e.goalId === goal.id && e.datum.slice(0, 7) === mk) s += e.betrag;
  }
  return s;
};

/* Smart-Analyse-Hinweise in ein Element schreiben (Stufe 1, offline). */
SK.ui.renderInsights = function (el, max) {
  if (!el) return;
  let list = SK.ai.insights(SK.state);
  if (max) list = list.slice(0, max);
  el.innerHTML = list.map(function (i) {
    const ico = i.tone === 'gut' ? 'check' : (i.tone === 'warn' ? 'alert' : 'lightbulb');
    return '<div class="insight insight--' + i.tone + '"><span class="insight-ico" data-icon-x="' + ico + '">'
      + SK.icon(ico) + '</span><span>' + SK.ui.esc(i.text) + '</span></div>';
  }).join('');
};

/* Kleine ETH-Karte auf dem Dashboard (liest den Cache). */
SK.ui.renderEthMini = function () {
  const c = SK.markets.cached();
  const cur = (SK.state.settings.cryptoWaehrung || 'chf').toUpperCase();
  const priceEl = document.getElementById('hd-eth-price');
  const subEl = document.getElementById('hd-eth-sub');
  const chgEl = document.getElementById('hd-eth-chg');
  if (!c) { priceEl.textContent = '—'; subEl.textContent = 'Im Märkte-Tab laden'; chgEl.innerHTML = ''; return; }
  const eth = c.data.find(function (x) { return x.id === 'ethereum'; }) || c.data[0];
  if (!eth) return;
  priceEl.textContent = SK.ui.fmt(eth.current_price, 0) + ' ' + cur;
  const chg = eth.price_change_percentage_24h_in_currency;
  chgEl.innerHTML = SK.ui.changeBadge(chg);
  subEl.textContent = 'Stand: ' + SK.ui.timeAgo(c.ts);
};

/* Hilfs-Sortierung: neueste Buchung zuerst. */
SK.ui._sortEntries = function (a, b) {
  if (a.datum !== b.datum) return a.datum < b.datum ? 1 : -1;
  return a.id < b.id ? 1 : -1;
};

/* Baut eine einzelne Ausgaben-Zeile als HTML. */
SK.ui._entryRow = function (e) {
  const cat = SK.ui.cat(e.typ === 'sparen' ? 'sparen' : e.kategorie);
  const istSparen = e.typ === 'sparen';
  const notiz = e.notiz ? e.notiz : (istSparen ? 'ins Sparziel' : cat.name);
  return '<div class="entry" data-id="' + e.id + '">'
    + '<div class="entry-ico" style="background:' + cat.color + '22;color:' + cat.color + '">' + SK.icon(cat.icon) + '</div>'
    + '<div class="entry-main"><div class="entry-cat">' + cat.name + '</div><div class="entry-note">' + SK.ui.esc(notiz) + '</div></div>'
    + '<div class="entry-amt' + (istSparen ? ' saving' : '') + '">' + (istSparen ? '+' : '−') + SK.ui.fmt(e.betrag, 2) + '</div>'
    + '<div class="entry-actions">'
      + '<button data-act="edit" data-id="' + e.id + '" title="Bearbeiten">' + SK.icon('pencil') + '</button>'
      + '<button data-act="del" data-id="' + e.id + '" title="Löschen">' + SK.icon('trash') + '</button>'
    + '</div></div>';
};

/* Text sicher machen (verhindert, dass Notizen das Layout zerlegen). */
SK.ui.esc = function (s) {
  return String(s).replace(/[&<>"]/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
  });
};

/* Kleines, gefaerbtes Veraenderungs-Abzeichen (z.B. +1.23% gruen, -2% rot). */
SK.ui.changeBadge = function (pct) {
  if (pct == null || isNaN(pct)) return '';
  const up = pct >= 0;
  return '<span class="chg-badge ' + (up ? 'pos' : 'neg') + '">'
    + SK.icon(up ? 'arrowUp' : 'arrowDown', 'ic-sm')
    + (up ? '+' : '') + pct.toFixed(2) + '%</span>';
};

/* "vor X Min" – fuer den Aktualitaets-Stempel der Kurse. */
SK.ui.timeAgo = function (ts) {
  if (!ts) return '—';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return 'vor ' + min + ' Min';
  const h = Math.round(min / 60);
  if (h < 24) return 'vor ' + h + ' Std';
  return new Date(ts).toLocaleDateString('de-CH');
};

/* Hauptsparziel-Karte auf dem Dashboard.
   Zeigt das erste aktive Ziel mit Enddatum ('ziel'), sonst das erste aktive. */
SK.ui.renderGoalMini = function () {
  const ziel = SK.budget.hauptZiel(SK.state);
  const card = document.getElementById('goal-mini-card');
  if (!ziel) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  const saved = SK.budget.goalSaved(SK.state, ziel);
  document.getElementById('hd-zielname').innerHTML = SK.icon('target', 'ic-pre') + SK.ui.esc(ziel.name);

  if (ziel.modus === 'monatlich') {
    const mSaved = SK.ui.goalSavedThisMonth(ziel);
    const pct = ziel.monatlich > 0 ? Math.max(0, Math.min(100, (mSaved / ziel.monatlich) * 100)) : 0;
    document.getElementById('hd-zielpct').textContent = Math.round(pct) + '%';
    document.getElementById('hd-zielbar').style.width = pct + '%';
    document.getElementById('hd-zieltext').textContent = 'Diesen Monat ' + SK.ui.fmt(mSaved) + ' / ' + SK.ui.fmt(ziel.monatlich) + ' CHF · gesamt ' + SK.ui.fmt(saved) + ' CHF';
  } else {
    const pct = ziel.ziel > 0 ? Math.max(0, Math.min(100, (saved / ziel.ziel) * 100)) : 0;
    document.getElementById('hd-zielpct').textContent = Math.round(pct) + '%';
    document.getElementById('hd-zielbar').style.width = pct + '%';
    document.getElementById('hd-zieltext').textContent = SK.ui.fmt(saved) + ' / ' + SK.ui.fmt(ziel.ziel) + ' CHF';
  }
};

/* ---- VERLAUF ---- */
SK.ui.renderVerlauf = function () {
  // Filter-Chips
  const chips = [{ id: 'alle', name: 'Alle', icon: 'filter' }]
    .concat(SK.state.categories)
    .concat([SK.SAVING_CATEGORY]);
  document.getElementById('vl-filter').innerHTML = chips.map(function (c) {
    return '<button class="chip' + (SK.ui.verlaufFilter === c.id ? ' is-active' : '') + '" data-filter="' + c.id + '">'
      + SK.icon(c.icon) + ' ' + SK.ui.esc(c.name) + '</button>';
  }).join('');

  // Liste, gefiltert + nach Tagen gruppiert
  let liste = SK.state.entries.slice().sort(SK.ui._sortEntries);
  if (SK.ui.verlaufFilter !== 'alle') {
    liste = liste.filter(function (e) {
      return SK.ui.verlaufFilter === 'sparen' ? e.typ === 'sparen' : e.kategorie === SK.ui.verlaufFilter;
    });
  }
  const ziel = document.getElementById('vl-liste');
  if (!liste.length) { ziel.innerHTML = '<div class="empty-hint">Keine Einträge.</div>'; return; }
  let html = '', letzterTag = '';
  for (const e of liste) {
    if (e.datum !== letzterTag) { html += '<div class="entry-day-head">' + SK.ui.dayLabel(e.datum) + '</div>'; letzterTag = e.datum; }
    html += SK.ui._entryRow(e);
  }
  ziel.innerHTML = html;
};

/* ---- ZIELE ---- */
SK.ui.renderZiele = function () {
  const heute = new Date();
  const ziel = document.getElementById('zl-liste');
  if (!SK.state.goals.length) { ziel.innerHTML = '<div class="empty-hint">Noch kein Sparziel. Tippe auf ＋ Ziel.</div>'; return; }

  ziel.innerHTML = SK.state.goals.map(function (g) {
    const saved = SK.budget.goalSaved(SK.state, g);
    const proMonat = SK.budget.goalMonthlyRate(SK.state, g, heute);
    const actions = '<div class="goal-card-actions">'
      + '<button class="btn btn-accent btn-sm" data-act="deposit" data-goal="' + g.id + '">＋ Einzahlen</button>'
      + '<button class="btn btn-ghost btn-sm" data-act="editgoal" data-goal="' + g.id + '">Bearbeiten</button>'
      + '<button class="btn btn-ghost btn-sm" data-act="delgoal" data-goal="' + g.id + '">Löschen</button>'
      + '</div>';

    if (g.modus === 'monatlich') {
      // Fester Monats-Topf: Fortschritt = was diesen Monat schon drin ist.
      const mSaved = SK.ui.goalSavedThisMonth(g);
      const pct = g.monatlich > 0 ? Math.max(0, Math.min(100, (mSaved / g.monatlich) * 100)) : 0;
      return '<div class="card goal-card" data-goal="' + g.id + '">'
        + '<div class="row-between"><div class="goal-head-name">' + SK.icon('target', 'ic-pre') + SK.ui.esc(g.name) + '</div>'
          + '<span class="goal-badge alt">' + SK.ui.fmt(g.monatlich) + ' / Monat</span></div>'
        + '<div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div>'
        + '<div class="goal-mini-text">Diesen Monat ' + SK.ui.fmt(mSaved) + ' / ' + SK.ui.fmt(g.monatlich) + ' CHF</div>'
        + '<div class="goal-meta"><span>' + SK.icon('coins', 'ic-sm') + ' gesamt angespart: <b>' + SK.ui.fmt(saved) + '</b> CHF</span>'
          + '<span>fester Spar-Topf ohne Enddatum</span></div>'
        + actions + '</div>';
    }

    // Klassisches Ziel mit Datum.
    const pct = g.ziel > 0 ? Math.max(0, Math.min(100, (saved / g.ziel) * 100)) : 0;
    const erreicht = saved >= g.ziel && g.ziel > 0;
    const tageBis = Math.max(0, Math.round((new Date(g.zieldatum + 'T00:00:00') - heute) / 86400000));
    const fehlt = SK.budget.goalRemaining(SK.state, g);
    const proTag = tageBis > 0 ? fehlt / tageBis : fehlt;
    return '<div class="card goal-card' + (erreicht ? ' done' : '') + '" data-goal="' + g.id + '">'
      + '<div class="row-between"><div class="goal-head-name">' + SK.icon('target', 'ic-pre') + SK.ui.esc(g.name) + '</div>'
        + (erreicht ? '<span class="goal-badge">erreicht</span>' : '<span class="goal-mini-pct">' + Math.round(pct) + '%</span>') + '</div>'
      + '<div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div>'
      + '<div class="goal-mini-text">' + SK.ui.fmt(saved) + ' / ' + SK.ui.fmt(g.ziel) + ' CHF</div>'
      + '<div class="goal-meta">'
        + '<span>' + SK.icon('clock', 'ic-sm') + ' noch <b>' + tageBis + '</b> Tage</span>'
        + (erreicht ? '' : '<span>pro Monat: <b>' + SK.ui.fmt(proMonat) + '</b> CHF</span><span>pro Tag: <b>' + SK.ui.fmt(proTag, 2) + '</b> CHF</span>')
      + '</div>'
      + actions + '</div>';
  }).join('');
};

/* ---- ABOS ---- */
SK.ui.renderAbos = function () {
  const total = SK.budget.aboSum(SK.state);
  SK.ui.countUp(document.getElementById('ab-total'), total, 2);
  const aktive = SK.state.abos.filter(function (a) { return a.aktiv; }).length;
  document.getElementById('ab-sub').textContent = aktive + ' aktive Abos · '
    + (SK.state.settings.abosInFixkosten ? 'fliessen in die Fixkosten ein' : 'separat (nicht in Fixkosten)');

  document.getElementById('ab-liste').innerHTML = SK.state.abos.map(function (a) {
    const d = SK.ui.aboDaysUntil(a);
    const soon = d != null && d <= 3;
    let sub = '';
    if (!a.aktiv) sub = 'gekündigt';
    else if (a.tag != null) sub = 'Verlängerung am ' + a.tag + '.' + (soon ? ' · ' + (d === 0 ? 'heute!' : 'in ' + d + ' Tagen') : '');
    else sub = 'monatlich';
    return '<div class="abo' + (a.aktiv ? '' : ' inactive') + (soon ? ' soon' : '') + '" data-abo="' + a.id + '">'
      + '<div class="entry-ico"' + (soon ? ' style="color:var(--yellow)"' : '') + '>' + SK.icon(soon ? 'bell' : 'repeat') + '</div>'
      + '<div class="abo-main"><div class="abo-name">' + SK.ui.esc(a.name) + '</div>'
        + '<div class="abo-sub">' + SK.ui.esc(sub) + '</div>'
        + (a.hinweis ? '<div class="abo-flag">' + SK.icon('alert', 'ic-sm') + ' ' + SK.ui.esc(a.hinweis) + '</div>' : '')
      + '</div>'
      + '<div class="abo-right"><span class="abo-amt">' + SK.ui.fmt(a.betrag, 2) + '</span>'
        + '<input type="checkbox" class="switch" data-act="toggleabo" data-abo="' + a.id + '"' + (a.aktiv ? ' checked' : '') + '>'
        + '<button class="link-btn" data-act="editabo" data-abo="' + a.id + '">' + SK.icon('pencil') + '</button>'
      + '</div></div>';
  }).join('');
};

/* ---- SCHULDEN / SONDERAUSGABEN ---- */
SK.ui.renderSchulden = function () {
  // Summe aller offenen Schulden gross oben
  const offen = SK.budget.debtsTotalOpen(SK.state);
  SK.ui.countUp(document.getElementById('sc-total'), offen, 2);

  const offenePosten = SK.state.debts.filter(function (d) { return !d.erledigt; });
  let sub = offenePosten.length + (offenePosten.length === 1 ? ' offener Posten' : ' offene Posten');
  const fines = SK.budget.finesOpen(SK.state);
  if (fines > 0) sub += ' · davon Bussen ' + SK.ui.fmt(fines) + ' CHF';
  if (SK.state.settings.schuldenRateAktiv) {
    sub += ' · Rate ' + SK.ui.fmt(SK.state.settings.schuldenRate) + ' CHF/Monat eingeplant';
  }
  document.getElementById('sc-sub').textContent = sub;

  // offene Posten
  const liste = document.getElementById('sc-liste');
  liste.innerHTML = offenePosten.length
    ? offenePosten.map(function (d) { return SK.ui._debtCard(d, false); }).join('')
    : '<div class="empty-hint">Keine offenen Posten. Tippe auf ＋ Posten, um z.B. eine Werkstattrechnung anzulegen.</div>';

  // Archiv (erledigte Posten, einklappbar)
  const erledigt = SK.state.debts.filter(function (d) { return d.erledigt; });
  const wrap = document.getElementById('sc-archiv-wrap');
  if (!erledigt.length) {
    wrap.classList.add('hidden');
  } else {
    wrap.classList.remove('hidden');
    document.getElementById('sc-archiv-count').textContent = erledigt.length;
    document.querySelector('#sc-archiv-toggle .chev').classList.toggle('open', SK.ui.debtArchiveOpen);
    const arch = document.getElementById('sc-archiv');
    arch.classList.toggle('hidden', !SK.ui.debtArchiveOpen);
    arch.innerHTML = erledigt.map(function (d) { return SK.ui._debtCard(d, true); }).join('');
  }
};

/* Baut die Karte fuer EINEN Schulden-Posten (archived = im Archiv). */
SK.ui._debtCard = function (d, archived) {
  const paid = SK.budget.debtPaid(d);
  const offen = SK.budget.debtOpen(d);
  const pct = d.gesamt > 0 ? Math.min(100, (paid / d.gesamt) * 100) : 100;
  const expanded = !!SK.ui.debtExpanded[d.id];

  // Faelligkeit (optional)
  let faellHtml = '';
  if (d.faellig) {
    const tage = Math.round((new Date(d.faellig + 'T00:00:00') - new Date(SK.dateKey() + 'T00:00:00')) / 86400000);
    let txt, overdue = false;
    if (tage < 0) { txt = 'überfällig seit ' + Math.abs(tage) + ' T'; overdue = true; }
    else if (tage === 0) { txt = 'heute fällig'; overdue = true; }
    else { txt = 'fällig in ' + tage + ' T'; }
    faellHtml = '<span class="' + (overdue ? 'debt-overdue' : '') + '">' + SK.icon('clock', 'ic-sm') + ' ' + txt + '</span>';
  }

  // Zahlungsliste (aufklappbar)
  let payHtml = '';
  if (expanded) {
    const zs = (d.zahlungen || []).slice().sort(function (a, b) { return a.datum < b.datum ? 1 : -1; });
    payHtml = '<div class="pay-list">' + (zs.length
      ? zs.map(function (z) {
          return '<div class="pay-row"><span>' + SK.ui.dayLabel(z.datum) + (z.notiz ? ' · ' + SK.ui.esc(z.notiz) : '')
            + '</span><span><b>' + SK.ui.fmt(z.betrag, 2) + ' CHF</b> '
            + '<button data-act="delpay" data-debt="' + d.id + '" data-pay="' + z.id + '" title="Zahlung löschen">' + SK.icon('trash') + '</button></span></div>';
        }).join('')
      : '<div class="pay-row">Noch keine Teilzahlungen.</div>') + '</div>';
  }

  // Aktionen
  let actions;
  if (archived) {
    actions = '<button class="btn btn-ghost btn-sm" data-act="reopendebt" data-debt="' + d.id + '">Wieder öffnen</button>'
            + '<button class="btn btn-ghost btn-sm" data-act="deldebt" data-debt="' + d.id + '">Löschen</button>';
  } else {
    actions = '<button class="btn btn-accent btn-sm" data-act="addpay" data-debt="' + d.id + '">＋ Teilzahlung</button>'
            + '<button class="btn btn-ghost btn-sm" data-act="editdebt" data-debt="' + d.id + '">Bearbeiten</button>'
            + '<button class="btn btn-ghost btn-sm" data-act="donedebt" data-debt="' + d.id + '">Erledigt</button>';
  }
  const zCount = (d.zahlungen || []).length;

  const isBusse = d.kind === 'busse';
  return '<div class="card goal-card debt-card' + (archived ? ' debt-archived' : '') + '" data-debt="' + d.id + '">'
    + '<div class="row-between"><div class="goal-head-name">' + SK.icon(isBusse ? 'ticket' : 'receipt', 'ic-pre') + SK.ui.esc(d.name)
      + (isBusse ? ' <span class="kind-badge">Busse</span>' : '') + '</div>'
      + (archived ? '<span class="goal-badge">erledigt</span>' : '<span class="goal-mini-pct">' + Math.round(pct) + '%</span>') + '</div>'
    + '<div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div>'
    + '<div class="goal-mini-text">bezahlt ' + SK.ui.fmt(paid) + ' / ' + SK.ui.fmt(d.gesamt) + ' CHF · offen ' + SK.ui.fmt(offen) + ' CHF</div>'
    + '<div class="goal-meta">' + faellHtml
      + (d.notiz ? '<span>' + SK.ui.esc(d.notiz) + '</span>' : '')
      + (zCount ? '<button class="link-btn" data-act="togglepays" data-debt="' + d.id + '">' + (expanded ? 'Zahlungen ausblenden' : 'Zahlungen (' + zCount + ')') + '</button>' : '')
    + '</div>'
    + payHtml
    + '<div class="goal-card-actions">' + actions + '</div>'
  + '</div>';
};

/* ---- STATISTIK ---- */
SK.ui.renderStatistik = function () {
  const heute = new Date();
  // Linienchart
  SK.charts.lineChart(document.getElementById('st-line'), SK.budget.monthSeries(SK.state, heute));
  // Tortendiagramm + Legende
  const cats = SK.budget.byCategory(SK.state, heute);
  SK.charts.donut(document.getElementById('st-donut'), cats);
  document.getElementById('st-legende').innerHTML = cats.length
    ? cats.map(function (c) { return '<div class="legend-row"><span><i style="background:' + c.color + '"></i>' + SK.ui.esc(c.name) + '</span><b>' + SK.ui.fmt(c.betrag, 2) + '</b></div>'; }).join('')
    : '<span class="muted">Noch keine Ausgaben diesen Monat.</span>';

  // Kennzahlen
  const c = SK.budget.compute(SK.state);
  document.getElementById('st-streak').textContent = SK.budget.streak(SK.state);
  const avgDay = SK.budget.avgPerDay(SK.state, heute);
  document.getElementById('st-avgday').textContent = SK.ui.fmt(avgDay);
  document.getElementById('st-avgweek').textContent = SK.ui.fmt(avgDay * 7);
  document.getElementById('st-hoch').textContent = SK.ui.fmt(c.hochrechnung);
  const hoch = document.getElementById('hoch-card');
  hoch.style.borderColor = c.hochrechnungStatus === 'gut' ? 'rgba(34,211,154,0.45)' : 'rgba(255,93,108,0.45)';
  document.getElementById('st-hoch-foot').textContent = c.hochrechnungStatus === 'gut'
    ? 'im Plan (≤ ' + SK.ui.fmt(c.verfuegbarMonat) + ')'
    : 'über dem Budget von ' + SK.ui.fmt(c.verfuegbarMonat);

  // Vergleich zum Vormonat
  const vm = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
  const vmSpend = SK.budget.spendMonth(SK.state, vm);
  const vmHasData = SK.budget.monthEntries(SK.state, vm).length > 0;
  document.getElementById('st-vormonat').textContent = vmHasData
    ? 'Letzter Monat: ' + SK.ui.fmt(vmSpend) + ' CHF · aktuell: ' + SK.ui.fmt(c.spendMonat) + ' CHF'
    : 'Noch keine Vergleichsdaten – kommt nächsten Monat.';

  // Schulden-Block
  document.getElementById('st-schulden').textContent = SK.ui.fmt(SK.budget.debtsTotalOpen(SK.state));
  document.getElementById('st-schulden-monat').textContent = SK.ui.fmt(SK.budget.debtsPaidThisMonth(SK.state, heute));
};

/* ---- EINSTELLUNGEN ---- */
SK.ui.renderEinstellungen = function () {
  document.getElementById('se-lohn').value = SK.state.settings.lohn;
  document.getElementById('se-fixkosten').value = SK.state.settings.fixkosten;
  document.getElementById('se-aboswitch').checked = SK.state.settings.abosInFixkosten;
  // Schulden-Rate
  const schuldenAktiv = SK.state.settings.schuldenRateAktiv;
  document.getElementById('se-schuldenswitch').checked = schuldenAktiv;
  const rateInput = document.getElementById('se-schuldenrate');
  rateInput.value = SK.state.settings.schuldenRate;
  rateInput.disabled = !schuldenAktiv;
  document.getElementById('se-schuldenrate-wrap').style.opacity = schuldenAktiv ? '1' : '0.45';

  // KI-Coach
  const aiAktiv = SK.state.settings.aiAktiv;
  document.getElementById('se-aiswitch').checked = aiAktiv;
  document.getElementById('se-aikey').value = SK.state.settings.aiKey || '';
  document.getElementById('se-aimodel').value = SK.state.settings.aiModel || 'claude-opus-4-8';
  document.getElementById('se-aikey-wrap').style.opacity = aiAktiv ? '1' : '0.45';

  // Märkte
  document.getElementById('se-cryptocur').value = SK.state.settings.cryptoWaehrung || 'chf';

  document.getElementById('se-version').textContent = '2.0';

  document.getElementById('se-kategorien').innerHTML = SK.state.categories.map(function (c) {
    return '<div class="cat-edit"><span class="cat-edit-ico" style="color:' + c.color + '">' + SK.icon(c.icon) + '</span>'
      + '<span class="nm">' + SK.ui.esc(c.name) + '</span>'
      + '<button class="link-btn" data-act="delcat" data-cat="' + c.id + '">entfernen</button></div>';
  }).join('') || '<span class="muted">Keine Kategorien.</span>';
};

/* ---- Kategorie-Chips im Erfassen-Sheet ---- */
SK.ui.renderErfassenChips = function (aktiveId) {
  document.getElementById('er-kategorien').innerHTML = SK.state.categories.map(function (c) {
    return '<button class="chip' + (c.id === aktiveId ? ' is-active' : '') + '" data-cat="' + c.id + '">' + SK.icon(c.icon) + ' ' + SK.ui.esc(c.name) + '</button>';
  }).join('');
};

/* ============ C) ALLES ZUSAMMEN ============ */
/* Wird nach jeder Aenderung aufgerufen und zeichnet alle Bildschirme neu.
   Bei dieser kleinen Datenmenge ist das problemlos schnell. */
SK.ui.render = function () {
  SK.ui.renderTop();
  SK.ui.renderHeute();
  SK.ui.renderVerlauf();
  SK.ui.renderZiele();
  SK.ui.renderAbos();
  SK.ui.renderSchulden();
  SK.ui.renderStatistik();
  SK.ui.renderListen();
  SK.ui.renderMarkets();      // zeigt zwischengespeicherte Kurse (Abruf passt beim Tab-Wechsel)
  SK.ui.renderCoach();
  SK.ui.renderIdeen();
  SK.ui.renderEinstellungen();
};

/* ============ D) NEUE BILDSCHIRME (v2) ============ */

/* ---- MÄRKTE (Krypto) ----
   Zeigt die zuletzt gespeicherten Kurse. Der eigentliche Live-Abruf passiert
   in app.js beim Wechsel in den Tab (SK.markets.load). */
SK.ui.renderMarkets = function () {
  const c = SK.markets.cached();
  const cur = (SK.state.settings.cryptoWaehrung || 'chf').toUpperCase();
  const stand = document.getElementById('mk-stand');
  const liste = document.getElementById('mk-liste');
  if (!c) {
    stand.textContent = 'Live-Kurse von CoinGecko · keine Anlageberatung';
    liste.innerHTML = '<div class="empty-hint">Noch keine Kurse geladen. Tippe oben auf das Aktualisieren-Symbol (Internet nötig).</div>';
    return;
  }
  stand.textContent = 'Stand: ' + SK.ui.timeAgo(c.ts) + ' · Quelle CoinGecko · keine Anlageberatung';
  liste.innerHTML = c.data.map(function (coin) {
    const chg24 = coin.price_change_percentage_24h_in_currency;
    const chg7 = coin.price_change_percentage_7d_in_currency;
    const chg30 = coin.price_change_percentage_30d_in_currency;
    const spark = (coin.sparkline_in_7d && coin.sparkline_in_7d.price)
      ? SK.charts.spark(coin.sparkline_in_7d.price, { w: 120, h: 36 }) : '';
    const ath = coin.ath ? ('ATH ' + SK.ui.fmt(coin.ath, 0) + ' ' + cur + ' (' + (coin.ath_change_percentage != null ? coin.ath_change_percentage.toFixed(0) + '%' : '–') + ')') : '';
    return '<div class="card coin-card">'
      + '<div class="coin-top">'
        + '<div class="coin-id"><div class="entry-ico" style="color:var(--gold)">' + SK.icon('coin') + '</div>'
          + '<div><div class="coin-name">' + SK.ui.esc(coin.name) + '</div><div class="cap">' + SK.ui.esc((coin.symbol || '').toUpperCase()) + '</div></div></div>'
        + '<div class="coin-price"><div class="num">' + SK.ui.fmt(coin.current_price, coin.current_price < 5 ? 2 : 0) + ' ' + cur + '</div>'
          + SK.ui.changeBadge(chg24) + '</div>'
      + '</div>'
      + '<div class="coin-spark">' + spark + '</div>'
      + '<div class="coin-meta">'
        + '<span>7T ' + SK.ui.changeBadge(chg7) + '</span>'
        + '<span>30T ' + SK.ui.changeBadge(chg30) + '</span>'
        + (ath ? '<span class="cap">' + ath + '</span>' : '')
      + '</div></div>';
  }).join('');
};

/* ---- KI-COACH ---- */
SK.ui.renderCoach = function () {
  SK.ui.renderInsights(document.getElementById('co-insights'));
  const body = document.getElementById('co-ai-body');
  if (!SK.ai.available()) {
    delete body.dataset.loaded;
    body.innerHTML = '<p class="muted">Der echte KI-Coach ist aus. Schalte ihn in den Einstellungen ein (eigener Anthropic-API-Schlüssel nötig). Die Smart-Analyse oben funktioniert auch ohne.</p>'
      + '<button class="btn btn-ghost btn-block" data-view="einstellungen"><span class="ic-pre" data-icon="key"></span>KI-Coach einrichten</button>';
    SK.app.injectStaticIcons(body);
    return;
  }
  // aktiv: Knopf zum Analyse holen (Ergebnis wird von app.js eingesetzt)
  if (!body.dataset.loaded) {
    body.innerHTML = '<button class="btn btn-accent btn-block" data-act="analyze"><span class="ic-pre" data-icon="ai"></span>Persönliche Analyse holen</button>'
      + '<div class="ai-out" id="co-out"></div>';
    body.dataset.loaded = '1';
    SK.app.injectStaticIcons(body);
  }
};

/* ---- GELD-IDEEN ---- */
SK.ui.renderIdeen = function () {
  // statische, recherchierte Liste
  document.getElementById('id-static').innerHTML = SK.MONEY_IDEAS.map(function (cat) {
    return '<div class="idea-cat"><div class="label">' + SK.ui.esc(cat.gruppe) + '</div>'
      + cat.items.map(function (it) {
        return '<div class="idea"><div class="idea-title">' + SK.ui.esc(it.t) + '</div><div class="idea-desc">' + SK.ui.esc(it.d) + '</div></div>';
      }).join('') + '</div>';
  }).join('');

  // KI-Idee des Tages
  const body = document.getElementById('id-ai-body');
  if (!SK.ai.available()) {
    body.innerHTML = '<p class="muted">Für eine täglich frische Idee von Claude den KI-Coach in den Einstellungen einschalten. Die bewährten Wege unten gibt es auch ohne.</p>';
    return;
  }
  const mr = SK.state.moneyResearch;
  if (mr && mr.text) {
    body.innerHTML = '<div class="ai-out">' + SK.ui.aiText(mr.text) + '</div><div class="cap">Stand: ' + SK.ui.esc(mr.datum) + '</div>';
  } else {
    body.innerHTML = '<p class="muted">Tippe oben auf das Aktualisieren-Symbol für die heutige Idee.</p>';
  }
};

/* ---- LISTEN / WUNSCHLISTE ---- */
SK.ui.renderListen = function () {
  const el = document.getElementById('ls-liste');
  if (!SK.state.lists || !SK.state.lists.length) {
    el.innerHTML = '<div class="empty-hint">Keine Listen. Tippe auf ＋ Liste.</div>';
    return;
  }
  el.innerHTML = SK.state.lists.map(function (l) {
    const items = l.items || [];
    const summe = items.reduce(function (s, it) { return s + (it.betrag || 0); }, 0);
    const offen = items.filter(function (it) { return !it.erledigt; }).reduce(function (s, it) { return s + (it.betrag || 0); }, 0);
    const rows = items.length ? items.map(function (it) {
      return '<div class="list-item' + (it.erledigt ? ' done' : '') + '">'
        + '<button class="li-check" data-act="listtoggle" data-list="' + l.id + '" data-item="' + it.id + '">' + (it.erledigt ? SK.icon('tick') : '') + '</button>'
        + '<span class="li-text">' + SK.ui.esc(it.text) + '</span>'
        + (it.betrag ? '<span class="li-amt">' + SK.ui.fmt(it.betrag, 2) + ' CHF</span>' : '')
        + '<button class="li-del" data-act="listdelitem" data-list="' + l.id + '" data-item="' + it.id + '">' + SK.icon('trash') + '</button>'
      + '</div>';
    }).join('') : '<div class="empty-hint">Noch leer.</div>';
    return '<div class="card list-card" data-list="' + l.id + '">'
      + '<div class="row-between section-head"><h2>' + SK.icon('star', 'ic-pre') + SK.ui.esc(l.name) + '</h2>'
        + '<button class="link-btn" data-act="dellist" data-list="' + l.id + '">löschen</button></div>'
      + '<div class="list-items">' + rows + '</div>'
      + '<div class="add-inline">'
        + '<input type="text" class="li-new-text" data-list="' + l.id + '" placeholder="Neuer Eintrag …" maxlength="50">'
        + '<input type="number" class="li-new-amt" data-list="' + l.id + '" placeholder="CHF" inputmode="decimal" style="max-width:90px">'
        + '<button class="btn btn-accent btn-sm" data-act="listadd" data-list="' + l.id + '">＋</button>'
      + '</div>'
      + (summe > 0 ? '<div class="list-sum">Summe ' + SK.ui.fmt(summe) + ' CHF' + (offen !== summe ? ' · offen ' + SK.ui.fmt(offen) + ' CHF' : '') + '</div>' : '')
    + '</div>';
  }).join('');
};

/* Wandelt KI-Text sicher in HTML um (escapen, Zeilenumbrüche, einfache Aufzählungen). */
SK.ui.aiText = function (txt) {
  const safe = SK.ui.esc(txt);
  return safe.split(/\n{2,}/).map(function (para) {
    const lines = para.split('\n');
    const isList = lines.every(function (l) { return /^\s*[-*•]/.test(l) || l.trim() === ''; });
    if (isList) {
      return '<ul>' + lines.filter(function (l) { return l.trim(); })
        .map(function (l) { return '<li>' + l.replace(/^\s*[-*•]\s?/, '') + '</li>'; }).join('') + '</ul>';
    }
    return '<p>' + para.replace(/\n/g, '<br>') + '</p>';
  }).join('');
};
