/* =====================================================================
   app.js  ·  Steuerung / Ablauf (der "Dirigent")
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Sie startet die App und verbindet alles miteinander:
     - laedt die Daten (storage) und zeigt sie an (ui)
     - reagiert auf Tippen/Klicken (Navigation, Knoepfe, Eingaben)
     - aendert die Daten und ruft danach SK.app.refresh() auf
     - kuemmert sich um Monatswechsel und das Streak-Logbuch
     - registriert den Service Worker (Offline-Faehigkeit)

   GOLDENE REGEL: Nach JEDER Datenaenderung   SK.app.refresh()  aufrufen.
   Das speichert, aktualisiert das Tages-Logbuch und zeichnet neu.
   ===================================================================== */

SK.app = {};
SK.app.selCat = null;   // aktuell gewaehlte Kategorie im Erfassen-Sheet
SK.app.editId = null;   // wenn gerade eine Ausgabe bearbeitet wird: deren id

/* ---------------------------------------------------------------------
   refresh()  -> speichern + Tages-Logbuch aktualisieren + neu zeichnen.
   --------------------------------------------------------------------- */
SK.app.refresh = function () {
  SK.app.updateTodayLog();
  SK.storage.save();
  SK.ui.render();
};

/* =====================================================================
   START
   ===================================================================== */
SK.app.init = function () {
  SK.storage.load();          // Daten laden (oder Standard anlegen)
  SK.app.injectStaticIcons(); // feste Icons in Navigation/Knoepfe einsetzen
  SK.app.handleRollover();    // Monatswechsel / Logbuch nachfuehren
  SK.app.bindEvents();        // auf Klicks reagieren
  SK.ui.render();             // erstes Zeichnen
  SK.app.registerSW();        // Offline-Service-Worker
};

/* Setzt in jedes Element mit data-icon="name" das passende SVG-Icon ein.
   So stehen die Icon-Formen nur an EINER Stelle (js/icons.js).
   root = optionaler Teilbereich (z.B. ein frisch gerendertes Element).
   Idempotent: enthaelt das Element schon ein <svg>, wird es uebersprungen. */
SK.app.injectStaticIcons = function (root) {
  (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
    if (el.querySelector('svg')) return;
    el.innerHTML = SK.icon(el.dataset.icon) + el.innerHTML;
  });
};

/* =====================================================================
   TAGES-LOGBUCH & MONATSWECHSEL
   =====================================================================
   Wir speichern pro Tag, ob du unter dem Tagesbudget geblieben bist –
   daraus entsteht die Streak. Beim Oeffnen holen wir verpasste Tage nach.
   Einen echten "Reset" der Ausgaben brauchen wir nicht: der Monatszaehler
   ergibt sich immer aus dem Datum der Buchungen (siehe budget.js).
   --------------------------------------------------------------------- */
SK.app.updateTodayLog = function () {
  const info = SK.budget.dayInfo(SK.state, new Date());
  SK.state.dailyLog[SK.dateKey()] = {
    budget: Math.round(info.tagesbudget * 100) / 100,
    ausgegeben: Math.round(info.abflussHeute * 100) / 100,
    unterBudget: info.unterBudget
  };
  SK.state.meta.lastOpen = SK.dateKey();
};

SK.app.handleRollover = function () {
  const lastOpen = SK.state.meta.lastOpen;
  // Verpasste Tage (seit dem letzten Oeffnen bis gestern) ins Logbuch eintragen
  if (lastOpen && lastOpen < SK.dateKey()) {
    let cur = new Date(lastOpen + 'T00:00:00');
    cur.setDate(cur.getDate() + 1);
    const gesternKey = (function () { const d = new Date(); d.setDate(d.getDate() - 1); return SK.dateKey(d); })();
    let schutz = 0;
    while (SK.dateKey(cur) <= gesternKey && schutz < 400) {
      const k = SK.dateKey(cur);
      if (!SK.state.dailyLog[k]) {
        const info = SK.budget.dayInfo(SK.state, cur);
        SK.state.dailyLog[k] = {
          budget: Math.round(info.tagesbudget * 100) / 100,
          ausgegeben: Math.round(info.abflussHeute * 100) / 100,
          unterBudget: info.unterBudget
        };
      }
      cur.setDate(cur.getDate() + 1);
      schutz++;
    }
  }
  SK.app.updateTodayLog();
  SK.storage.save();
};

/* =====================================================================
   NAVIGATION
   ===================================================================== */
/* Views, die unten als eigener Tab vorkommen. Alles andere liegt unter "Mehr". */
SK.app.BOTTOM_VIEWS = ['heute', 'verlauf', 'statistik', 'markets', 'mehr'];

SK.app.switchView = function (view) {
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('is-active'); });
  const el = document.getElementById('view-' + view);
  if (el) el.classList.add('is-active');

  // Sidebar (Desktop): direkte Treffer markieren
  document.querySelectorAll('.side-link').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.view === view);
  });
  // Untere Leiste (mobil): Treffer markieren, sonst "Mehr" hervorheben
  let matched = false;
  document.querySelectorAll('.tab').forEach(function (b) {
    const on = b.dataset.view === view; if (on) matched = true;
    b.classList.toggle('is-active', on);
  });
  if (!matched) {
    const m = document.querySelector('.tab[data-view="mehr"]');
    if (m) m.classList.add('is-active');
  }

  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

  // Tab-spezifische Aktionen
  if (view === 'statistik') SK.ui.renderStatistik();
  if (view === 'markets') SK.app.loadMarkets();
  if (view === 'coach') SK.ui.renderCoach();
  if (view === 'ideen') SK.app.loadDailyIdea();
};

