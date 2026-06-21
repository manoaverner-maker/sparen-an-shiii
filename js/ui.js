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
SK.ui.verlaufFilter = 'alle'; // aktueller Filter im Verlauf-Tab

/* ============ A) HELFER ============ */

const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WOCHENTAGE = ['So','Mo','Di','Mi','Do','Fr','Sa'];

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
      || { id: id, name: id || 'Sonstiges', color: '#94a3b8', icon: '📦' };
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

  // Letzte Ausgaben (max 4)
  const letzte = SK.state.entries.slice().sort(SK.ui._sortEntries).slice(0, 4);
  document.getElementById('hd-letzte').innerHTML = letzte.length
    ? letzte.map(SK.ui._entryRow).join('')
    : '<div class="empty-hint">Noch keine Ausgaben. Tippe auf ＋ um zu starten.</div>';
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

/* Hauptsparziel-Karte auf dem Dashboard. */
SK.ui.renderGoalMini = function () {
  const ziel = SK.state.goals.find(function (g) { return !g.archiviert; });
  const card = document.getElementById('goal-mini-card');
  if (!ziel) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  const saved = SK.budget.goalSaved(SK.state, ziel);
  const pct = Math.max(0, Math.min(100, (saved / ziel.ziel) * 100));
  document.getElementById('hd-zielname').innerHTML = SK.icon('target', 'ic-pre') + SK.ui.esc(ziel.name);
  document.getElementById('hd-zielpct').textContent = Math.round(pct) + '%';
  document.getElementById('hd-zielbar').style.width = pct + '%';
  document.getElementById('hd-zieltext').textContent = SK.ui.fmt(saved) + ' / ' + SK.ui.fmt(ziel.ziel) + ' CHF';
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
    const pct = Math.max(0, Math.min(100, (saved / g.ziel) * 100));
    const erreicht = saved >= g.ziel;
    const tageBis = Math.max(0, Math.round((new Date(g.zieldatum + 'T00:00:00') - heute) / 86400000));
    const fehlt = SK.budget.goalRemaining(SK.state, g);
    const proMonat = SK.budget.goalMonthlyRate(SK.state, g, heute);
    const proTag = tageBis > 0 ? fehlt / tageBis : fehlt;

    return '<div class="card goal-card' + (erreicht ? ' done' : '') + '" data-goal="' + g.id + '">'
      + '<div class="row-between"><div class="goal-head-name">' + SK.icon('target', 'ic-pre') + SK.ui.esc(g.name) + '</div>'
        + (erreicht ? '<span class="goal-badge">erreicht ✓</span>' : '<span class="goal-mini-pct">' + Math.round(pct) + '%</span>') + '</div>'
      + '<div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div>'
      + '<div class="goal-mini-text">' + SK.ui.fmt(saved) + ' / ' + SK.ui.fmt(g.ziel) + ' CHF</div>'
      + '<div class="goal-meta">'
        + '<span>📅 noch <b>' + tageBis + '</b> Tage</span>'
        + (erreicht ? '' : '<span>pro Monat: <b>' + SK.ui.fmt(proMonat) + '</b> CHF</span><span>pro Tag: <b>' + SK.ui.fmt(proTag, 2) + '</b> CHF</span>')
      + '</div>'
      + '<div class="goal-card-actions">'
        + '<button class="btn btn-accent btn-sm" data-act="deposit" data-goal="' + g.id + '">＋ Einzahlen</button>'
        + '<button class="btn btn-ghost btn-sm" data-act="editgoal" data-goal="' + g.id + '">Bearbeiten</button>'
        + '<button class="btn btn-ghost btn-sm" data-act="delgoal" data-goal="' + g.id + '">Löschen</button>'
      + '</div>'
    + '</div>';
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
};

/* ---- EINSTELLUNGEN ---- */
SK.ui.renderEinstellungen = function () {
  document.getElementById('se-lohn').value = SK.state.settings.lohn;
  document.getElementById('se-fixkosten').value = SK.state.settings.fixkosten;
  document.getElementById('se-aboswitch').checked = SK.state.settings.abosInFixkosten;
  document.getElementById('se-version').textContent = '1.0';

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
  SK.ui.renderStatistik();
  SK.ui.renderEinstellungen();
};
