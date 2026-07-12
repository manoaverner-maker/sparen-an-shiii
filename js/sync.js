/* =====================================================================
   sync.js  ·  Abgleich zwischen Laptop und Handy (ueber GitHub)
   =====================================================================
   WOFUER IST DIESE DATEI DA?
   Sie haelt die Daten auf mehreren Geraeten gleich. Der komplette
   App-Zustand wird als EINE Datei (data.json) in einem PRIVATEN
   GitHub-Repository abgelegt, das nur du sehen kannst.

   SO FUNKTIONIERT DER ABGLEICH:
     - Beim Oeffnen der App wird der Stand von GitHub geholt (pull).
       Ist er NEUER als der lokale (meta.updatedAt), wird er uebernommen.
       Ist der lokale neuer, wird er hochgeladen (push).
     - Nach jeder Aenderung laedt die App den neuen Stand mit ein paar
       Sekunden Verzoegerung hoch (schedulePush).
     - "Neuer" entscheidet der Zeitstempel meta.updatedAt, den app.js bei
       jeder echten Aenderung setzt. Darum: Geraete NACHEINANDER benutzen.

   EINRICHTUNG (einmal pro Geraet, siehe Info-Knoepfe in der App):
     1. Privates Repo (Standard: money-manager-data) muss auf GitHub existieren.
     2. Fine-grained Token mit Lese/Schreib-Zugriff NUR auf dieses Repo.
     3. Token + Repo-Name in den Einstellungen eintragen -> Verbinden.

   Offline? Kein Problem: die App laeuft normal weiter, der Abgleich
   passiert beim naechsten Oeffnen mit Internet.
   ===================================================================== */

SK.sync = {};
SK.sync._sha = null;        // Versions-Kennung der Datei auf GitHub (fuer Updates noetig)
SK.sync._pushTimer = null;  // laufender Verzoegerungs-Timer fuer schedulePush
SK.sync._busy = false;      // laeuft gerade ein Abgleich?
SK.sync.LAST_KEY = 'sparkurs_sync_last'; // wann zuletzt erfolgreich synchronisiert (nur dieses Geraet)

/* Ist der Sync fertig eingerichtet und eingeschaltet? */
SK.sync.active = function () {
  const st = SK.state.settings;
  return !!(st.syncAktiv && st.syncToken && st.syncRepo && st.syncOwner);
};