/* =====================================================================
   ERFASSEN-SHEET (Ausgabe hinzufuegen / bearbeiten)
   ===================================================================== */
SK.app.openSheet = function (entry) {
  SK.app.editId = entry ? entry.id : null;
  document.getElementById('sheet-title').textContent = entry ? 'Ausgabe bearbeiten' : 'Ausgabe erfassen';
  document.getElementById('er-betrag').value = entry ? entry.betrag : '';
  document.getElementById('er-notiz').value = entry ? (entry.notiz || '') : '';
  SK.app.selCat = entry ? entry.kategorie : (SK.state.categories[0] && SK.state.categories[0].id);
  SK.ui.renderErfassenChips(SK.app.selCat);
  document.getElementById('sheet-backdrop').classList.add('show');
  document.getElementById('sheet-erfassen').classList.add('show');
  setTimeout(function () { document.getElementById('er-betrag').focus(); }, 300);
};

SK.app.closeSheet = function () {
  document.getElementById('sheet-backdrop').classList.remove('show');
  document.getElementById('sheet-erfassen').classList.remove('show');
};

SK.app.saveEntry = function () {
  const betrag = parseFloat(document.getElementById('er-betrag').value);
  if (!betrag || betrag <= 0) { SK.ui.toast('Bitte einen Betrag eingeben', true); return; }
  const notiz = document.getElementById('er-notiz').value.trim();
  const betragR = Math.round(betrag * 100) / 100;

  if (SK.app.editId) {
    // bestehende Ausgabe aendern
    const e = SK.state.entries.find(function (x) { return x.id === SK.app.editId; });
    if (e) { e.betrag = betragR; e.kategorie = SK.app.selCat; e.notiz = notiz; }
  } else {
    // neue Ausgabe anlegen
    SK.state.entries.push({
      id: SK.uid(), datum: SK.dateKey(), betrag: betragR,
      typ: 'ausgabe', kategorie: SK.app.selCat, notiz: notiz
    });
  }
  SK.app.refresh();
  SK.app.closeSheet();
  SK.ui.toast(SK.app.editId ? 'Geändert' : 'Gespeichert');
  SK.app.editId = null;
  SK.app.pulseHero();
};

/* kleine Bestaetigungs-Animation auf der grossen Zahl */
SK.app.pulseHero = function () {
  const h = document.querySelector('.hero-amount');
  if (!h) return;
  h.classList.remove('pulse'); void h.offsetWidth; h.classList.add('pulse');
};

/* Tagesrest ins Hauptsparziel verschieben (siehe Funktion 4). */
SK.app.tagesrestSichern = function () {
  const c = SK.budget.compute(SK.state);
  const rest = Math.round(c.heuteNochVerfuegbar * 100) / 100;
  if (rest <= 0) { SK.ui.toast('Heute ist kein Rest übrig', true); return; }
  const goal = SK.budget.hauptZiel(SK.state); // dasselbe Ziel wie auf der Dashboard-Karte
  if (!goal) { SK.ui.toast('Kein Sparziel vorhanden', true); return; }
  SK.state.entries.push({ id: SK.uid(), datum: SK.dateKey(), betrag: rest, typ: 'sparen', goalId: goal.id, notiz: 'Tagesrest' });
  SK.app.refresh();
  SK.ui.toast(SK.ui.fmt(rest) + ' CHF in ' + goal.name + ' gesichert');
  SK.app.pulseHero();
};

/* =====================================================================
   GENERISCHES MODAL (Ziele / Abos / Einzahlung)
   ===================================================================== */
SK.app.openModal = function (title, bodyHTML, buttons) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  const actions = document.getElementById('modal-actions');
  actions.innerHTML = '';
  buttons.forEach(function (b) {
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || 'btn-ghost');
    el.textContent = b.label;
    el.addEventListener('click', b.onClick);
    actions.appendChild(el);
  });
  document.getElementById('modal-backdrop').classList.add('show');
  document.getElementById('modal').classList.add('show');
};
SK.app.closeModal = function () {
  document.getElementById('modal-backdrop').classList.remove('show');
  document.getElementById('modal').classList.remove('show');
};

/* ---- Ziel anlegen / bearbeiten ----
   Unterstuetzt zwei Arten: 'ziel' (Betrag bis Datum) und 'monatlich' (fester
   Betrag pro Monat, z.B. Motorrad). Die passenden Felder werden je nach Auswahl
   ein-/ausgeblendet. */
