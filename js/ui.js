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
SK.ui.goalExpanded = {};        // welche Ziel-Karten sind aufgeklappt? (id -> true)
SK.ui._backupDismissed = false; // Backup-Erinnerung fuer diese Sitzung weggeklickt?
SK.ui.ferienArchOpen = false;   // Archiv "Frühere Reisen" aufgeklappt?
SK.ui.ferienArchExpanded = {};  // welche Archiv-Reise zeigt ihre Detail-Aufschluesselung?
SK.ui.calOffset = 0;            // angezeigter Kalender-Monat: 0 = aktuell, -1 = letzter …

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
  const WT = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  document.getElementById('top-date').textContent = WT[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()];
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
SK.ui.RING_UMFANG = 609.5; // Umfang des Hero-Rings (2*PI*97)

SK.ui.renderHeute = function () {
  const c = SK.budget.compute(SK.state);

  // Hero: grosse Zahl im Ring + Ampelfarbe
  const hero = document.getElementById('hero-card');
  hero.classList.remove('ampel-gruen', 'ampel-gelb', 'ampel-rot');
  hero.classList.add('ampel-' + c.ampel);
  SK.ui.countUp(document.getElementById('hd-heute'), Math.round(c.heuteNochVerfuegbar), 0);
  document.getElementById('hd-tagesbudget').textContent = SK.ui.fmt(c.tagesbudget);
  document.getElementById('hd-payday').innerHTML = SK.ui.paydayLine(c);
  let pct = c.tagesbudget > 0 ? (c.heuteNochVerfuegbar / c.tagesbudget) : 0;
  pct = Math.max(0, Math.min(1, pct));
  document.getElementById('hd-ring').style.strokeDashoffset = (SK.ui.RING_UMFANG * (1 - pct)).toFixed(1);

  // Status in einer Zeile (Tempo)
  const pace = document.getElementById('pace-card');
  pace.classList.remove('gut', 'knapp', 'warnung');
  pace.classList.add(c.paceStatus);
  const paceTxt = document.getElementById('hd-pace');
  if (c.paceStatus === 'gut') {
    paceTxt.innerHTML = 'Gut unterwegs — <b>' + SK.ui.fmt(Math.abs(c.paceDiff)) + ' CHF</b> unter dem Soll';
  } else if (c.paceStatus === 'knapp') {
    paceTxt.innerHTML = 'Leicht über dem Schnitt — <b>' + SK.ui.fmt(c.paceDiff) + ' CHF</b> voraus';
  } else {
    paceTxt.innerHTML = '<b>' + SK.ui.fmt(c.paceDiff) + ' CHF</b> über dem Soll — heute besser bremsen';
  }

  // Abo-Erinnerung (Verlaengerung in <= 3 Tagen)
  const bald = SK.state.abos
    .filter(function (a) { const d = SK.ui.aboDaysUntil(a); return d != null && d <= 3; })
    .map(function (a) { const d = SK.ui.aboDaysUntil(a); return a.name + ' (' + (d === 0 ? 'heute' : 'in ' + d + ' T') + ', ' + SK.ui.fmt(a.betrag, 2) + ' CHF)'; });
  const aboCard = document.getElementById('aboalert-card');
  if (bald.length) {
    aboCard.classList.remove('hidden');
    document.getElementById('hd-aboalert').textContent = 'Abo-Verlängerung: ' + bald.join(' · ');
  } else {
    aboCard.classList.add('hidden');
  }

  // Backup-Erinnerung
  SK.ui.renderBackupHint();

  // Hauptsparziel
  SK.ui.renderGoalMini();

  // Letzte Ausgaben (max 4)
  const letzte = SK.state.entries.slice().sort(SK.ui._sortEntries).slice(0, 4);
  document.getElementById('hd-letzte').innerHTML = letzte.length
    ? letzte.map(SK.ui._entryRow).join('')
    : '<div class="empty-hint">Noch keine Ausgaben. Tippe auf ➕ um zu starten.</div>';
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

/* ---- ZIELE ----
   Zugeklappt zeigt jede Karte nur Name, Balken und Prozent. Erst ein Tipp
   auf den Kopf klappt Details und Aktions-Knoepfe auf (goalExpanded). */
SK.ui.renderZiele = function () {
  const heute = new Date();
  const ziel = document.getElementById('zl-liste');
  if (!SK.state.goals.length) { ziel.innerHTML = '<div class="empty-hint">Noch kein Sparziel. Tippe auf ＋ Neu.</div>'; return; }

  ziel.innerHTML = SK.state.goals.map(function (g) {
    const open = !!SK.ui.goalExpanded[g.id];
    const saved = SK.budget.goalSaved(SK.state, g);
    const kv = function (k, v) { return '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>'; };
    let pct, sub, right, rows = '';

    if (g.modus === 'monatlich') {
      const mSaved = SK.ui.goalSavedThisMonth(g);
      pct = g.monatlich > 0 ? Math.max(0, Math.min(100, (mSaved / g.monatlich) * 100)) : 0;
      sub = 'fester Monats-Topf';
      right = '<span class="g-pct">' + Math.round(pct) + '%</span>';
      rows = kv('Diesen Monat', SK.ui.fmt(mSaved) + ' / ' + SK.ui.fmt(g.monatlich) + ' CHF')
           + kv('Gesamt angespart <button class="info-btn" data-info="topf" aria-label="Was heisst das?">i</button>', SK.ui.fmt(saved) + ' CHF');
    } else {
      pct = g.ziel > 0 ? Math.max(0, Math.min(100, (saved / g.ziel) * 100)) : 0;
      const erreicht = saved >= g.ziel && g.ziel > 0;
      const tageBis = Math.max(0, Math.round((new Date(g.zieldatum + 'T00:00:00') - heute) / 86400000));
      const d = new Date(g.zieldatum + 'T00:00:00');
      sub = 'bis ' + d.getDate() + '. ' + MONATE[d.getMonth()];
      right = erreicht ? '<span class="goal-badge">erreicht</span>' : '<span class="g-pct">' + Math.round(pct) + '%</span>';
      rows = kv('Gespart', SK.ui.fmt(saved) + ' / ' + SK.ui.fmt(g.ziel) + ' CHF')
           + kv('Verbleibend', tageBis + ' Tage');
      if (!erreicht) {
        const fehlt = SK.budget.goalRemaining(SK.state, g);
        const proTag = tageBis > 0 ? fehlt / tageBis : fehlt;
        rows += kv('Nötig pro Monat', SK.ui.fmt(SK.budget.goalMonthlyRate(SK.state, g, heute)) + ' CHF')
              + kv('Nötig pro Tag', SK.ui.fmt(proTag, 2) + ' CHF');
      }
    }

    const actions = '<div class="goal-card-actions">'
      + '<button class="btn btn-accent btn-sm" data-act="deposit" data-goal="' + g.id + '">＋ Einzahlen</button>'
      + '<button class="btn btn-ghost btn-sm" data-act="editgoal" data-goal="' + g.id + '">Bearbeiten</button>'
      + '<button class="btn btn-ghost btn-sm" data-act="delgoal" data-goal="' + g.id + '">Löschen</button>'
      + '</div>';

    return '<div class="card goal-card' + (open ? ' open' : '') + '" data-goal="' + g.id + '">'
      + '<div class="goal-head" data-act="togglegoal" data-goal="' + g.id + '">'
        + '<span class="g-ico">' + SK.icon('target') + '</span>'
        + '<div class="g-t"><b>' + SK.ui.esc(g.name) + '</b><small>' + sub + '</small></div>'
        + right
        + '<span class="chev">' + SK.icon('chevron') + '</span>'
      + '</div>'
      + '<div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div>'
      + (open ? '<div class="goal-detail">' + rows + actions + '</div>' : '')
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

  // Synchronisation (eigene Datei js/sync.js)
  SK.sync.renderSettings();

  document.getElementById('se-version').textContent = '4.0';

  // Letztes Backup anzeigen (Erinnerung gegen Datenverlust)
  const bi = document.getElementById('se-backupinfo');
  if (bi) {
    const last = SK.state.meta && SK.state.meta.lastBackupAt;
    bi.textContent = last ? SK.ui.dayLabel(last) : 'noch nie';
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
  SK.ui.renderEinstellungen();
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

/* ============ INFO-SHEET (Erklaerungen auf Abruf) ============
   Jeder kleine (i)-Knopf in der App traegt ein data-info="schluessel".
   Ein Tipp darauf oeffnet unten ein kleines Blatt mit der Erklaerung –
   so bleibt die Oberflaeche frei von Erklaer-Texten. */

SK.ui.INFO = {
  tagesbudget: ['Tagesbudget', 'Dein verfügbares Monatsgeld (Lohn − Fixkosten − Sparen − optionale Schulden-Rate), verteilt auf die restlichen Tage bis zum nächsten Lohn. Gibst du heute weniger aus, steigt dein Budget für morgen – gibst du mehr aus, sinkt es.'],
  tagesrest: ['Tagesrest sichern', 'Verschiebt das Geld, das dir heute noch übrig bleibt, in dein Hauptsparziel. So wird aus einem sparsamen Tag direkt sichtbarer Fortschritt.'],
  anpassen: ['Betrag anpassen', 'Für den Fall, dass die App und dein Konto auseinanderliegen (z.B. eine vergessene Ausgabe): Trage ein, wie viel du wirklich noch zum Ausgeben hast. Die Differenz wird als Korrektur im Verlauf eingetragen und auf die restlichen Tage bis zum nächsten Lohn verteilt – dein Tagesbudget stimmt danach sofort wieder.'],
  backup: ['Backup', 'Deine Daten liegen nur auf diesem Gerät. Das Handy kann den Speicher einer Web-App bei Platzmangel von selbst leeren – lade darum ab und zu ein Backup herunter und lege es sicher ab.'],
  kalender: ['Kalender-Farben', 'Jeder Tag wird nach deinen Ausgaben eingefärbt: dunkelgrün = sehr sparsam, hellgrün = im Plan, hellrot = über dem Tages-Soll, dunkelrot = weit darüber.'],
  monatsverlauf: ['Monatsverlauf', 'Die orange gestrichelte Linie zeigt das gleichmässige Soll über den Monat. Die grüne Linie zeigt, was du tatsächlich ausgegeben hast. Bleibt Grün unter Orange, bist du im Plan.'],
  streak: ['Streak', 'So viele Tage in Folge bist du unter deinem Tagesbudget geblieben. Nicht abreissen lassen!'],
  hochrechnung: ['Hochrechnung', 'Wenn du im aktuellen Tempo weiter ausgibst: so viel wärst du am Ende des Monats los. Grün umrandet = im Plan, rot = über dem Budget.'],
  ziele: ['Sparziele', 'Zwei Arten: ein Ziel mit Datum (z.B. Ferien – die App rechnet aus, wie viel du pro Monat zurücklegen musst) und ein fester Monats-Topf (z.B. 250 CHF fürs Motorrad, ohne Enddatum). Beide werden vorab von deinem verfügbaren Geld reserviert.'],
  topf: ['Gesamt angespart', 'Alles, was du seit dem Anlegen dieses Topfs eingezahlt hast – über alle Monate hinweg.'],
  abos: ['Abo-Radar', 'Alle wiederkehrenden Kosten auf einen Blick. Mit Verlängerungstag erinnert dich die App 3 Tage vorher – der beste Moment zum Kündigen. Der Schalter rechts markiert ein Abo als gekündigt.'],
  schulden: ['Schulden & Bussen', 'Ein getrennter Topf für einmalige grössere Posten (Werkstatt, Busse). Teilzahlungen erfassen, Fortschritt sehen – dein Tagesbudget wird davon NICHT verfälscht. Nur die optionale monatliche Rate (Einstellungen) wird vorab reserviert.'],
  ferien: ['Ferienmodus', 'Ein komplett getrennter Reise-Topf mit eigenem Tagesbudget – gleiche Logik wie sonst, beeinflusst dein normales Monatsbudget aber nicht. Mit optionaler Fremdwährung und Rückblick nach Kategorien.'],
  listen: ['Listen', 'Freie Listen, z.B. eine Wunschliste mit Preisen. Rein informativ – fliesst nicht ins Budget. Die Summe zeigt dir, was du noch ansparen musst.'],
  fixkosten: ['Fixkosten', 'Miete, Krankenkasse, Handy – alles, was jeden Monat fix abgeht, bevor du frei ausgeben kannst. Wird vom Lohn abgezogen, bevor die App dein Tagesbudget berechnet.'],
  monatsbudget: ['Festes Monatsbudget', 'Lege selbst fest, wie viel du pro Monat für den Alltag ausgeben willst. Leer lassen = die App rechnet automatisch: Lohn − Fixkosten − Sparen.'],
  abosfix: ['Abos zu Fixkosten zählen', 'Nur einschalten, wenn deine eingetragenen Fixkosten die Abos noch NICHT enthalten – sonst werden sie doppelt gezählt.'],
  schuldenrate: ['Schulden-Rate', 'Zieht jeden Monat einen festen Betrag für den Schuldenabbau vom verfügbaren Geld ab – genau wie die Sparrate. Einzelne Zahlungen verfälschen dein Tagesbudget so nicht.'],
  sync: ['Synchronisation', 'Gleicht deine Daten automatisch zwischen Laptop und Handy ab – über ein privates GitHub-Repository, das nur du sehen kannst. Nutze die Geräte nacheinander (nicht gleichzeitig): es gewinnt immer der neueste Stand.'],
  synctoken: ['GitHub-Token', 'Ein Zugangsschlüssel, den du auf github.com erstellst (Settings → Developer settings → Fine-grained tokens). Er braucht nur Lese/Schreib-Zugriff auf dein Daten-Repository und bleibt auf diesem Gerät gespeichert. Achtung: auch ein Backup-Export enthält ihn.']
};

SK.ui.openInfo = function (key) {
  const info = SK.ui.INFO[key];
  if (!info) return;
  document.getElementById('info-title-text').textContent = info[0];
  document.getElementById('info-text').textContent = info[1];
  document.getElementById('info-backdrop').classList.add('show');
  document.getElementById('info-sheet').classList.add('show');
};

SK.ui.closeInfo = function () {
  document.getElementById('info-backdrop').classList.remove('show');
  document.getElementById('info-sheet').classList.remove('show');
};
