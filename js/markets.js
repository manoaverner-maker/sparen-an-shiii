/* =====================================================================
   markets.js  ·  Live-Krypto-Kurse (Maerkte-Tab)
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Sie holt LIVE-Kurse von CoinGecko (kostenlos, ohne API-Schluessel) und
   zeigt sie im "Maerkte"-Tab an: Preis, 24h/7d/30d-Veraenderung, Marktwert,
   Allzeithoch und eine kleine 7-Tage-Kurslinie (Sparkline).

   WARUM CoinGecko? Die kostenlose API ist direkt aus dem Browser abrufbar
   (CORS erlaubt) und braucht keinen Schluessel. Echte AKTIEN-Kurse gibt es
   leider nicht gratis/ohne Schluessel direkt im Browser – darum Fokus Krypto
   (Ethereum zuerst, dein Favorit).

   OFFLINE/ROBUST: Jeder erfolgreiche Abruf wird zwischengespeichert
   (state.cryptoCache). Bei Funkloch oder API-Limit (429) zeigen wir die
   zuletzt gespeicherten Werte mit "Stand: …" an.

   HINWEIS: Kurse sind reine Information – KEINE Anlageempfehlung.
   ===================================================================== */

SK.markets = {};
SK.markets.BASE = 'https://api.coingecko.com/api/v3/coins/markets';

/* Holt aktuelle Kurse fuer alle Coins der Watchlist in EINEM Aufruf.
   Rein: nichts (liest state.watchlist + settings.cryptoWaehrung).
   Raus: Promise mit dem Daten-Array. Bei Fehler wird der Fehler geworfen,
         die Anzeige faellt dann auf den Cache zurueck. */
SK.markets.load = async function () {
  const cur = (SK.state.settings.cryptoWaehrung || 'chf').toLowerCase();
  const ids = (SK.state.watchlist || []).join(',');
  if (!ids) return [];
  // Einfache GET-Anfrage ohne Spezial-Header -> kein CORS-Vorabcheck noetig.
  const url = SK.markets.BASE
    + '?vs_currency=' + encodeURIComponent(cur)
    + '&ids=' + encodeURIComponent(ids)
    + '&order=market_cap_desc&sparkline=true'
    + '&price_change_percentage=24h,7d,30d&precision=2';

  // Abbruch nach 8 Sekunden, damit die App bei langsamer Verbindung nicht haengt.
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('CoinGecko HTTP ' + res.status);
    const data = await res.json();
    // erfolgreich -> zwischenspeichern fuer Offline-Anzeige
    SK.state.cryptoCache = { ts: Date.now(), cur: cur, data: data };
    SK.storage.save();
    return data;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
};

/* Gibt den zuletzt gespeicherten Cache zurueck (oder null). */
SK.markets.cached = function () {
  const c = SK.state.cryptoCache;
  return (c && c.data && c.data.length) ? c : null;
};