SK.app.openGoalModal = function (goal) {
  const g = goal || { name: '', modus: 'ziel', ziel: '', monatlich: '', zieldatum: '', startGespart: 0 };
  const isM = g.modus === 'monatlich';
  const body =
    '<label class="field"><span>Art</span><select id="m-modus">'
      + '<option value="ziel"' + (isM ? '' : ' selected') + '>Ziel mit Datum (z.B. Ferien)</option>'
      + '<option value="monatlich"' + (isM ? ' selected' : '') + '>Fester Betrag pro Monat (z.B. Motorrad)</option>'
    + '</select></label>'
    + '<label class="field"><span>Name</span><input type="text" id="m-name" value="' + SK.ui.esc(g.name) + '" placeholder="z.B. Notgroschen"></label>'
    + '<div id="m-grp-ziel">'
      + '<label class="field"><span>Zielbetrag (CHF)</span><input type="number" id="m-ziel" inputmode="decimal" value="' + (g.ziel || '') + '" min="1"></label>'
      + '<label class="field"><span>Zieldatum</span><input type="date" id="m-datum" value="' + (g.zieldatum || '') + '"></label>'
    + '</div>'
    + '<div id="m-grp-mon">'
      + '<label class="field"><span>Betrag pro Monat (CHF)</span><input type="number" id="m-monatlich" inputmode="decimal" value="' + (g.monatlich || '') + '" min="1" step="10"></label>'
    + '</div>'
    + '<label class="field"><span>Bereits gespart (CHF)</span><input type="number" id="m-start" inputmode="decimal" value="' + (g.startGespart || 0) + '" min="0"></label>';
  SK.app.openModal(goal ? 'Ziel bearbeiten' : 'Neues Sparziel', body, [
    { label: 'Abbrechen', cls: 'btn-ghost', onClick: SK.app.closeModal },
    { label: 'Speichern', cls: 'btn-accent', onClick: function () {
        const modus = document.getElementById('m-modus').value;
        const name = document.getElementById('m-name').value.trim();
        const start = parseFloat(document.getElementById('m-start').value) || 0;
        if (!name) { SK.ui.toast('Bitte einen Namen eingeben', true); return; }
        if (modus === 'monatlich') {
          const m = parseFloat(document.getElementById('m-monatlich').value);
          if (!m || m <= 0) { SK.ui.toast('Bitte Betrag pro Monat angeben', true); return; }
          if (goal) { goal.name = name; goal.modus = 'monatlich'; goal.monatlich = m; goal.startGespart = start; }
          else SK.state.goals.push({ id: SK.uid(), name: name, modus: 'monatlich', ziel: 0, monatlich: m, startGespart: start, zieldatum: '', farbe: '#1fc8e3', archiviert: false });
        } else {
          const ziel = parseFloat(document.getElementById('m-ziel').value);
          const datum = document.getElementById('m-datum').value;
          if (!ziel || ziel <= 0 || !datum) { SK.ui.toast('Bitte Zielbetrag und Datum angeben', true); return; }
          if (goal) { goal.name = name; goal.modus = 'ziel'; goal.ziel = ziel; goal.zieldatum = datum; goal.startGespart = start; }
          else SK.state.goals.push({ id: SK.uid(), name: name, modus: 'ziel', ziel: ziel, monatlich: 0, startGespart: start, zieldatum: datum, farbe: '#19e3a6', archiviert: false });
        }
        SK.app.refresh(); SK.app.closeModal(); SK.ui.toast('Ziel gespeichert');
      } }
  ]);
  // Felder passend zur Art ein-/ausblenden
  const upd = function () {
    const m = document.getElementById('m-modus').value === 'monatlich';
    document.getElementById('m-grp-ziel').style.display = m ? 'none' : 'block';
    document.getElementById('m-grp-mon').style.display = m ? 'block' : 'none';
  };
  document.getElementById('m-modus').addEventListener('change', upd);
  upd();
};

/* ---- In ein Ziel einzahlen ---- */
SK.app.openDepositModal = function (goalId) {
  const aktive = SK.state.goals.filter(function (g) { return !g.archiviert; });
  if (!aktive.length) { SK.ui.toast('Kein Sparziel vorhanden', true); return; }
  const optionen = aktive.map(function (g) {
    return '<option value="' + g.id + '"' + (g.id === goalId ? ' selected' : '') + '>' + SK.ui.esc(g.name) + '</option>';
  }).join('');
  const body =
    '<label class="field"><span>Betrag (CHF)</span><input type="number" id="m-betrag" inputmode="decimal" placeholder="0" min="0.05" step="0.05"></label>'
    + '<label class="field"><span>Ziel</span><select id="m-goal">' + optionen + '</select></label>';
  SK.app.openModal('Einzahlen', body, [
    { label: 'Abbrechen', cls: 'btn-ghost', onClick: SK.app.closeModal },
    { label: 'Einzahlen', cls: 'btn-accent', onClick: function () {
        const betrag = parseFloat(document.getElementById('m-betrag').value);
        const gid = document.getElementById('m-goal').value;
        if (!betrag || betrag <= 0) { SK.ui.toast('Bitte einen Betrag eingeben', true); return; }
        SK.state.entries.push({ id: SK.uid(), datum: SK.dateKey(), betrag: Math.round(betrag * 100) / 100, typ: 'sparen', goalId: gid, notiz: 'Einzahlung' });
        SK.app.refresh(); SK.app.closeModal(); SK.ui.toast('Eingezahlt'); SK.app.pulseHero();
      } }
  ]);
};

