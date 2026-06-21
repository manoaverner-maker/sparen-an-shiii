/* =====================================================================
   budget.js  ·  Die Rechen-Logik (Herzstueck der App)
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Hier passiert das eigentliche Rechnen. Diese Datei beantwortet die
   zentrale Frage: "Wie viel kann ich HEUTE noch ausgeben, ohne mein
   Sparziel und meine Fixkosten zu gefaehrden?"

   Sie enthaelt NUR Rechnungen (keine Anzeige, kein Speichern). Dadurch
   ist sie leicht zu verstehen und zu testen. Die Anzeige passiert in
   ui.js, das die Ergebnisse von hier abholt.

   ZUSAMMENHANG:
     storage.js  ->  liefert den Zustand (SK.state)
     budget.js   ->  rechnet daraus alle Kennzahlen
     ui.js       ->  zeigt die Kennzahlen an
   ===================================================================== */

SK.budget = {};

/* =====================================================================
   TEIL 1: Datums-Hilfsfunktionen
   ===================================================================== */

/* Wie viele Tage hat der Monat des uebergebenen Datums? (28..31)
   Trick: Tag 0 des Folgemonats ist der letzte Tag dieses Monats. */
SK.budget.daysInMonth = function (d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

/* Wie viele Tage bleiben im Monat, HEUTE mitgezaehlt?
   Beispiel 21. Juni: 30 - 21 + 1 = 10 Tage. */
SK.budget.daysLeftInMonth = function (d) {
  return SK.budget.daysInMonth(d) - d.getDate() + 1;
};

/* Monats-Schluessel "JJJJ-MM" (z.B. "2026-06") zum Vergleichen/Filtern. */
SK.budget.monthKey = function (d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
};

/* Anzahl Monate von "von" bis zum Zieldatum, der aktuelle Monat MITgezaehlt.
   Beispiel: heute Juni, Ziel August -> Juni, Juli, August = 3 Monate.
   Mindestens 1 (damit wir nie durch 0 teilen und ein abgelaufenes Ziel
   einfach "diesen Monat" behandelt wird).
   Rein: Zieldatum-Text "JJJJ-MM-TT", aktuelles Datum. Raus: ganze Zahl >= 1. */
SK.budget.monthsUntil = function (zieldatumStr, von) {
  const ziel = new Date(zieldatumStr + 'T00:00:00');
  const diff = (ziel.getFullYear() - von.getFullYear()) * 12
             + (ziel.getMonth() - von.getMonth()) + 1; // +1 = aktueller Monat zaehlt mit
  return Math.max(1, diff);
};

/* =====================================================================
   TEIL 2: Sparziele
   ===================================================================== */

/* Wie viel wurde fuer EIN Ziel bereits gespart?
   = Startbetrag + Summe aller Spar-Buchungen, die diesem Ziel zugeordnet
   sind (ueber alle Monate, denn Erspartes bleibt erhalten).
   Rein: Zustand + ein Ziel. Raus: gesparter Betrag in CHF. */
SK.budget.goalSaved = function (state, goal) {
  let summe = goal.startGespart || 0;
  for (const e of state.entries) {
    if (e.typ === 'sparen' && e.goalId === goal.id) summe += e.betrag;
  }
  return summe;
};

/* Noch fehlender Betrag fuer ein Ziel (nie negativ). */
SK.budget.goalRemaining = function (state, goal) {
  return Math.max(0, goal.ziel - SK.budget.goalSaved(state, goal));
};

/* Benoetigte monatliche Sparrate fuer EIN Ziel:
   fehlender Betrag / Monate bis zum Zieldatum.
   Archivierte oder bereits erreichte Ziele brauchen 0. */
SK.budget.goalMonthlyRate = function (state, goal, heute) {
  if (goal.archiviert) return 0;
  const fehlt = SK.budget.goalRemaining(state, goal);
  if (fehlt <= 0) return 0;
  return fehlt / SK.budget.monthsUntil(goal.zieldatum, heute);
};

/* Summe der monatlichen Sparraten ueber ALLE aktiven Ziele.
   Das ist der Betrag, den wir jeden Monat fuers Sparen "reservieren". */
SK.budget.totalMonthlyRate = function (state, heute) {
  let summe = 0;
  for (const g of state.goals) summe += SK.budget.goalMonthlyRate(state, g, heute);
  return summe;
};

/* =====================================================================
   TEIL 3: Fixkosten & Abos
   ===================================================================== */

/* Summe aller AKTIVEN Abos pro Monat. */
SK.budget.aboSum = function (state) {
  let summe = 0;
  for (const a of state.abos) if (a.aktiv) summe += a.betrag;
  return summe;
};

/* Effektive Fixkosten:
   Grund-Fixkosten + (falls in den Einstellungen aktiviert) die Abo-Summe.
   Standard: Abos NICHT dazurechnen, damit nichts doppelt zaehlt, falls
   deine Fixkosten die Abos schon enthalten. */
SK.budget.fixkostenEffektiv = function (state) {
  let f = state.settings.fixkosten;
  if (state.settings.abosInFixkosten) f += SK.budget.aboSum(state);
  return f;
};

/* =====================================================================
   TEIL 4: Ausgaben des Monats / Tages
   ===================================================================== */

/* Alle Buchungen, die im selben Monat wie "d" liegen. */
SK.budget.monthEntries = function (state, d) {
  const mk = SK.budget.monthKey(d);
  return state.entries.filter(function (e) {
    return e.datum.slice(0, 7) === mk; // "JJJJ-MM"
  });
};

/* Gesamter Geld-Abfluss eines Monats = Ausgaben UND Spar-Buchungen.
   Beides verlaesst dein verfuegbares Budget, darum zaehlt beides. */
SK.budget.outflowMonth = function (state, d) {
  return SK.budget.monthEntries(state, d).reduce(function (s, e) { return s + e.betrag; }, 0);
};

/* Nur die echten AUSGABEN eines Monats (ohne Spar-Buchungen).
   Wird fuer Tempo-Warnung, Hochrechnung und das Tortendiagramm benutzt,
   weil Sparen keine "Ausgabe" ist. */
SK.budget.spendMonth = function (state, d) {
  return SK.budget.monthEntries(state, d)
    .filter(function (e) { return e.typ !== 'sparen'; })
    .reduce(function (s, e) { return s + e.betrag; }, 0);
};

/* =====================================================================
   TEIL 5: TAGESBUDGET  -  die zentrale Rechnung
   =====================================================================
   Diese Funktion liefert fuer einen beliebigen Tag das Tagesbudget und
   wie viel an diesem Tag schon abgeflossen ist. Sie wird sowohl fuer
   HEUTE als auch (rueckblickend) fuer die Streak-Berechnung benutzt.

   Die Rechnung in Worten:
     1) Pro Ziel: fehlender Betrag = Ziel - bereits gespart
     2) Monatliche Sparrate = fehlender Betrag / Monate bis Zieldatum
        (Summe ueber alle Ziele)
     3) Verfuegbar diesen Monat = Lohn - Fixkosten - Sparrate
     4) Bereits abgeflossen BIS GESTERN = Summe der Buchungen dieses
        Monats vor dem betrachteten Tag
     5) Noch verfuegbar zu Tagesbeginn = (3) - (4)
     6) Tagesbudget = (5) / verbleibende Tage im Monat (inkl. heute)
   --------------------------------------------------------------------- */
SK.budget.dayInfo = function (state, d) {
  const heuteKey = SK.dateKey(d);
  const eintraege = SK.budget.monthEntries(state, d);

  // (1)+(2) Sparrate, (3) Verfuegbar
  const sparrate = SK.budget.totalMonthlyRate(state, d);
  // Optionale Schulden-Rate: wie die Sparrate VORAB reservieren (separater Topf).
  // Die einzelnen Schulden-Teilzahlungen selbst zaehlen NICHT ins Tagesbudget.
  const schuldenRate = SK.budget.schuldenRate(state);
  const verfuegbar = state.settings.lohn - SK.budget.fixkostenEffektiv(state) - sparrate - schuldenRate;

  // (4) abgeflossen vor dem betrachteten Tag, und (heute) am Tag selbst
  let abgeflossenVorher = 0;
  let abflussHeute = 0;
  for (const e of eintraege) {
    if (e.datum < heuteKey) abgeflossenVorher += e.betrag;
    else if (e.datum === heuteKey) abflussHeute += e.betrag;
  }

  // (5) noch verfuegbar zu Tagesbeginn
  const nochVerfuegbar = verfuegbar - abgeflossenVorher;

  // (6) Tagesbudget = Rest / verbleibende Tage (inkl. heute)
  const restTage = SK.budget.daysLeftInMonth(d);
  const tagesbudget = nochVerfuegbar / restTage;

  return {
    verfuegbar: verfuegbar,
    sparrate: sparrate,
    schuldenRate: schuldenRate,
    tagesbudget: tagesbudget,
    abflussHeute: abflussHeute,           // alles (Ausgaben + Sparen) heute
    heuteNochVerfuegbar: tagesbudget - abflussHeute,
    unterBudget: abflussHeute <= tagesbudget
  };
};

/* =====================================================================
   TEIL 6: Komplettes Dashboard fuer HEUTE
   =====================================================================
   Buendelt alle Kennzahlen, die der "Heute"-Bildschirm braucht, in einem
   einzigen Objekt. ui.js liest einfach die Felder ab.
   --------------------------------------------------------------------- */
SK.budget.compute = function (state, heute) {
  heute = heute || new Date();
  const day = SK.budget.dayInfo(state, heute);

  const tag = heute.getDate();
  const tageImMonat = SK.budget.daysInMonth(heute);
  const restTage = SK.budget.daysLeftInMonth(heute);

  const outflowMonat = SK.budget.outflowMonth(state, heute); // Ausgaben + Sparen
  const spendMonat = SK.budget.spendMonth(state, heute);     // nur Ausgaben
  const nochVerfuegbarMonat = day.verfuegbar - outflowMonat;

  /* ---- Ampelfarbe fuer "Heute noch verfuegbar" ----
     gruen: noch mehr als ein Drittel des Tagesbudgets uebrig
     gelb:  zwischen 0 und einem Drittel uebrig (Achtung)
     rot:   Tagesbudget heute ueberschritten (oder Monat schon im Minus) */
  let ampel;
  if (day.heuteNochVerfuegbar < 0 || day.tagesbudget <= 0) ampel = 'rot';
  else if (day.heuteNochVerfuegbar < day.tagesbudget / 3) ampel = 'gelb';
  else ampel = 'gruen';

  /* ---- Tempo-Warnung (Pace) ----
     Wie viel "duerfte" ich bis heute ausgegeben haben, wenn ich das
     verfuegbare Monatsbudget gleichmaessig auf die Tage verteile?
       Soll bis heute = Verfuegbar * (Tag von heute / Tage im Monat)
     Differenz > 0  -> ich bin dem Budget VORAUS (zu schnell).
     Differenz < 0  -> ich liege unter dem Soll (gut). */
  const sollBisHeute = day.verfuegbar * (tag / tageImMonat);
  const paceDiff = spendMonat - sollBisHeute; // + = voraus, - = im Plan
  let paceStatus;
  if (paceDiff > day.tagesbudget * 0.5) paceStatus = 'warnung'; // spuerbar voraus
  else if (paceDiff > 0) paceStatus = 'knapp';
  else paceStatus = 'gut';

  /* ---- Monats-Hochrechnung ----
     "Bei diesem Tempo endest du den Monat bei X CHF."
     Wir rechnen die bisherige Tages-Ausgabenrate auf den ganzen Monat hoch. */
  const hochrechnung = tag > 0 ? (spendMonat / tag) * tageImMonat : 0;
  const hochrechnungStatus = hochrechnung <= day.verfuegbar ? 'gut' : 'drueber';

  return {
    // Basiswerte
    lohn: state.settings.lohn,
    fixkosten: SK.budget.fixkostenEffektiv(state),
    sparrate: day.sparrate,
    schuldenRate: day.schuldenRate,
    verfuegbarMonat: day.verfuegbar,
    // Tag / Monat
    tag: tag,
    tageImMonat: tageImMonat,
    restTage: restTage,
    // Ausgaben
    ausgegebenMonat: outflowMonat,     // inkl. Spar-Buchungen
    spendMonat: spendMonat,            // nur Ausgaben
    nochVerfuegbarMonat: nochVerfuegbarMonat,
    abflussHeute: day.abflussHeute,
    // Das Herzstueck
    tagesbudget: day.tagesbudget,
    heuteNochVerfuegbar: day.heuteNochVerfuegbar,
    ampel: ampel,
    // Tempo
    sollBisHeute: sollBisHeute,
    paceDiff: paceDiff,
    paceStatus: paceStatus,
    // Hochrechnung
    hochrechnung: hochrechnung,
    hochrechnungStatus: hochrechnungStatus
  };
};

/* =====================================================================
   TEIL 7: Streak (Tage in Folge unter dem Tagesbudget)
   =====================================================================
   Liest das Tages-Logbuch (state.dailyLog) und zaehlt rueckwaerts ab heute,
   wie viele Tage in Folge "unterBudget" waren. Das Logbuch wird in app.js
   bei jedem Oeffnen aktuell gehalten.
   Rein: Zustand. Raus: Anzahl Tage (ganze Zahl >= 0).
   --------------------------------------------------------------------- */
SK.budget.streak = function (state) {
  let streak = 0;
  const d = new Date();
  // bis zu zwei Jahre zurueck schauen ist mehr als genug
  for (let i = 0; i < 750; i++) {
    const key = SK.dateKey(d);
    const log = state.dailyLog[key];
    if (log && log.unterBudget) {
      streak++;
    } else if (i === 0) {
      // Heute ist (noch) nicht "unter Budget" -> Streak ab gestern weiterzaehlen
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
};

/* =====================================================================
   TEIL 8: Daten fuer die Statistik-Charts
   ===================================================================== */

/* Kumulierte Ausgaben pro Tag fuer einen Monat (fuer das Linienchart).
   Rein: Zustand + ein Datum im gewuenschten Monat.
   Raus: { ist: [...], soll: [...], tageImMonat, heuteTag }
     ist  = kumulierte echte Ausgaben Tag 1..n (bis heute, danach null)
     soll = gleichmaessige Soll-Linie (verfuegbar/Tag aufsummiert) */
SK.budget.monthSeries = function (state, d) {
  const tageImMonat = SK.budget.daysInMonth(d);
  const istMonat = (SK.budget.monthKey(d) === SK.budget.monthKey(new Date()));
  const heuteTag = istMonat ? new Date().getDate() : tageImMonat;

  // Ausgaben pro Tag sammeln (nur echte Ausgaben)
  const proTag = new Array(tageImMonat + 1).fill(0);
  for (const e of SK.budget.monthEntries(state, d)) {
    if (e.typ === 'sparen') continue;
    const tag = parseInt(e.datum.slice(8, 10), 10);
    if (tag >= 1 && tag <= tageImMonat) proTag[tag] += e.betrag;
  }

  const verfuegbar = SK.budget.dayInfo(state, d).verfuegbar;
  const ist = [];
  const soll = [];
  let kumuliert = 0;
  for (let t = 1; t <= tageImMonat; t++) {
    kumuliert += proTag[t];
    ist.push(t <= heuteTag ? kumuliert : null); // ab morgen keine Ist-Linie
    soll.push(verfuegbar * (t / tageImMonat));
  }
  return { ist: ist, soll: soll, tageImMonat: tageImMonat, heuteTag: heuteTag, verfuegbar: verfuegbar };
};

/* Ausgaben nach Kategorie fuer einen Monat (fuer das Tortendiagramm).
   Raus: Array [{ kategorie, name, color, betrag }] sortiert, groesste zuerst. */
SK.budget.byCategory = function (state, d) {
  const summen = {};
  for (const e of SK.budget.monthEntries(state, d)) {
    if (e.typ === 'sparen') continue;
    summen[e.kategorie] = (summen[e.kategorie] || 0) + e.betrag;
  }
  const out = [];
  for (const cat of state.categories) {
    if (summen[cat.id]) out.push({ kategorie: cat.id, name: cat.name, color: cat.color, betrag: summen[cat.id] });
  }
  // Ausgaben in geloeschten Kategorien trotzdem zeigen (als "Sonstiges")
  for (const id in summen) {
    if (!state.categories.some(function (c) { return c.id === id; })) {
      out.push({ kategorie: id, name: id, color: '#94a3b8', betrag: summen[id] });
    }
  }
  out.sort(function (a, b) { return b.betrag - a.betrag; });
  return out;
};

/* Durchschnittliche Ausgabe pro Tag (im laufenden Monat, bis heute). */
SK.budget.avgPerDay = function (state, d) {
  const tag = d.getDate();
  return tag > 0 ? SK.budget.spendMonth(state, d) / tag : 0;
};

/* =====================================================================
   TEIL 9: Schulden / Sonderausgaben
   =====================================================================
   Eigener Topf, getrennt vom Tagesbudget. Hier nur die reinen Rechnungen
   rund um die Schulden-Posten.
   --------------------------------------------------------------------- */

/* Monatliche Schulden-Rate, die vorab reserviert wird (0 wenn ausgeschaltet). */
SK.budget.schuldenRate = function (state) {
  return state.settings.schuldenRateAktiv ? (state.settings.schuldenRate || 0) : 0;
};

/* Bereits bezahlt auf EINEN Posten = Summe seiner Teilzahlungen. */
SK.budget.debtPaid = function (debt) {
  return (debt.zahlungen || []).reduce(function (s, z) { return s + z.betrag; }, 0);
};

/* Noch offener Betrag eines Postens (nie negativ). */
SK.budget.debtOpen = function (debt) {
  return Math.max(0, debt.gesamt - SK.budget.debtPaid(debt));
};

/* Summe aller noch OFFENEN Schulden (nur nicht-erledigte Posten). */
SK.budget.debtsTotalOpen = function (state) {
  let summe = 0;
  for (const d of state.debts) { if (!d.erledigt) summe += SK.budget.debtOpen(d); }
  return summe;
};

/* Wie viel wurde in einem Monat insgesamt auf Schulden abbezahlt?
   (ueber alle Posten, auch bereits erledigte). */
SK.budget.debtsPaidThisMonth = function (state, d) {
  const mk = SK.budget.monthKey(d);
  let summe = 0;
  for (const posten of state.debts) {
    for (const z of (posten.zahlungen || [])) {
      if (z.datum.slice(0, 7) === mk) summe += z.betrag;
    }
  }
  return summe;
};
