/* =====================================================================
   charts.js  ·  Selbst gezeichnete Diagramme (SVG)
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Sie zeichnet die Diagramme im Statistik-Tab als SVG. Wir benutzen
   bewusst KEINE externe Chart-Bibliothek:
     - die App bleibt komplett offline und ohne fremde Dateien
     - die Diagramme passen exakt zu unserem Dark-Theme
     - SVG ist gestochen scharf auf jedem Bildschirm

   Es gibt zwei Diagramme:
     - lineChart : Monatsverlauf (Soll-Linie gegen tatsaechliche Ausgaben)
     - donut     : Ausgaben nach Kategorie (Ring-/Tortendiagramm)

   ZUSAMMENHANG:
     budget.js  liefert die Zahlen (monthSeries, byCategory)
     ui.js      ruft diese Zeichenfunktionen mit einem Ziel-Element auf
   ===================================================================== */

SK.charts = {};

/* Liest eine CSS-Variable aus (damit die Diagramme dieselben Farben wie
   der Rest der App benutzen). Rein: Name z.B. '--accent'. Raus: Farbwert. */
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/* Hilfsfunktion: rundet eine Zahl huebsch fuer Achsenbeschriftungen. */
function niceCeil(n) {
  if (n <= 0) return 100;
  const pot = Math.pow(10, Math.floor(Math.log10(n)));
  const stufen = [1, 2, 2.5, 5, 10];
  for (const s of stufen) { if (n <= s * pot) return s * pot; }
  return 10 * pot;
}

/* ---------------------------------------------------------------------
   lineChart(el, serie)
   Zeichnet den Monatsverlauf: gestrichelte Soll-Linie + gefuellte Ist-Linie.
   Rein:
     el    = das HTML-Element, in das gezeichnet wird
     serie = Ergebnis von SK.budget.monthSeries (ist, soll, tageImMonat, heuteTag)
   --------------------------------------------------------------------- */
SK.charts.lineChart = function (el, serie) {
  const W = 340, H = 190;            // Zeichenflaeche (viewBox)
  const padL = 38, padR = 12, padT = 14, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const accent = cssVar('--accent', '#19e3a6');
  const gold = cssVar('--gold', '#f4c14b');
  const grid = 'rgba(255,255,255,0.07)';
  const dim = cssVar('--text-dim', '#8b98a9');

  const n = serie.tageImMonat;
  // groesster Wert auf der y-Achse (Soll-Endwert oder hoechster Ist-Wert)
  let maxVal = serie.soll[n - 1] || 0;
  for (const v of serie.ist) if (v != null && v > maxVal) maxVal = v;
  maxVal = niceCeil(maxVal);

  // Umrechnung Tag/Betrag -> Pixelkoordinaten
  const x = function (tag) { return padL + (innerW * (tag - 1)) / Math.max(1, n - 1); };
  const y = function (val) { return padT + innerH - (innerH * val) / maxVal; };

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" class="chart-svg" role="img" aria-label="Monatsverlauf">';
  svg += '<defs><linearGradient id="istfill" x1="0" y1="0" x2="0" y2="1">'
       + '<stop offset="0" stop-color="' + accent + '" stop-opacity="0.35"/>'
       + '<stop offset="1" stop-color="' + accent + '" stop-opacity="0"/></linearGradient></defs>';

  // waagrechte Gitterlinien + y-Beschriftung (0, 1/2, ganz)
  for (let i = 0; i <= 2; i++) {
    const val = (maxVal / 2) * i;
    const yy = y(val);
    svg += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="' + grid + '" stroke-width="1"/>';
    svg += '<text x="' + (padL - 6) + '" y="' + (yy + 3) + '" text-anchor="end" font-size="9" fill="' + dim + '">' + Math.round(val) + '</text>';
  }

  // Soll-Linie (gestrichelt, gold)
  let sollPts = '';
  for (let t = 1; t <= n; t++) sollPts += x(t) + ',' + y(serie.soll[t - 1]) + ' ';
  svg += '<polyline points="' + sollPts.trim() + '" fill="none" stroke="' + gold + '" stroke-width="1.6" stroke-dasharray="4 4" opacity="0.8"/>';

  // Ist-Flaeche + Ist-Linie (nur bis heute)
  let istLine = '';
  let lastTag = 0, lastVal = 0;
  for (let t = 1; t <= n; t++) {
    const v = serie.ist[t - 1];
    if (v == null) break;
    istLine += x(t) + ',' + y(v) + ' ';
    lastTag = t; lastVal = v;
  }
  if (istLine) {
    // Flaeche unter der Ist-Linie
    const area = istLine.trim() + ' ' + x(lastTag) + ',' + y(0) + ' ' + x(1) + ',' + y(0);
    svg += '<polygon points="' + area + '" fill="url(#istfill)"/>';
    svg += '<polyline points="' + istLine.trim() + '" fill="none" stroke="' + accent + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
    // Punkt fuer heute
    svg += '<circle cx="' + x(lastTag) + '" cy="' + y(lastVal) + '" r="3.5" fill="' + accent + '" stroke="#0c151d" stroke-width="1.5"/>';
  }

  // x-Beschriftung: Tag 1, Mitte, letzter Tag
  const ticks = [1, Math.round(n / 2), n];
  for (const t of ticks) {
    svg += '<text x="' + x(t) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="' + dim + '">' + t + '.</text>';
  }

  svg += '</svg>';
  el.innerHTML = svg;
};

/* ---------------------------------------------------------------------
   donut(el, data)
   Zeichnet ein Ringdiagramm der Ausgaben nach Kategorie.
   Rein:
     el   = Ziel-Element
     data = Array [{ name, color, betrag }] (z.B. von SK.budget.byCategory)
   In der Mitte steht die Gesamtsumme.
   --------------------------------------------------------------------- */
SK.charts.donut = function (el, data) {
  const total = data.reduce(function (s, d) { return s + d.betrag; }, 0);
  const size = 160, cx = size / 2, cy = size / 2;
  const r = 60, stroke = 22;
  const umfang = 2 * Math.PI * r;

  let svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" class="chart-svg donut" role="img" aria-label="Ausgaben nach Kategorie">';

  if (total <= 0) {
    // Noch keine Ausgaben: nur ein leerer Ring
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="' + stroke + '"/>';
    svg += '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="12" fill="' + cssVar('--text-dim', '#8b98a9') + '">noch leer</text>';
    svg += '</svg>';
    el.innerHTML = svg;
    return;
  }

  // Hintergrund-Ring
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="' + stroke + '"/>';
  // Segmente: jedes als Teil-Kreis mit stroke-dasharray, gedreht starten oben (-90 Grad)
  let offset = 0; // bereits gezeichneter Anteil (0..1)
  for (const d of data) {
    const anteil = d.betrag / total;
    const len = anteil * umfang;
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + d.color + '" stroke-width="' + stroke + '"'
         + ' stroke-dasharray="' + len + ' ' + (umfang - len) + '"'
         + ' stroke-dashoffset="' + (-offset * umfang) + '"'
         + ' transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="butt"/>';
    offset += anteil;
  }
  // Mitte: Gesamtsumme
  svg += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="20" font-weight="700" fill="' + cssVar('--text', '#e6edf3') + '">' + Math.round(total) + '</text>';
  svg += '<text x="' + cx + '" y="' + (cy + 15) + '" text-anchor="middle" font-size="10" fill="' + cssVar('--text-dim', '#8b98a9') + '">CHF Monat</text>';
  svg += '</svg>';
  el.innerHTML = svg;
};