/* ---- Abo anlegen / bearbeiten ---- */
SK.app.openAboModal = function (abo) {
  const a = abo || { name: '', betrag: '', tag: '', hinweis: '', aktiv: true };
  const body =
    '<label class="field"><span>Name</span><input type="text" id="m-name" value="' + SK.ui.esc(a.name) + '"></label>'
    + '<label class="field"><span>Betrag pro Monat (CHF)</span><input type="number" id="m-betrag" inputmode="decimal" value="' + a.betrag + '" min="0" step="0.5"></label>'
    + '<label class="field"><span>Verlängerungstag im Monat (1–31, optional)</span><input type="number" id="m-tag" inputmode="numeric" value="' + (a.tag == null ? '' : a.tag) + '" min="1" max="31"></label>'
    + '<label class="field"><span>Hinweis (optional)</span><input type="text" id="m-hinweis" value="' + SK.ui.esc(a.hinweis || '') + '" placeholder="z.B. kündigen erwägen"></label>';
  const buttons = [
    { label: 'Abbrechen', cls: 'btn-ghost', onClick: SK.app.closeModal },
    { label: 'Speichern', cls: 'btn-accent', onClick: function () {
        const name = document.getElementById('m-name').value.trim();
        const betrag = parseFloat(document.getElementById('m-betrag').value);
        const tagRaw = document.getElementById('m-tag').value;
        const tag = tagRaw === '' ? null : Math.max(1, Math.min(31, parseInt(tagRaw, 10)));
        const hinweis = document.getElementById('m-hinweis').value.trim();
        if (!name || !(betrag >= 0)) { SK.ui.toast('Bitte Name und Betrag ausfüllen', true); return; }
        if (abo) { abo.name = name; abo.betrag = betrag; abo.tag = tag; abo.hinweis = hinweis; }
        else { SK.state.abos.push({ id: SK.uid(), name: name, betrag: betrag, tag: tag, aktiv: true, hinweis: hinweis }); }
        SK.app.refresh(); SK.app.closeModal(); SK.ui.toast('Abo gespeichert');
      } }
  ];
  if (abo) buttons.splice(1, 0, { label: 'Löschen', cls: 'btn-danger', onClick: function () {
    SK.state.abos = SK.state.abos.filter(function (x) { return x.id !== abo.id; });
    SK.app.refresh(); SK.app.closeModal(); SK.ui.toast('Abo gelöscht');
  } });
  SK.app.openModal(abo ? 'Abo bearbeiten' : 'Neues Abo', body, buttons);
};

/* ---- Schulden-Posten / Busse anlegen / bearbeiten ----
   kind: 'schuld' (Standard) oder 'busse'. */
SK.app.openDebtModal = function (debt, kind) {
  const d = debt || { name: '', gesamt: '', faellig: '', notiz: '' };
  const neu = !debt;
  const istBusse = (debt ? debt.kind : kind) === 'busse';
  let body =
    '<label class="field"><span>Name</span><input type="text" id="m-name" value="' + SK.ui.esc(d.name) + '" placeholder="' + (istBusse ? 'z.B. Parkbusse' : 'z.B. Werkstatt') + '"></label>'
    + '<label class="field"><span>Gesamtbetrag (CHF)</span><input type="number" id="m-gesamt" inputmode="decimal" value="' + d.gesamt + '" min="1" step="1"></label>'
    + '<label class="field"><span>Fällig bis (optional)</span><input type="date" id="m-faellig" value="' + (d.faellig || '') + '"></label>'
    + '<label class="field"><span>Notiz (optional)</span><input type="text" id="m-notiz" value="' + SK.ui.esc(d.notiz || '') + '" placeholder="z.B. Bremsen + Service"></label>';
  // "in X Raten aufteilen" nur beim Neuanlegen
  if (neu) {
    body += '<label class="field"><span>In wie viele Raten aufteilen? (optional)</span><input type="number" id="m-raten" inputmode="numeric" min="1" placeholder="z.B. 3"></label>'
          + '<div class="rate-hint" id="m-ratehint"></div>'
          + '<label class="switch-row"><span>Vorgeschlagene Rate als monatliche Schulden-Rate setzen</span><input type="checkbox" id="m-setrate" class="switch"></label>';
  }
  SK.app.openModal(neu ? (istBusse ? 'Neue Busse' : 'Neuer Posten') : 'Posten bearbeiten', body, [
    { label: 'Abbrechen', cls: 'btn-ghost', onClick: SK.app.closeModal },
    { label: 'Speichern', cls: 'btn-accent', onClick: function () {
        const name = document.getElementById('m-name').value.trim();
        const gesamt = parseFloat(document.getElementById('m-gesamt').value);
        if (!name || !gesamt || gesamt <= 0) { SK.ui.toast('Bitte Name und Gesamtbetrag ausfüllen', true); return; }
        const faellig = document.getElementById('m-faellig').value || null;
        const notiz = document.getElementById('m-notiz').value.trim();
        if (debt) {
          debt.name = name; debt.gesamt = gesamt; debt.faellig = faellig; debt.notiz = notiz;
        } else {
          SK.state.debts.push({ id: SK.uid(), name: name, gesamt: gesamt, faellig: faellig, notiz: notiz, erledigt: false, kind: (kind === 'busse' ? 'busse' : 'schuld'), zahlungen: [] });
          // optional: vorgeschlagene Rate als monatliche Schulden-Rate uebernehmen
          const ratenEl = document.getElementById('m-raten');
          const setrateEl = document.getElementById('m-setrate');
          const r = ratenEl ? parseInt(ratenEl.value, 10) : 0;
          if (setrateEl && setrateEl.checked && r > 0) {
            SK.state.settings.schuldenRate = Math.round((gesamt / r) * 100) / 100;
            SK.state.settings.schuldenRateAktiv = true;
          }
        }
        SK.app.refresh(); SK.app.closeModal(); SK.ui.toast('Posten gespeichert');
      } }
  ]);
  // Live-Vorschlag fuer die Rate (nur beim Neuanlegen vorhanden)
  if (neu) {
    const upd = function () {
      const g = parseFloat(document.getElementById('m-gesamt').value) || 0;
      const r = parseInt(document.getElementById('m-raten').value, 10);
      const hint = document.getElementById('m-ratehint');
      hint.textContent = (g > 0 && r > 0) ? '≈ ' + SK.ui.fmt(g / r, 2) + ' CHF pro Monat über ' + r + ' Monate' : '';
    };
    document.getElementById('m-gesamt').addEventListener('input', upd);
    document.getElementById('m-raten').addEventListener('input', upd);
  }
};