/* Ein Aufruf an die GitHub-API. Gibt bei 404 null zurueck (Datei/Repo fehlt). */
SK.sync.api = async function (path, opts) {
  opts = opts || {};
  const res = await fetch('https://api.github.com' + path, {
    method: opts.method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + (opts.token || SK.state.settings.syncToken),
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token ungültig oder abgelaufen');
    if (res.status === 403) throw new Error('Token hat keinen Zugriff auf das Repo');
    throw new Error('GitHub-Fehler ' + res.status);
  }
  if (res.status === 204) return {};
  return res.json();
};

/* Text <-> Base64 (GitHub speichert Datei-Inhalte Base64-kodiert).
   Der Umweg ueber encodeURIComponent macht Umlaute/Emojis sicher. */
SK.sync._enc = function (str) { return btoa(unescape(encodeURIComponent(str))); };
SK.sync._dec = function (b64) { return decodeURIComponent(escape(atob(String(b64).replace(/\n/g, '')))); };

SK.sync._filePath = function () {
  const st = SK.state.settings;
  return '/repos/' + st.syncOwner + '/' + st.syncRepo + '/contents/data.json';
};

/* ---------------------------------------------------------------------
   verbinden: Token pruefen, Benutzer ermitteln, Repo pruefen, erster Abgleich.
   Wird vom "Verbinden"-Knopf in den Einstellungen aufgerufen.
   --------------------------------------------------------------------- */
SK.sync.connect = async function () {
  const token = (document.getElementById('sy-token').value || '').trim();
  const repo = (document.getElementById('sy-repo').value || 'money-manager-data').trim();
  if (!token) { SK.ui.toast('Bitte zuerst das GitHub-Token einfügen', true); return; }
  SK.sync.setStatus('Verbinde …');
  try {
    const user = await SK.sync.api('/user', { token: token });
    if (!user || !user.login) throw new Error('Token ungültig');
    const repoInfo = await SK.sync.api('/repos/' + user.login + '/' + repo, { token: token });
    if (!repoInfo) throw new Error('Repo "' + repo + '" nicht gefunden – existiert es und darf das Token darauf zugreifen?');

    SK.state.settings.syncToken = token;
    SK.state.settings.syncRepo = repo;
    SK.state.settings.syncOwner = user.login;
    SK.state.settings.syncAktiv = true;
    SK.storage.save();

    await SK.sync.pull();          // neuesten Stand holen bzw. ersten hochladen
    SK.ui.render();
    SK.ui.toast('Sync verbunden als ' + user.login);
  } catch (e) {
    SK.sync.setStatus('Fehler: ' + e.message, true);
    SK.ui.toast(e.message, true);
  }
};

/* ---------------------------------------------------------------------
   pull: Stand von GitHub holen und mit dem lokalen vergleichen.
     - Datei fehlt noch      -> lokalen Stand hochladen (erster Sync)
     - GitHub-Stand ist neuer -> uebernehmen
     - lokaler ist neuer      -> hochladen
   --------------------------------------------------------------------- */
SK.sync.pull = async function () {
  if (!SK.sync.active() || SK.sync._busy) return;
  SK.sync._busy = true;
  try {
    const file = await SK.sync.api(SK.sync._filePath());
    if (!file) {                                   // noch keine Daten auf GitHub
      SK.sync._sha = null;
      await SK.sync._put();
    } else {
      SK.sync._sha = file.sha;
      const remote = JSON.parse(SK.sync._dec(file.content));
      const remoteU = (remote.meta && remote.meta.updatedAt) || 0;
      const localU = (SK.state.meta && SK.state.meta.updatedAt) || 0;
      if (remoteU > localU) {
        // Der Stand vom anderen Geraet ist neuer -> uebernehmen.
        // Token/Einrichtung dieses Geraets behalten (falls sie abweichen).
        const keep = {
          syncToken: SK.state.settings.syncToken,
          syncRepo: SK.state.settings.syncRepo,
          syncOwner: SK.state.settings.syncOwner,
          syncAktiv: true
        };
        SK.storage.importFromText(JSON.stringify(remote));
        Object.assign(SK.state.settings, keep);
        SK.storage.save();
        SK.ui.render();
      } else if (localU > remoteU) {
        await SK.sync._put();
      }
    }
    SK.sync._markSynced();
  } catch (e) {
    SK.sync.setStatus(navigator.onLine === false ? 'Offline – Abgleich folgt später' : 'Fehler: ' + e.message, true);
  } finally {
    SK.sync._busy = false;
  }
};

/* Datei auf GitHub schreiben (anlegen oder aktualisieren). */
SK.sync._put = async function () {
  const body = {
    message: 'Money Manager Sync',
    content: SK.sync._enc(JSON.stringify(SK.state))
  };
  if (SK.sync._sha) body.sha = SK.sync._sha;
  try {
    const res = await SK.sync.api(SK.sync._filePath(), { method: 'PUT', body: body });
    if (res && res.content) SK.sync._sha = res.content.sha;
  } catch (e) {
    // Versions-Konflikt (jemand anders hat inzwischen geschrieben):
    // frische Versions-Kennung holen und genau EINMAL erneut versuchen.
    const file = await SK.sync.api(SK.sync._filePath());
    SK.sync._sha = file ? file.sha : null;
    body.sha = SK.sync._sha || undefined;
    const res2 = await SK.sync.api(SK.sync._filePath(), { method: 'PUT', body: body });
    if (res2 && res2.content) SK.sync._sha = res2.content.sha;
  }
};

/* push: lokalen Stand hochladen (nach Aenderungen). */
SK.sync.push = async function () {
  if (!SK.sync.active() || SK.sync._busy) return;
  SK.sync._busy = true;
  try {
    await SK.sync._put();
    SK.sync._markSynced();
  } catch (e) {
    SK.sync.setStatus(navigator.onLine === false ? 'Offline – Abgleich folgt später' : 'Fehler: ' + e.message, true);
  } finally {
    SK.sync._busy = false;
  }
};

/* Nach jeder Aenderung aufgerufen (app.js -> refresh). Wartet ein paar
   Sekunden, damit mehrere schnelle Aenderungen EIN Upload werden. */
SK.sync.schedulePush = function () {
  if (!SK.sync.active()) return;
  clearTimeout(SK.sync._pushTimer);
  SK.sync._pushTimer = setTimeout(function () { SK.sync.push(); }, 4000);
};

/* Beim App-Start: neuesten Stand holen (laeuft im Hintergrund). */
SK.sync.init = function () {
  if (SK.sync.active()) SK.sync.pull();
};

/* ---------------------------------------------------------------------
   Anzeige in den Einstellungen
   --------------------------------------------------------------------- */
SK.sync._markSynced = function () {
  try { localStorage.setItem(SK.sync.LAST_KEY, String(Date.now())); } catch (e) { /* egal */ }
  SK.sync.renderSettings();
};

SK.sync.setStatus = function (text, isError) {
  const el = document.getElementById('sy-status');
  const row = document.getElementById('sy-status-row');
  if (!el) return;
  row.classList.remove('hidden');
  el.textContent = text;
  el.style.color = isError ? 'var(--bad)' : '';
};

SK.sync.renderSettings = function () {
  const st = SK.state.settings;
  const connected = !!(st.syncToken && st.syncOwner);
  document.getElementById('sy-switch').checked = !!st.syncAktiv;
  document.getElementById('sy-setup').classList.toggle('hidden', !(st.syncAktiv && !connected));
  document.getElementById('sy-status-row').classList.toggle('hidden', !(st.syncAktiv && connected));
  document.getElementById('sy-now').classList.toggle('hidden', !(st.syncAktiv && connected));
  const repoInput = document.getElementById('sy-repo');
  if (repoInput && !repoInput.value) repoInput.value = st.syncRepo || 'money-manager-data';
  if (st.syncAktiv && connected) {
    const last = parseInt(localStorage.getItem(SK.sync.LAST_KEY) || '0', 10);
    const el = document.getElementById('sy-status');
    el.style.color = '';
    el.textContent = last ? ('● Aktiv · ' + SK.ui.timeAgo(last)) : '● Aktiv';
  }
};

/* Klick-/Schalter-Verbindungen (einmal beim Start aus app.js aufgerufen). */
SK.sync.bind = function () {
  document.getElementById('sy-switch').addEventListener('change', function (e) {
    SK.state.settings.syncAktiv = e.target.checked;
    SK.storage.save();
    SK.sync.renderSettings();
    if (e.target.checked && SK.sync.active()) SK.sync.pull();
  });
  document.getElementById('sy-connect').addEventListener('click', SK.sync.connect);
  document.getElementById('sy-now').addEventListener('click', function () {
    SK.sync.setStatus('Synchronisiere …');
    SK.sync.pull();
  });
  // Sobald wieder Internet da ist: ausstehende Aenderungen hochladen
  window.addEventListener('online', function () { SK.sync.schedulePush(); });
};
