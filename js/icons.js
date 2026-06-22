/* =====================================================================
   icons.js  ·  Sauberes Icon-Set (Inline-SVG, kein Emoji)
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Statt der bunten Standard-Emojis benutzt die App ein einheitliches Set
   aus schlanken Linien-Icons (im Stil moderner App-Icons). Sie sind als
   SVG direkt hier eingebettet:
     - bleiben offline verfuegbar (kein Nachladen aus dem Internet)
     - uebernehmen automatisch die Textfarbe (stroke="currentColor"),
       passen sich also Akzent-/Kategoriefarben an
     - sind auf jedem Bildschirm gestochen scharf

   BENUTZUNG:  SK.icon('home')  ->  fertiges <svg>…</svg> als Text
   Eine neue Form hinzufuegen: einen Eintrag in SK.ICONS ergaenzen
   (nur der Inhalt zwischen <svg> und </svg>, viewBox ist 0 0 24 24).
   ===================================================================== */

const SK_icons = window.SK;

/* Die reinen Pfad-Inhalte je Icon (viewBox 0 0 24 24). */
SK.ICONS = {
  /* --- Navigation --- */
  home:     '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/><path d="M9.5 21v-6h5v6"/>',
  list:     '<path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><circle cx="4" cy="6" r="1.1"/><circle cx="4" cy="12" r="1.1"/><circle cx="4" cy="18" r="1.1"/>',
  target:   '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.7" fill="currentColor" stroke="none"/>',
  repeat:   '<path d="M17 2.5l3 3-3 3"/><path d="M4 11.5V10a4 4 0 0 1 4-4h12"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 12.5V14a4 4 0 0 1-4 4H4"/>',
  chart:    '<path d="M3.5 21h17"/><rect x="6" y="11" width="3.2" height="7" rx="1"/><rect x="11.4" y="6.5" width="3.2" height="11.5" rx="1"/><rect x="16.8" y="14" width="3.2" height="4" rx="1"/>',
  settings: '<path d="M4 6.5h9"/><path d="M17 6.5h3"/><circle cx="15" cy="6.5" r="2"/><path d="M4 12.5h3"/><path d="M11 12.5h9"/><circle cx="9" cy="12.5" r="2"/><path d="M4 18.5h9"/><path d="M17 18.5h3"/><circle cx="15" cy="18.5" r="2"/>',

  /* --- Aktionen / Status --- */
  plus:     '<path d="M12 5v14"/><path d="M5 12h14"/>',
  tick:     '<path d="M5 12.5l4.2 4.2L19 7"/>',
  bell:     '<path d="M18 8.5a6 6 0 0 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5"/><path d="M13.7 20.5a2 2 0 0 1-3.4 0"/>',
  check:    '<circle cx="12" cy="12" r="9"/><path d="M8.3 12.3l2.6 2.6 4.8-5.3"/>',
  clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 1.9"/>',
  alert:    '<path d="M10.3 4.4 2.6 17.8A1.5 1.5 0 0 0 3.9 20h16.2a1.5 1.5 0 0 0 1.3-2.2L13.7 4.4a1.6 1.6 0 0 0-3.4 0Z"/><path d="M12 9.5v4"/><path d="M12 16.6h.01"/>',
  coins:    '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v3c0 1.7 3.1 3 7 3s7-1.3 7-3v-3"/>',
  pencil:   '<path d="M16.4 4.6a1.9 1.9 0 0 1 2.7 2.7L8.5 17.9 4 19.4l1.5-4.5Z"/><path d="M14.5 6.5l2.7 2.7"/>',
  trash:    '<path d="M4 7h16"/><path d="M9 7V4.8h6V7"/><path d="M6.2 7l1 12.5a1 1 0 0 0 1 .9h7.6a1 1 0 0 0 1-.9L18 7"/><path d="M10.5 11v5.5M13.5 11v5.5"/>',
  filter:   '<path d="M4 5.5h16"/><path d="M7 12h10"/><path d="M10 18.5h4"/>',
  wallet:   '<path d="M3.5 7.5a2 2 0 0 1 2-2H17a1.5 1.5 0 0 1 1.5 1.5v1"/><path d="M3.5 7.5V17a2 2 0 0 0 2 2H19a1.5 1.5 0 0 0 1.5-1.5V11A1.5 1.5 0 0 0 19 9.5H5.5a2 2 0 0 1-2-2Z"/><circle cx="16" cy="14.2" r="1.1" fill="currentColor" stroke="none"/>',
  flame:    '<path d="M12 3s5 3.4 5 9a5 5 0 0 1-10 0c0-2 1-3.3 2-4.3 0 1.4 1 2.2 1.8 2.2C9.6 8.2 12 6.6 12 3Z"/>',
  receipt:  '<path d="M6 3.5h12v17l-2.4-1.3-2.4 1.3-2.4-1.3-2.4 1.3L6 19.2Z"/><path d="M9 8h6"/><path d="M9 11.5h6"/><path d="M9 15h4"/>',
  chevron:  '<path d="M6 9.5l6 6 6-6"/>',
  download: '<path d="M12 4v10.5"/><path d="M8 11l4 4 4-4"/><path d="M5 19.5h14"/>',
  upload:   '<path d="M12 20V9.5"/><path d="M8 13l4-4 4 4"/><path d="M5 4.5h14"/>',
  coin:     '<circle cx="12" cy="12" r="8.4"/><path d="M9.6 8.7h3.6a1.9 1.9 0 0 1 0 3.8H10"/><path d="M10 8.7V16"/><path d="M9.6 12.5h3.8"/>',
  ai:       '<path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4Z"/><path d="M18 14l.8 2.1 2.2.7-2.2.8L18 20l-.8-2.1-2.2-.8 2.2-.7Z"/>',
  star:     '<path d="M12 3.4l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.5 1-5.8L2.6 9.5l5.8-.8Z"/>',
  grid:     '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  refresh:  '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 3.5V9h-5.5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 20.5V15h5.5"/>',
  arrowUp:  '<path d="M12 19V6"/><path d="M6.5 11.5L12 6l5.5 5.5"/>',
  arrowDown:'<path d="M12 5v13"/><path d="M6.5 12.5L12 18l5.5-5.5"/>',
  lightbulb:'<path d="M9.2 17.5h5.6"/><path d="M10 20.5h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.9 1 .9 1.7H14.7c0-.7.4-1.3.9-1.7A6 6 0 0 0 12 3Z"/>',
  ticket:   '<path d="M4 8a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2.2a1.8 1.8 0 0 0 0 3.6V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2.2a1.8 1.8 0 0 0 0-3.6Z"/><path d="M13 7.5v9"/>',
  key:      '<circle cx="8" cy="15" r="3.8"/><path d="M10.7 12.3L19 4"/><path d="M16 4h3v3"/><path d="M14.2 5.8l2.4 2.4"/>',
  chevronR: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',

  /* --- Ferienmodus & Schnell-Links --- */
  sun:      '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7"/>',
  plane:    '<path d="M21.5 3.4 2.9 11.1a.6.6 0 0 0 0 1.1l6.6 2.4 2.4 6.6a.6.6 0 0 0 1.1 0Z"/><path d="M21.5 3.4 9.5 14.6"/>',
  pin:      '<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  translate:'<path d="M3.5 6h9"/><path d="M8 4v2"/><path d="M10.8 6c-.5 3.6-3 6.9-6.6 8.4"/><path d="M5.6 10.4c1.5 1.9 3.4 3.3 5.7 4.1"/><path d="M13.2 20l3.8-9 3.8 9"/><path d="M14.7 16.4h4.6"/>',
  camera:   '<path d="M4 8.6h2.6L8 6h8l1.4 2.6H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.6a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/>',
  bed:      '<path d="M2.5 18.5v-9"/><path d="M2.5 13h15a4 4 0 0 1 4 4v1.5"/><path d="M21.5 18.5h-19"/><circle cx="6.6" cy="10.6" r="1.6"/><path d="M9 13v-1.2a1.3 1.3 0 0 1 1.3-1.3H17a1.3 1.3 0 0 1 1.3 1.3V13"/>',
  car:      '<path d="M4 13l1.7-4.4A2 2 0 0 1 7.6 7.4h8.8a2 2 0 0 1 1.9 1.2L20 13"/><path d="M3.6 13h16.8a1 1 0 0 1 1 1v3.4h-18.8V14a1 1 0 0 1 1-1Z"/><circle cx="7.6" cy="17.4" r="1.5"/><circle cx="16.4" cy="17.4" r="1.5"/>',
  cash:     '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.4h.02M18 14.6h.02"/>',
  landmark: '<path d="M4 9.6l8-5 8 5"/><path d="M4.4 10.6h15.2"/><path d="M6.5 10.6V18M10 10.6V18M14 10.6V18M17.5 10.6V18"/><path d="M3.5 18.5h17"/>',

  /* --- Ausgaben-Kategorien --- */
  food:     '<path d="M6 3v6.5a2 2 0 0 0 4 0V3"/><path d="M8 9.5V21"/><path d="M16.5 3c-1.6 0-2.6 1.7-2.6 4.2s1 4.3 2.6 4.3"/><path d="M16.5 3v18"/>',
  box:      '<path d="M12 3 4 7v10l8 4 8-4V7Z"/><path d="M4 7l8 4 8-4"/><path d="M12 11v10"/>',
  glass:    '<path d="M4.5 5h15l-7.5 8z"/><path d="M12 13v6"/><path d="M8.5 19h7"/>',
  tram:     '<rect x="6" y="3" width="12" height="13.5" rx="3"/><path d="M6 11h12"/><circle cx="9.5" cy="13.6" r="0.8" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13.6" r="0.8" fill="currentColor" stroke="none"/><path d="M9 16.5l-1.8 2.2M15 16.5l1.8 2.2"/>',
  tag:      '<path d="M3.6 12.6 11 5.2h6.4v6.4L10 19a2 2 0 0 1-2.8 0L3.6 15.4a2 2 0 0 1 0-2.8Z"/><circle cx="14.4" cy="8.6" r="1.2"/>'
};

/* Baut aus einem Namen ein fertiges <svg>. cls = optionale CSS-Klasse(n). */
SK.icon = function (name, cls) {
  const inhalt = SK.ICONS[name] || SK.ICONS.tag;
  return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
       + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inhalt + '</svg>';
};