/* ---- Teilzahlung auf einen Posten erfassen ---- */
SK.app.openPaymentModal = function (debtId) {
  const d = SK.state.debts.find(function (x) { return x.id === debtId; });
  if (!d) return;
  const offen = SK.budget.debtOpen(d);
  const body =
    '<p class="muted">' + SK.ui.esc(d.name) + ' · offen ' + SK.ui.fmt(offen, 2) + ' CHF</p>'
    + '<label class="field"><span>Betrag (CHF)</span><input type="number" id="m-betrag" inputmode="decimal" placeholder="0" min="0.05" step="0.05"></label>'
    + '<label class="field"><span>Datum</span><input type="date" id="m-datum" value="' + SK.dateKey() + '"></label>'
    + '<label class="field"><span>Notiz (optional)</span><input type="text" id="m-notiz" placeholder="z.B. 1. Rate"></label>';
  SK.app.openModal('Teilzahlung', body, [
    { label: 'Abbrechen', cls: 'btn-ghost', onClick: SK.app.closeModal },
    { label: 'Erfassen', cls: 'btn-accent', onClick: function () {
        const betrag = parseFloat(document.getElementById('m-betrag').value);
        if (!betrag || betrag <= 0) { SK.ui.toast('Bitte einen Betrag eingeben', true); return; }
        const datum = document.getElementById('m-datum').value || SK.dateKey();
        const notiz = document.getElementById('m-notiz').value.trim();
        d.zahlungen = d.zahlungen || [];
        d.zahlungen.push({ id: SK.uid(), datum: datum, betrag: Math.round(betrag * 100) / 100, notiz: notiz });
        // voll bezahlt? -> automatisch ins Archiv
        const fertig = SK.budget.debtOpen(d) <= 0;
        if (fertig) d.erledigt = true;
        SK.app.refresh(); SK.app.closeModal();
        SK.ui.toast(fertig ? 'Beglichen – ins Archiv' : 'Teilzahlung erfasst');
      } }
  ]);
};

/* =====================================================================
   MÄRKTE / KI / LISTEN (v2)
   ===================================================================== */

/* Holt aktuelle Krypto-Kurse und zeichnet den Maerkte-Tab neu.
   Faellt bei Fehler/Funkloch auf die zwischengespeicherten Werte zurueck. */
SK.app.loadingMarkets = false;
SK.app.loadMarkets = async function () {
  if (SK.app.loadingMarkets) return;
  SK.app.loadingMarkets = true;
  const refreshBtn = document.getElementById('btn-market-refresh');
  if (refreshBtn) refreshBtn.classList.add('spinning');
  try {
    await SK.markets.load();
    SK.ui.renderMarkets();
    SK.ui.renderEthMini();
  } catch (e) {
    SK.ui.renderMarkets(); // zeigt Cache
    if (!SK.markets.cached()) SK.ui.toast('Kurse nicht erreichbar (offline?)', true);
  } finally {
    SK.app.loadingMarkets = false;
    if (refreshBtn) refreshBtn.classList.remove('spinning');
  }
};

/* Holt die "Idee des Tages" von Claude – aber hoechstens einmal pro Tag
   automatisch (gecacht in state.moneyResearch). force=true erzwingt neu. */
