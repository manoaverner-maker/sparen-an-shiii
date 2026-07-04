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
SK.ui._backupDismissed = false; // Backup-Erinnerung fuer diese Sitzung weggeklickt?
SK.ui.ferienArchOpen = false;   // Archiv "Frühere Reisen" aufgeklappt?
SK.ui.ferienArchExpanded = {};  // welche Archiv-Reise zeigt ihre Detail-Aufschluesselung?
SK.ui.calOffset = 0;            // angezeigter Kalender-Monat: 0 = aktuell, -1 = letzter …

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

/* Recherchierte Spar-Tipps fuer den Alltag (Schweiz, 2026) – werden im
   Geld-Ideen-Tab als eigener Abschnitt "Im Alltag sparen" angezeigt. */
SK.SAVING_IDEAS = [
  { gruppe: 'Im Alltag sparen', items: [
    { t: 'Günstiger einkaufen', d: 'Aldi/Lidl/Denner & Eigenmarken statt Markenprodukte; „Too Good To Go" für vergünstigte Resten. Schnell 100–200 CHF/Monat ohne echten Verzicht.' },
    { t: 'Selber kochen & Lunch mitnehmen', d: 'Auswärts essen ist der grösste Geld-Frisser. Sonntag vorkochen (Meal-Prep) spart 5–10 CHF/Tag – im Monat 150–250.' },
    { t: 'Kaffee & Süssgetränke', d: 'Kaffee selber machen statt 4.50 unterwegs (≈100/Monat). Wasser/Sirup statt Energy & Softdrinks.' },
    { t: 'ÖV clever', d: 'Halbtax + „Gleis 7" (gratis ÖV ab 19 Uhr für unter 25) statt Einzeltickets; kurze Strecken mit dem Velo.' },
    { t: 'Handy & Internet senken', d: 'Günstig-Anbieter (Yallo, Wingo, Digital Republic, Coop Mobile) statt Premium – oft 20–40 CHF/Monat weniger fürs Gleiche.' },
    { t: 'Second-Hand & reparieren', d: 'Tutti, Ricardo, Brockenhaus, Marketplace für Kleider/Möbel/Technik. Reparieren statt neu kaufen.' }
  ]},
  { gruppe: 'Bessere Gewohnheiten', items: [
    { t: '24-Stunden-Regel', d: 'Alles über ~50 CHF: einen Tag drüber schlafen. Die meisten Impulskäufe erledigen sich von selbst – nutze die Wunschliste.' },
    { t: 'Wochen-Bargeld', d: 'Feste Wochensumme abheben und nur die ausgeben – macht das Tagesbudget greifbar und bremst Karten-Impulse.' },
    { t: 'Cumulus / Supercard & Cashback', d: 'Punkte & Rabatte mitnehmen – aber nur für Sachen, die du sowieso kaufst (kein Kauf wegen Rabatt).' },
    { t: 'Abos halbjährlich prüfen', d: 'Im Abo-Radar alles durchgehen: Streaming, Gym, Apps. Was du seltener als 1×/Woche nutzt → kündigen.' }
  ]},
  { gruppe: 'Grosse Hebel', items: [
    { t: 'Zahl dich zuerst', d: 'Sparrate sofort am Lohntag wegbuchen (machst du mit den 250ern). Was weg ist, gibst du nicht aus.' },
    { t: 'Notgroschen zuerst', d: '3–6 Monatsausgaben auf ein separates Konto, bevor du grösser investierst. Schützt vor Schulden bei Pannen.' },
    { t: 'Fixkosten senken', d: 'Grösster Hebel: Krankenkasse jährlich via Prämienrechner vergleichen (priminfo.admin.ch), Franchise & Modell prüfen – oft 50–150 CHF/Monat.' },
    { t: 'Schulden/Bussen vor Sparen', d: 'Offene Schulden & Bussen zuerst abbauen – kostet sonst mehr, als Sparen oder Investieren bringt.' }
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

/* Zeile "Nächster Lohn: …" fuers Dashboard (Datum + in X Tagen). */
SK.ui.paydayLine = function (c) {
  const d = new Date(c.lohnDatum + 'T00:00:00');
  const dat = WOCHENTAGE[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()];
  let wann;
  if (c.tageBisLohn <= 0) wann = '<b>heute</b>';
  else if (c.tageBisLohn === 1) wann = '<b>morgen</b>';
  else wann = 'in <b>' + c.tageBisLohn + '</b> Tagen';
  return SK.icon('coins', 'ic-pre') + 'Nächster Lohn: ' + dat + ' · ' + wann;
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
  document.getElementById('hd-payday').innerHTML = SK.ui.paydayLine(c);
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

  // Backup-Erinnerung
  SK.ui.renderBackupHint();

  // Monatszahlen
  document.getElementById('hd-monat').textContent = SK.ui.fmt(c.spendMonat);
  document.getElementById('hd-rest').textContent = SK.ui.fmt(c.nochVerfuegbarMonat);

  // Hauptsparziel
  SK.ui.renderGoalMini();

  // Smart-Analyse (oben, max 3 Hinweise)
  SK.ui.renderInsights(document.getElementById('hd-insights'), 3);

  // Hero-Sparkline: Ausgaben der letzten 7 Tage – nur zeigen, wenn es
  // ueberhaupt Ausgaben gab (sonst wirkt die flache Linie wie ein Strich).
  const spark7 = SK.ui.last7DaysSpend();
  document.getElementById('hd-spark').innerHTML = spark7.some(function (v) { return v > 0; })
    ? SK.charts.spark(spark7, { w: 120, h: 30 }) : '';

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

/* Backup-Erinnerung auf "Heute": sanfter Hinweis, sobald es nennenswerte
   Daten gibt und lange (oder noch nie) kein Backup gemacht wurde.
   Verhindert kuenftigen Datenverlust, weil die Daten nur lokal liegen. */
SK.ui.renderBackupHint = function () {
  const card = document.getElementById('backup-card');
  if (!card) return;
  if (SK.ui._backupDismissed) { card.classList.add('hidden'); return; }
  const n = SK.state.entries.length;
  const last = SK.state.meta && SK.state.meta.lastBackupAt;
  let daysSince = Infinity;
  if (last) daysSince = Math.round((new Date(SK.dateKey() + 'T00:00:00') - new Date(last + 'T00:00:00')) / 86400000);
  const show = n >= 4 && daysSince >= 30; // erst ab etwas Daten, dann monatlich
  card.classList.toggle('hidden', !show);
  if (show) {
    document.getElementById('hd-backuptext').textContent = last
      ? ('Letztes Backup vor ' + daysSince + ' Tagen. Deine Daten liegen nur auf diesem Gerät – sichere sie wieder.')
      : 'Noch kein Backup gemacht. Deine Daten liegen nur auf diesem Gerät – sichere sie jetzt, damit nichts verloren geht.';
  }
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
  const istSparen = e.typ === 'sparen';
  const istEinnahme = e.typ === 'einnahme';
  const cat = istEinnahme ? { name: 'Einnahme', color: '#059669', icon: 'coins' } : SK.ui.cat(istSparen ? 'sparen' : e.kategorie);
  const notiz = e.notiz ? e.notiz : (istSparen ? 'ins Sparziel' : (istEinnahme ? 'Geld hinzugefügt' : cat.name));
  const plus = istSparen || istEinnahme;
  const amtCls = istEinnahme ? ' income' : (istSparen ? ' saving' : '');
  return '<div class="entry" data-id="' + e.id + '">'
    + '<div class="entry-ico" style="background:' + cat.color + '22;color:' + cat.color + '">' + SK.icon(cat.icon) + '</div>'
    + '<div class="entry-main"><div class="entry-cat">' + cat.name + '</div><div class="entry-note">' + SK.ui.esc(notiz) + '</div></div>'
    + '<div class="entry-amt' + amtCls + '">' + (plus ? '+' : '−') + SK.ui.fmt(e.betrag, 2) + '</div>'
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

/* ---- KALENDER (Ausgaben-Heatmap) ----
   Faerbt jeden Tag je nach Ausgaben im Verhaeltnis zum Tages-Soll:
     dunkelgrün = sehr sparsam, hellgrün = im Plan, hellrot = drüber,
     dunkelrot = weit drüber. Zukuenftige Tage bleiben neutral. */
SK.ui.calStatus = function (spend, allow, isFuture) {
  if (isFuture) return 'neutral';
  const r = allow > 0 ? spend / allow : (spend > 0 ? 2 : 0);
  if (r <= 0.5) return 'g2';
  if (r <= 1.0) return 'g1';
  if (r <= 1.5) return 'r1';
  return 'r2';
};

SK.ui.renderCalendar = function () {
  const wrap = document.getElementById('st-calendar');
  if (!wrap) return;
  const base = new Date();
  const d = new Date(base.getFullYear(), base.getMonth() + SK.ui.calOffset, 1);
  const n = SK.budget.daysInMonth(d);
  const spends = SK.budget.daySpends(SK.state, d);
  const allow = SK.budget.dayInfo(SK.state, d).verfuegbar / n; // gleichmaessiges Tages-Soll
  const istAktuell = (d.getFullYear() === base.getFullYear() && d.getMonth() === base.getMonth());
  const heuteTag = base.getDate();

  let firstDow = new Date(d.getFullYear(), d.getMonth(), 1).getDay(); // So=0
  firstDow = (firstDow + 6) % 7; // Woche beginnt Montag

  let html = '<div class="cal-head">'
    + '<button class="cal-nav" data-act="cal-prev" aria-label="Vorheriger Monat">‹</button>'
    + '<div class="cal-title">' + MONATE[d.getMonth()] + ' ' + d.getFullYear() + '</div>'
    + '<button class="cal-nav" data-act="cal-next"' + (SK.ui.calOffset >= 0 ? ' disabled' : '') + ' aria-label="Nächster Monat">›</button>'
  + '</div>';
  html += '<div class="cal-grid cal-dow">' + ['Mo','Di','Mi','Do','Fr','Sa','So'].map(function (w) { return '<div class="cal-dow-c">' + w + '</div>'; }).join('') + '</div>';
  html += '<div class="cal-grid">';
  for (let i = 0; i < firstDow; i++) html += '<div class="cal-cell empty"></div>';
  for (let t = 1; t <= n; t++) {
    const isFuture = istAktuell && t > heuteTag;
    const cls = SK.ui.calStatus(spends[t], allow, isFuture);
    const isToday = istAktuell && t === heuteTag;
    html += '<button class="cal-cell ' + cls + (isToday ? ' today' : '') + '" data-act="cal-day" data-day="' + t + '">' + t + '</button>';
  }
  html += '</div>';
  html += '<div class="cal-legend">'
    + '<span><i class="cal-sw g2"></i>sehr sparsam</span><span><i class="cal-sw g1"></i>im Plan</span>'
    + '<span><i class="cal-sw r1"></i>drüber</span><span><i class="cal-sw r2"></i>weit drüber</span></div>';
  wrap.innerHTML = html;
};

/* Tipp auf einen Kalendertag -> kurze Info, wie viel an dem Tag ausgegeben wurde. */
SK.ui.showCalDay = function (t) {
  const base = new Date();
  const d = new Date(base.getFullYear(), base.getMonth() + SK.ui.calOffset, 1);
  const spends = SK.budget.daySpends(SK.state, d);
  const s = spends[t] || 0;
  SK.ui.toast(t + '. ' + MONATE[d.getMonth()] + ': ' + SK.ui.fmt(s, 2) + ' CHF ausgegeben');
};

/* ---- STATISTIK ---- */
SK.ui.renderStatistik = function () {
  const heute = new Date();
  SK.ui.renderCalendar();
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
  hoch.style.borderColor = c.hochrechnungStatus === 'gut' ? 'rgba(5,150,105,0.35)' : 'rgba(220,38,38,0.30)';
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
  document.getElementById('se-alltag').value = SK.state.settings.alltagsbudget || '';
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

  document.getElementById('se-version').textContent = '3.0';

  // Letztes Backup anzeigen (Erinnerung gegen Datenverlust)
  const bi = document.getElementById('se-backupinfo');
  if (bi) {
    const last = SK.state.meta && SK.state.meta.lastBackupAt;
    bi.textContent = last ? ('Letztes Backup: ' + SK.ui.dayLabel(last)) : 'Noch nie ein Backup gemacht.';
  }

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
  SK.ui.renderFerien();
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

/* Baut eine Liste von Ideen-Gruppen ([{gruppe, items:[{t,d}]}]) als HTML. */
SK.ui._ideaGroups = function (arr) {
  return arr.map(function (cat) {
    return '<div class="idea-cat"><div class="label">' + SK.ui.esc(cat.gruppe) + '</div>'
      + cat.items.map(function (it) {
        return '<div class="idea"><div class="idea-title">' + SK.ui.esc(it.t) + '</div><div class="idea-desc">' + SK.ui.esc(it.d) + '</div></div>';
      }).join('') + '</div>';
  }).join('');
};

/* ---- GELD-IDEEN ---- */
SK.ui.renderIdeen = function () {
  // statische, recherchierte Listen (verdienen + im Alltag sparen)
  document.getElementById('id-static').innerHTML = SK.ui._ideaGroups(SK.MONEY_IDEAS);
  const sav = document.getElementById('id-saving');
  if (sav) sav.innerHTML = SK.ui._ideaGroups(SK.SAVING_IDEAS);

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

/* ---- FERIENMODUS ----
   Reine Schnell-Links (oeffnen externe App/Website, KEINE eigene Abfrage).
   Die "in der Nähe"-Maps-Links nutzen den aktuellen Standort des Geraets
   (Standard-Maps-Suche), ohne dass die App Standortdaten speichert. */
SK.ui.FERIEN_LINKS = [
  { gruppe: 'In der Nähe (nutzt deinen Standort)', items: [
    { icon: 'pin',      label: 'Restaurants',       url: 'https://www.google.com/maps/search/?api=1&query=Restaurants+in+der+N%C3%A4he' },
    { icon: 'landmark', label: 'Sehenswertes', url: 'https://www.google.com/maps/search/?api=1&query=Sehensw%C3%BCrdigkeiten+in+der+N%C3%A4he' },
    { icon: 'cash',     label: 'Bankomat',          url: 'https://www.google.com/maps/search/?api=1&query=Bankomat+in+der+N%C3%A4he' }
  ]},
  { gruppe: 'Übersetzen', items: [
    { icon: 'translate', label: 'Übersetzen',     url: 'https://translate.google.com/' },
    { icon: 'camera',    label: 'Foto übersetzen', url: 'https://translate.google.com/?op=images' }
  ]},
  { gruppe: 'Unterkunft & Transport', items: [
    { icon: 'bed',  label: 'Booking.com', url: 'https://www.booking.com/' },
    { icon: 'home', label: 'Airbnb',      url: 'https://www.airbnb.com/' },
    { icon: 'car',  label: 'Bolt',        url: 'https://bolt.eu/' },
    { icon: 'sun',  label: 'Wetter',      url: 'https://www.google.com/search?q=Wetter' }
  ]}
];

/* Fremdwaehrungs-Zusatz zu einem CHF-Betrag (oder '' wenn kein Kurs gesetzt).
   Kurs-Konvention: 1 [waehrung] = kurs CHF  ->  Fremdwaehrung = CHF / kurs. */
SK.ui.ferienFxRaw = function (kurs, waehrung, chf) {
  if (!kurs || kurs <= 0) return '';
  const fw = chf / kurs;
  return '≈ ' + SK.ui.fmt(fw, Math.abs(fw) < 50 ? 2 : 0) + ' ' + SK.ui.esc(waehrung || '');
};
SK.ui.ferienFx = function (chf) { const f = SK.state.ferien; return SK.ui.ferienFxRaw(f.kurs, f.waehrung, chf); };
SK.ui.ferienFxOf = function (trip, chf) { return SK.ui.ferienFxRaw(trip.kurs, trip.waehrung, chf); };

/* Lesbarer Datumsbereich einer Reise, z.B. "20. Juni – 29. Juni 2026". */
SK.ui._ferienRange = function (t) {
  if (!t.start || !t.ende) return '';
  const s = new Date(t.start + 'T00:00:00'), e = new Date(t.ende + 'T00:00:00');
  const f = function (d) { return d.getDate() + '. ' + MONATE[d.getMonth()]; };
  return f(s) + ' – ' + f(e) + ' ' + e.getFullYear();
};

/* Einrichtungs-Formular (wenn noch keine Ferien laufen). */
SK.ui._ferienSetup = function () {
  const heute = SK.dateKey();
  const goalOpts = ['<option value="">— kein Sparziel —</option>'].concat(
    SK.state.goals.filter(function (g) { return !g.archiviert; }).map(function (g) {
      const saved = Math.round(SK.budget.goalSaved(SK.state, g));
      return '<option value="' + g.id + '" data-saved="' + saved + '">' + SK.ui.esc(g.name) + ' (' + SK.ui.fmt(saved) + ' CHF)</option>';
    })).join('');
  return '<div class="card fe-setup">'
    + '<p class="muted">Führe im Urlaub ein <strong>getrenntes</strong> Tagesbudget. Es beeinflusst dein normales Monatsbudget nicht – eigene Ausgaben, eigener Topf.</p>'
    + '<label class="field"><span>Reiseziel / Name (optional)</span><input type="text" id="fe-name" maxlength="30" placeholder="z.B. Kroatien 2026"></label>'
    + '<label class="field"><span>Ferienbudget gesamt (CHF)</span><input type="number" id="fe-budget" inputmode="decimal" min="0" step="50" placeholder="z.B. 1000"></label>'
    + '<div class="fe-row2">'
      + '<label class="field"><span>Start</span><input type="date" id="fe-start" value="' + heute + '"></label>'
      + '<label class="field"><span>Ende</span><input type="date" id="fe-ende"></label>'
    + '</div>'
    + '<label class="field"><span>Sparziel als Startguthaben übernehmen (optional)</span><select id="fe-goal">' + goalOpts + '</select>'
      + '<small class="cap">Übernimmt den aktuellen Stand als Ferienbudget (zieht ihn NICHT vom Sparziel ab).</small></label>'
    + '<div class="fe-row2">'
      + '<label class="field"><span>Fremdwährung</span><input type="text" id="fe-cur" value="EUR" maxlength="4" placeholder="EUR"></label>'
      + '<label class="field"><span>Kurs: 1 = … CHF</span><input type="number" id="fe-kurs" inputmode="decimal" min="0" step="0.01" placeholder="z.B. 0.95"></label>'
    + '</div>'
    + '<p class="cap">Den Kurs gibst du selbst ein – kein Live-Abruf. Beträge erscheinen dann in CHF und in der Fremdwährung.</p>'
    + '<button class="btn btn-accent btn-block" data-act="ferien-start"><span class="ic-pre" data-icon="plane"></span>Ferien starten</button>'
  + '</div>';
};

/* Eine Ferien-Ausgabenzeile. */
SK.ui._ferienRow = function (a) {
  const cat = SK.ui.cat(a.kategorie);
  const fx = SK.ui.ferienFx(a.betrag);
  return '<div class="entry" data-id="' + a.id + '">'
    + '<div class="entry-ico" style="background:' + cat.color + '22;color:' + cat.color + '">' + SK.icon(cat.icon) + '</div>'
    + '<div class="entry-main"><div class="entry-cat">' + SK.ui.esc(cat.name) + '</div>'
      + '<div class="entry-note">' + SK.ui.esc(a.notiz || SK.ui.dayLabel(a.datum)) + (fx ? ' · ' + fx : '') + '</div></div>'
    + '<div class="entry-amt">−' + SK.ui.fmt(a.betrag, 2) + '</div>'
    + '<div class="entry-actions"><button data-act="ferien-delexp" data-id="' + a.id + '" title="Löschen">' + SK.icon('trash') + '</button></div>'
  + '</div>';
};

/* Archiv "Frühere Reisen" (einklappbar). Leerer String, wenn es keine gibt. */
SK.ui._ferienArchive = function () {
  const arr = SK.state.ferienArchiv || [];
  if (!arr.length) return '';
  const open = SK.ui.ferienArchOpen;
  const rows = arr.slice().sort(function (a, b) { return (a.beendetAm < b.beendetAm) ? 1 : -1; }).map(function (t) {
    const spent = SK.budget.ferienSpent(t);
    const pct = t.budget > 0 ? Math.max(0, Math.min(100, (spent / t.budget) * 100)) : 0;
    const expanded = !!SK.ui.ferienArchExpanded[t.id];
    const cats = SK.budget.ferienByCategory(SK.state, t);
    const fx = SK.ui.ferienFxOf(t, spent);
    return '<div class="card fe-arch-card" data-trip="' + t.id + '">'
      + '<div class="row-between"><div class="goal-head-name">' + SK.icon('sun', 'ic-pre') + SK.ui.esc(t.name || 'Ferien') + '</div>'
        + '<button class="link-btn" data-act="ferien-arch-del" data-trip="' + t.id + '" title="Löschen">' + SK.icon('trash') + '</button></div>'
      + '<div class="goal-mini-text">' + SK.ui._ferienRange(t) + '</div>'
      + '<div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div>'
      + '<div class="goal-mini-text"><strong>' + SK.ui.fmt(spent) + '</strong> / ' + SK.ui.fmt(t.budget) + ' CHF ausgegeben' + (fx ? ' · ' + fx : '') + '</div>'
      + (cats.length ? '<button class="link-btn" data-act="ferien-arch-toggle" data-trip="' + t.id + '">' + (expanded ? 'Details ausblenden' : 'Details nach Kategorie') + '</button>' : '')
      + (expanded && cats.length ? '<div class="fe-cat-list">' + cats.map(function (c) {
          return '<div class="legend-row"><span><i style="background:' + c.color + '"></i>' + SK.ui.esc(c.name) + '</span><b>' + SK.ui.fmt(c.betrag, 2) + '</b></div>';
        }).join('') + '</div>' : '')
    + '</div>';
  }).join('');
  return '<div class="fe-arch-wrap">'
    + '<button class="archiv-head" data-act="ferien-arch-open"><span class="chev' + (open ? ' open' : '') + '" data-icon="chevron"></span>'
      + '<span>Frühere Reisen (' + arr.length + ')</span></button>'
    + '<div' + (open ? '' : ' class="hidden"') + '>' + rows + '</div>'
  + '</div>';
};

/* Der ganze Ferien-Bildschirm (Einrichtung ODER laufende Ferien). */
SK.ui.renderFerien = function () {
  const body = document.getElementById('fe-body');
  if (!body) return;
  const f = SK.state.ferien;

  if (!f.aktiv) {
    body.innerHTML = SK.ui._ferienSetup() + SK.ui._ferienArchive();
    SK.app.injectStaticIcons(body);
    return;
  }

  const info = SK.budget.ferienInfo(SK.state);

  // ---- Hero (je nach Phase) ----
  let label, amount, sub;
  if (info.phase === 'vor') {
    label = 'Ferien-Tagesbudget';
    amount = info.tagesbudget;
    sub = 'Start ' + SK.ui.dayLabel(f.start) + ' · in <strong>' + info.tageBisStart + '</strong> Tagen · Budget ' + SK.ui.fmt(f.budget) + ' CHF';
  } else if (info.phase === 'ende') {
    label = 'Übrig geblieben';
    amount = info.remaining;
    sub = 'von ' + SK.ui.fmt(f.budget) + ' CHF · ' + info.tageGesamt + ' Ferientage';
  } else {
    label = 'Heute noch verfügbar';
    amount = info.heuteNochVerfuegbar;
    sub = 'Tagesbudget heute: <strong>' + SK.ui.fmt(info.tagesbudget) + '</strong> CHF · noch <span>' + info.daysLeft + '</span> Ferientage';
  }
  const fxAmount = SK.ui.ferienFx(amount);
  let pct = info.tagesbudget > 0 ? (info.heuteNochVerfuegbar / info.tagesbudget) * 100 : 0;
  pct = Math.max(0, Math.min(100, pct));

  let html = '<div class="card card--lit hero fe-hero ampel-' + info.ampel + '">'
    + (f.name ? '<div class="fe-trip-name">' + SK.ui.esc(f.name) + '</div>' : '')
    + '<div class="hero-label label">' + label + '</div>'
    + '<div class="hero-amount amount-hero">' + SK.ui.fmt(Math.round(amount)) + '<span class="cur">CHF</span></div>'
    + (fxAmount ? '<div class="fe-fx">' + fxAmount + '</div>' : '')
    + (info.phase === 'aktiv' ? '<div class="ampel-bar"><div class="ampel-fill" style="width:' + pct + '%"></div></div>' : '')
    + '<div class="hero-sub">' + sub + '</div>'
  + '</div>';

  // ---- Ausgabe erfassen (eigener Knopf -> der runde +Knopf ist hier aus) ----
  html += '<button class="btn btn-accent btn-block" data-act="ferien-add"><span class="ic-pre" data-icon="plus"></span>Ferien-Ausgabe erfassen</button>';

  // ---- Rückblick: X von Y ausgegeben + nach Kategorie ----
  const rpct = f.budget > 0 ? Math.max(0, Math.min(100, (info.spent / f.budget) * 100)) : 0;
  const cats = SK.budget.ferienByCategory(SK.state);
  html += '<div class="card"><div class="section-head"><h2>Rückblick</h2></div>'
    + '<div class="fe-review-head"><strong>' + SK.ui.fmt(info.spent) + '</strong> von ' + SK.ui.fmt(f.budget) + ' CHF ausgegeben'
      + (SK.ui.ferienFx(info.spent) ? ' · ' + SK.ui.ferienFx(info.spent) : '') + '</div>'
    + '<div class="progress"><div class="progress-fill" style="width:' + rpct + '%"></div></div>'
    + (cats.length
        ? '<div class="fe-cat-list">' + cats.map(function (c) {
            return '<div class="legend-row"><span><i style="background:' + c.color + '"></i>' + SK.ui.esc(c.name) + '</span><b>' + SK.ui.fmt(c.betrag, 2) + '</b></div>';
          }).join('') + '</div>'
        : '<p class="cap">Noch keine Ferien-Ausgaben erfasst.</p>')
  + '</div>';

  // ---- Ausgabenliste ----
  const liste = (f.ausgaben || []).slice().sort(function (a, b) {
    if (a.datum !== b.datum) return a.datum < b.datum ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
  html += '<div class="card"><div class="section-head"><h2>Ferien-Ausgaben</h2></div>'
    + '<div class="entry-list">' + (liste.length ? liste.map(SK.ui._ferienRow).join('') : '<div class="empty-hint">Noch nichts erfasst.</div>') + '</div></div>';

  // ---- Schnell-Links ----
  html += '<div class="card fe-links"><div class="section-head"><h2><span class="ic-pre" data-icon="pin"></span>Schnell-Links</h2></div>'
    + '<p class="cap">Öffnen die jeweilige App bzw. Website. Nur diese Links brauchen Internet.</p>'
    + SK.ui.FERIEN_LINKS.map(function (grp) {
        return '<div class="ql-group"><div class="label">' + SK.ui.esc(grp.gruppe) + '</div><div class="fe-quick-grid">'
          + grp.items.map(function (it) {
              return '<a class="ql" href="' + it.url + '" target="_blank" rel="noopener noreferrer">'
                + '<span class="ico" data-icon="' + it.icon + '"></span><span>' + SK.ui.esc(it.label) + '</span></a>';
            }).join('')
          + '</div></div>';
      }).join('')
  + '</div>';

  // ---- Ferien beenden (wandert ins Archiv, wird NICHT geloescht) ----
  html += '<button class="btn btn-ghost btn-block" data-act="ferien-end"><span class="ic-pre" data-icon="check"></span>Ferien beenden &amp; ins Archiv</button>';

  body.innerHTML = html;
  SK.app.injectStaticIcons(body);
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