SK.app.loadingIdea = false;
SK.app.loadDailyIdea = async function (force) {
  if (!SK.ai.available()) { SK.ui.renderIdeen(); return; }
  const heute = SK.dateKey();
  if (!force && SK.state.moneyResearch && SK.state.moneyResearch.datum === heute && SK.state.moneyResearch.text) {
    SK.ui.renderIdeen(); return;
  }
  if (SK.app.loadingIdea) return;          // schon eine Anfrage unterwegs
  SK.app.loadingIdea = true;
  const refreshBtn = document.getElementById('btn-idea-refresh');
  if (refreshBtn) refreshBtn.classList.add('spinning');
  const body = document.getElementById('id-ai-body');
  if (body) body.innerHTML = '<div class="skeleton" style="height:80px"></div>';
  try {
    const text = await SK.ai.idea();
    SK.state.moneyResearch = { datum: heute, text: text };
    SK.storage.save();
    SK.ui.renderIdeen();
  } catch (e) {
    if (body) body.innerHTML = '<p class="ai-error">KI-Idee nicht geladen: ' + SK.ui.esc(e.message) + '</p>';
  } finally {
    SK.app.loadingIdea = false;
    if (refreshBtn) refreshBtn.classList.remove('spinning');
  }
};

/* Holt eine persoenliche Ausgaben-Analyse von Claude (Knopf im KI-Coach). */
SK.app.analyzing = false;
SK.app.analyzeSpending = async function () {
  if (SK.app.analyzing) return;            // schon eine Analyse unterwegs
  SK.app.analyzing = true;
  const out = document.getElementById('co-out');
  if (out) out.innerHTML = '<div class="skeleton" style="height:90px"></div>';
  try {
    const text = await SK.ai.analyze();
    if (out) out.innerHTML = '<div class="ai-out">' + SK.ui.aiText(text) + '</div>';
  } catch (e) {
    if (out) out.innerHTML = '<p class="ai-error">Analyse fehlgeschlagen: ' + SK.ui.esc(e.message) + '</p>';
  } finally {
    SK.app.analyzing = false;
  }
};

/* Testet den hinterlegten API-Schluessel mit einer winzigen Anfrage. */
SK.app.testAiKey = async function () {
  const out = document.getElementById('se-aitest-out');
  out.textContent = 'Teste …';
  try {
    await SK.ai.ask('Antworte mit genau dem Wort: OK', 'Test', 16);
    out.innerHTML = SK.icon('check', 'ic-sm') + ' Schlüssel funktioniert.';
    out.style.color = 'var(--green)';
  } catch (e) {
    out.innerHTML = SK.icon('alert', 'ic-sm') + ' ' + SK.ui.esc(e.message);
    out.style.color = 'var(--red)';
  }
};

/* Neue Liste anlegen. */
SK.app.addList = function () {
  const name = (prompt('Name der neuen Liste:', '') || '').trim();
  if (!name) return;
  SK.state.lists.push({ id: SK.uid(), name: name, icon: 'star', items: [] });
  SK.app.refresh(); SK.ui.toast('Liste angelegt');
};

/* =====================================================================
   EREIGNISSE VERBINDEN (Klicks, Eingaben)
   ===================================================================== */
SK.app.bindEvents = function () {
  // Navigation (untere Leiste + Sidebar + Links mit data-view)
  document.addEventListener('click', SK.app.onClick);
  document.addEventListener('change', SK.app.onChange);

  // Erfassen oeffnen
  document.getElementById('fab-add').addEventListener('click', function () { SK.app.openSheet(null); });
  document.getElementById('btn-add-desktop').addEventListener('click', function () { SK.app.openSheet(null); });
  document.getElementById('btn-settings').addEventListener('click', function () { SK.app.switchView('einstellungen'); });

  // Erfassen-Sheet
  document.getElementById('er-save').addEventListener('click', SK.app.saveEntry);
  document.getElementById('er-cancel').addEventListener('click', SK.app.closeSheet);
  document.getElementById('sheet-backdrop').addEventListener('click', SK.app.closeSheet);
  document.getElementById('modal-backdrop').addEventListener('click', SK.app.closeModal);
  document.getElementById('er-betrag').addEventListener('keydown', function (e) { if (e.key === 'Enter') SK.app.saveEntry(); });

  // Tagesrest sichern
  document.getElementById('btn-tagesrest').addEventListener('click', SK.app.tagesrestSichern);

  // Ziele / Abos / Schulden / Bussen / Listen hinzufuegen
  document.getElementById('btn-add-ziel').addEventListener('click', function () { SK.app.openGoalModal(null); });
  document.getElementById('btn-add-abo').addEventListener('click', function () { SK.app.openAboModal(null); });
  document.getElementById('btn-add-debt').addEventListener('click', function () { SK.app.openDebtModal(null, 'schuld'); });
  document.getElementById('btn-add-busse').addEventListener('click', function () { SK.app.openDebtModal(null, 'busse'); });
  document.getElementById('btn-add-list').addEventListener('click', SK.app.addList);
  document.getElementById('sc-archiv-toggle').addEventListener('click', function () {
    SK.ui.debtArchiveOpen = !SK.ui.debtArchiveOpen; SK.ui.renderSchulden();
  });

  // Märkte / Geld-Ideen aktualisieren
  document.getElementById('btn-market-refresh').addEventListener('click', SK.app.loadMarkets);
  document.getElementById('btn-idea-refresh').addEventListener('click', function () { SK.app.loadDailyIdea(true); });

  // Einstellungen
  document.getElementById('se-lohn').addEventListener('change', function (e) {
    SK.state.settings.lohn = Math.max(0, parseFloat(e.target.value) || 0); SK.app.refresh();
  });
  document.getElementById('se-fixkosten').addEventListener('change', function (e) {
    SK.state.settings.fixkosten = Math.max(0, parseFloat(e.target.value) || 0); SK.app.refresh();
  });
  document.getElementById('se-aboswitch').addEventListener('change', function (e) {
    SK.state.settings.abosInFixkosten = e.target.checked; SK.app.refresh();
  });
  document.getElementById('se-schuldenswitch').addEventListener('change', function (e) {
    SK.state.settings.schuldenRateAktiv = e.target.checked; SK.app.refresh();
  });
  document.getElementById('se-schuldenrate').addEventListener('change', function (e) {
    SK.state.settings.schuldenRate = Math.max(0, parseFloat(e.target.value) || 0); SK.app.refresh();
  });
  // KI-Coach-Einstellungen
  document.getElementById('se-aiswitch').addEventListener('change', function (e) {
    SK.state.settings.aiAktiv = e.target.checked; SK.app.refresh();
  });
  document.getElementById('se-aikey').addEventListener('change', function (e) {
    SK.state.settings.aiKey = e.target.value.trim(); SK.storage.save();
  });
  document.getElementById('se-aimodel').addEventListener('change', function (e) {
    SK.state.settings.aiModel = e.target.value; SK.storage.save();
  });
  document.getElementById('se-aitest').addEventListener('click', SK.app.testAiKey);
  document.getElementById('se-cryptocur').addEventListener('change', function (e) {
    SK.state.settings.cryptoWaehrung = e.target.value;
    SK.state.cryptoCache = { ts: 0, data: null }; // Waehrung gewechselt -> Cache verwerfen
    SK.storage.save(); SK.app.refresh();
  });

  document.getElementById('se-addcat').addEventListener('click', SK.app.addCategory);
  document.getElementById('se-newcat').addEventListener('keydown', function (e) { if (e.key === 'Enter') SK.app.addCategory(); });
  document.getElementById('se-export').addEventListener('click', SK.storage.downloadBackup);
  document.getElementById('se-importfile').addEventListener('change', SK.app.importFile);
  document.getElementById('se-reset').addEventListener('click', function () {
    if (confirm('Wirklich ALLE Daten löschen und neu starten? Das kann nicht rückgängig gemacht werden.')) {
      SK.storage.reset(); SK.app.handleRollover(); SK.ui.render(); SK.ui.toast('Zurückgesetzt');
    }
  });
};

/* Zentrale Klick-Verteilung (Event-Delegation).
   So muessen wir nicht an jede dynamisch erzeugte Schaltflaeche einzeln
   einen Listener haengen. */
SK.app.onClick = function (ev) {
  const t = ev.target;

  // 1) Kategorie-Chip im Erfassen-Sheet
  const chip = t.closest('#er-kategorien .chip');
  if (chip) { SK.app.selCat = chip.dataset.cat; SK.ui.renderErfassenChips(SK.app.selCat); return; }

  // 2) Verlauf-Filter
  const fil = t.closest('[data-filter]');
  if (fil) { SK.ui.verlaufFilter = fil.dataset.filter; SK.ui.renderVerlauf(); return; }

  // 3) Navigation / Links mit data-view
  const nav = t.closest('[data-view]');
  if (nav) { SK.app.switchView(nav.dataset.view); return; }

  // 4) Aktions-Knoepfe (data-act)
  const act = t.closest('[data-act]');
  if (!act) return;
  const a = act.dataset.act;

  if (a === 'edit') {
    const e = SK.state.entries.find(function (x) { return x.id === act.dataset.id; });
    if (e && e.typ === 'sparen') { SK.ui.toast('Spar-Buchung: bitte löschen statt bearbeiten', true); return; }
    if (e) SK.app.openSheet(e);
  } else if (a === 'del') {
    SK.state.entries = SK.state.entries.filter(function (x) { return x.id !== act.dataset.id; });
    SK.app.refresh(); SK.ui.toast('Gelöscht');
  } else if (a === 'deposit') {
    SK.app.openDepositModal(act.dataset.goal);
  } else if (a === 'editgoal') {
    SK.app.openGoalModal(SK.state.goals.find(function (g) { return g.id === act.dataset.goal; }));
  } else if (a === 'delgoal') {
    if (confirm('Dieses Sparziel löschen? Die zugehörigen Spar-Buchungen bleiben im Verlauf.')) {
      SK.state.goals = SK.state.goals.filter(function (g) { return g.id !== act.dataset.goal; });
      SK.app.refresh(); SK.ui.toast('Ziel gelöscht');
    }
  } else if (a === 'editabo') {
    SK.app.openAboModal(SK.state.abos.find(function (x) { return x.id === act.dataset.abo; }));
  } else if (a === 'delcat') {
    SK.state.categories = SK.state.categories.filter(function (c) { return c.id !== act.dataset.cat; });
    SK.app.refresh(); SK.ui.toast('Kategorie entfernt');

  /* ---- Schulden / Sonderausgaben ---- */
  } else if (a === 'addpay') {
    SK.app.openPaymentModal(act.dataset.debt);
  } else if (a === 'editdebt') {
    SK.app.openDebtModal(SK.state.debts.find(function (x) { return x.id === act.dataset.debt; }));
  } else if (a === 'donedebt') {
    const d = SK.state.debts.find(function (x) { return x.id === act.dataset.debt; });
    if (d) { d.erledigt = true; SK.app.refresh(); SK.ui.toast('Posten ins Archiv'); }
  } else if (a === 'reopendebt') {
    const d = SK.state.debts.find(function (x) { return x.id === act.dataset.debt; });
    if (d) { d.erledigt = false; SK.app.refresh(); SK.ui.toast('Wieder geöffnet'); }
  } else if (a === 'deldebt') {
    if (confirm('Diesen Posten samt allen Teilzahlungen löschen?')) {
      SK.state.debts = SK.state.debts.filter(function (x) { return x.id !== act.dataset.debt; });
      SK.app.refresh(); SK.ui.toast('Posten gelöscht');
    }
  } else if (a === 'togglepays') {
    SK.ui.debtExpanded[act.dataset.debt] = !SK.ui.debtExpanded[act.dataset.debt];
    SK.ui.renderSchulden();
  } else if (a === 'delpay') {
    const d = SK.state.debts.find(function (x) { return x.id === act.dataset.debt; });
    if (d) { d.zahlungen = (d.zahlungen || []).filter(function (z) { return z.id !== act.dataset.pay; }); SK.app.refresh(); SK.ui.toast('Zahlung gelöscht'); }

  /* ---- KI-Coach ---- */
  } else if (a === 'analyze') {
    SK.app.analyzeSpending();

  /* ---- Listen / Wunschliste ---- */
  } else if (a === 'listadd') {
    const lid = act.dataset.list;
    const l = SK.state.lists.find(function (x) { return x.id === lid; });
    const tEl = document.querySelector('.li-new-text[data-list="' + lid + '"]');
    const aEl = document.querySelector('.li-new-amt[data-list="' + lid + '"]');
    const text = (tEl.value || '').trim();
    if (!text) { tEl.focus(); return; }
    const betrag = parseFloat(aEl.value) || 0;
    l.items = l.items || [];
    l.items.push({ id: SK.uid(), text: text, betrag: betrag ? Math.round(betrag * 100) / 100 : 0, erledigt: false });
    SK.app.refresh();
  } else if (a === 'listtoggle') {
    const l = SK.state.lists.find(function (x) { return x.id === act.dataset.list; });
    const it = l && (l.items || []).find(function (x) { return x.id === act.dataset.item; });
    if (it) { it.erledigt = !it.erledigt; SK.app.refresh(); }
  } else if (a === 'listdelitem') {
    const l = SK.state.lists.find(function (x) { return x.id === act.dataset.list; });
    if (l) { l.items = (l.items || []).filter(function (x) { return x.id !== act.dataset.item; }); SK.app.refresh(); }
  } else if (a === 'dellist') {
    if (confirm('Diese Liste löschen?')) {
      SK.state.lists = SK.state.lists.filter(function (x) { return x.id !== act.dataset.list; });
      SK.app.refresh(); SK.ui.toast('Liste gelöscht');
    }
  }
};

/* Aenderungen an Schaltern/Checkboxen (z.B. Abo aktiv/gekuendigt). */
SK.app.onChange = function (ev) {
  const t = ev.target;
  if (t.dataset && t.dataset.act === 'toggleabo') {
    const abo = SK.state.abos.find(function (x) { return x.id === t.dataset.abo; });
    if (abo) { abo.aktiv = t.checked; SK.app.refresh(); }
  }
};

/* Neue Kategorie hinzufuegen (mit rotierender Farbe). */
SK.app._catColors = ['#ff8c42', '#4f9dff', '#c879ff', '#2dd4bf', '#f472b6', '#a3e635', '#fb7185', '#38bdf8'];
SK.app.addCategory = function () {
  const inp = document.getElementById('se-newcat');
  const name = inp.value.trim();
  if (!name) return;
  const farbe = SK.app._catColors[SK.state.categories.length % SK.app._catColors.length];
  SK.state.categories.push({ id: 'c' + SK.uid(), name: name, color: farbe, icon: 'tag' });
  inp.value = '';
  SK.app.refresh();
  SK.ui.toast('Kategorie hinzugefügt');
};

/* Backup-Datei einlesen. */
SK.app.importFile = function (ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    try {
      SK.storage.importFromText(reader.result);
      SK.app.handleRollover();
      SK.ui.render();
      SK.ui.toast('Backup importiert');
    } catch (e) {
      SK.ui.toast('Import fehlgeschlagen: ' + e.message, true);
    }
    ev.target.value = ''; // gleiche Datei erneut waehlbar machen
  };
  reader.readAsText(file);
};

/* =====================================================================
   SERVICE WORKER (macht die App offline-faehig)
   ===================================================================== */
SK.app.registerSW = function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function (e) {
        console.warn('Service Worker konnte nicht registriert werden:', e);
      });
    });
  }
};

/* App starten, sobald die Seite bereit ist. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', SK.app.init);
} else {
  SK.app.init();
}
