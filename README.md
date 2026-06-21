# Sparen an Shiii 🛡️📈

**Deine persönliche Budget-App.** Sie beantwortet jeden Tag die eine wichtige Frage:

> **Wie viel kann ich heute noch ausgeben, ohne mein Sparziel und meine Fixkosten zu gefährden?**

Die App läuft komplett **offline** auf deinem Gerät, speichert alles **lokal** (keine Cloud, keine Konten) und lässt sich als **App auf den iPhone- oder Desktop-Homescreen** legen.

---

## Inhalt
- [Was die App kann](#was-die-app-kann)
- [Schnellstart](#schnellstart)
- [Aufs iPhone legen](#aufs-iphone-legen)
- [Aufbau der Dateien](#aufbau-der-dateien)
- [Werte ändern](#werte-ändern)
- [Wie das Tagesbudget berechnet wird](#wie-das-tagesbudget-berechnet-wird)
- [Neue Funktionen hinzufügen](#neue-funktionen-hinzufügen)
- [Backup](#backup)

---

## Was die App kann

| Bereich | Was es macht |
|--------|--------------|
| **Heute** | Grosse Zahl „Heute noch verfügbar" mit Ampelfarbe (grün/gelb/rot), Tempo-Warnung, Hauptsparziel, letzte Ausgaben. |
| **Erfassen** (＋) | Ausgabe in Sekunden eintragen: Betrag, Kategorie, optionale Notiz. |
| **Verlauf** | Alle Buchungen, nach Tag gruppiert, filterbar, einzeln bearbeit- und löschbar. |
| **Ziele** | Sparziele in zwei Arten: *Ziel mit Datum* (z.B. Kroatien) und *fester Monats-Topf* (z.B. Motorrad 250/Monat, Sparkonto 250/Monat). Fortschritt, benötigte Rate, Einzahlen-Knopf. |
| **Abos** | Abo-Radar mit Gesamtsumme, Erinnerung 3 Tage vor Verlängerung, aktiv/gekündigt-Schalter. |
| **Schulden & Bussen** | Einmalige Schulden/Sonderausgaben **und Bussen** als eigener Topf: Posten mit Teilzahlungen, Fortschritt, Fälligkeit, Archiv – getrennt vom Tagesbudget. |
| **Märkte** | Live-Krypto-Kurse (Ethereum zuerst, dazu BTC/SOL) von CoinGecko: Preis, 24h/7d/30d, Marktwert, Allzeithoch, 7-Tage-Sparkline. Offline werden die letzten Werte gezeigt. *Keine Anlageberatung.* |
| **KI-Coach** | **Smart-Analyse** (läuft offline auf dem Gerät, ohne Schlüssel) + optional echte Analysen von Claude (eigener Anthropic-API-Schlüssel). |
| **Geld-Ideen** | Bewährte, recherchierte Wege zum Geldverdienen/-sparen (Schweiz) + optional eine täglich frische Idee von Claude. |
| **Listen** | Eigene Listen/Wunschliste mit Preisen und Abhaken – rein informativ. |
| **Statistik** | Monatsverlauf (Soll gegen Ist), Tortendiagramm nach Kategorie, Streak, Ø pro Tag/Woche, Hochrechnung, Vormonatsvergleich, Schulden-Übersicht. |
| **Einstellungen** | Lohn, Fixkosten, Schulden-Rate, KI-Coach, Märkte-Währung, Kategorien, Backup-Export/Import, Zurücksetzen. |

**Navigation:** Unten (Handy) gibt es 5 Tabs – Heute, Verlauf, Statistik, Märkte und **Mehr**. Hinter „Mehr" liegen Ziele, Abos, Schulden, Listen, KI-Coach, Geld-Ideen und Einstellungen. Am Desktop ist alles direkt in der Seitenleiste.

---

## Schnellstart

Die App braucht für die **Offline-/Installations-Funktion** einen kleinen Webserver
(der „Service Worker" funktioniert **nicht**, wenn du `index.html` nur per Doppelklick öffnest).

**Variante A – online (am einfachsten):**
Die App liegt auf GitHub Pages und ist sofort nutzbar. Link siehe oben im Repository
unter *„Settings → Pages"* bzw. die `…github.io/sparen-an-shiii/`-Adresse.

**Variante B – lokal testen (Windows, ohne zusätzliche Programme):**
Im Projektordner diese Zeile in *PowerShell* ausführen und dann
`http://localhost:8200/` im Browser öffnen:

```powershell
# einfacher Test-Server im aktuellen Ordner
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

> Zum reinen Anschauen (ohne Offline-Funktion) genügt auch ein Doppelklick auf `index.html`.
> Speichern, Rechnen und Anzeige funktionieren dann trotzdem – nur der Offline-Cache nicht.

---

## Aufs iPhone legen

1. Öffne die **GitHub-Pages-Adresse** der App in **Safari** (nicht Chrome).
2. Tippe unten auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben).
3. Wähle **„Zum Home-Bildschirm"**.
4. Fertig – die App erscheint als Icon und startet im Vollbild, auch offline.

**Android / Desktop:** Im Browser (Chrome/Edge) erscheint in der Adressleiste ein
**Installieren-Symbol** – einmal anklicken.

---

## Aufbau der Dateien

Die App ist bewusst in **kleine, klar getrennte Dateien** aufgeteilt, damit du dich
zurechtfindest. Jede Datei hat oben einen Kommentarblock, der erklärt, wofür sie da ist.

```
sparen-an-shiii/
├── index.html            Das Grundgerüst (alle Bildschirme + PWA-Einstellungen)
├── manifest.json         App-Infos für den Homescreen (Name, Icon, Farben)
├── service-worker.js     Macht die App offline-fähig (Datei-Zwischenspeicher)
├── serve.ps1             Mini-Webserver zum lokalen Testen
├── css/
│   └── styles.css        Das komplette Aussehen (Dark-Theme, Layout, Animationen)
├── js/
│   ├── defaults.js       Startwerte & Stammdaten  ← hier Anfangswerte ändern
│   ├── icons.js          Sauberes Icon-Set (Inline-SVG statt Emoji)
│   ├── storage.js        Speichern/Laden (localStorage) + Backup
│   ├── budget.js         Die Rechen-Logik (Tagesbudget usw.)  ← das Herzstück
│   ├── charts.js         Selbst gezeichnete Diagramme + Sparklines (SVG)
│   ├── markets.js        Live-Krypto-Kurse von CoinGecko (ohne Schlüssel)
│   ├── ai.js             KI-Coach: Smart-Analyse (offline) + optional Claude
│   ├── ui.js             Anzeige: baut alle Bildschirme auf
│   └── app.js            Steuerung: verbindet Klicks, Daten und Anzeige
└── assets/
    ├── logo.svg          App-Emblem (Schild + Wachstum + Münze)
    ├── favicon.svg       Browser-Tab-Symbol
    └── icon-*.png        App-Icons für Homescreen/Installation
```

**So hängt es zusammen:**
`defaults` legt die Startdaten fest → `storage` speichert/lädt sie → `budget` rechnet damit →
`charts` & `ui` zeigen alles an → `app` reagiert auf deine Eingaben und stösst nach jeder
Änderung ein Neu-Zeichnen an.

---

## Werte ändern

Es gibt **zwei** Wege:

**1. In der App (empfohlen, jederzeit):**
Tab **Einstellungen** → Lohn, Fixkosten, Kategorien, Abo-Schalter.
Sparziele im Tab **Ziele**, Abos im Tab **Abos**. Alles wird sofort gespeichert.

**2. Die Anfangswerte im Code** (gelten beim allerersten Start / nach Zurücksetzen):
Datei [`js/defaults.js`](js/defaults.js). Dort sind klar benannt:
- `settings.lohn` (1600), `settings.fixkosten` (580)
- `categories` (die Ausgabenkategorien)
- `goals` (das Sparziel „Kroatien", Betrag 1000, Datum 14.08.2026)
- `abos` (alle Abos mit Betrag und Verlängerungstag)

---

## Wie das Tagesbudget berechnet wird

Die ganze Logik steht ausführlich kommentiert in [`js/budget.js`](js/budget.js)
(Funktion `dayInfo` / `compute`). In Worten:

1. **Fehlender Sparbetrag** = Sparziel − bereits gespart (pro Ziel).
2. **Monatliche Sparrate** = fehlender Betrag ÷ Monate bis zum Zieldatum (Summe aller Ziele).
3. **Verfügbar diesen Monat** = Lohn − Fixkosten − Sparrate − (optionale Schulden-Rate).
4. **Bereits ausgegeben** = Summe der Buchungen dieses Monats vor heute.
5. **Noch verfügbar (Tagesbeginn)** = (3) − (4).
6. **Tagesbudget heute** = (5) ÷ verbleibende Tage im Monat (heute mitgezählt).
7. **Heute noch verfügbar** (die grosse Zahl) = Tagesbudget − was du heute schon ausgegeben hast.

👉 Gibst du heute weniger aus, steigt das Tagesbudget der Resttage. Gibst du mehr aus,
sinkt es sichtbar. Genau dieser Effekt soll dir helfen, bewusster mit Geld umzugehen.

> **Hinweis:** Geld, das du ins Sparziel verschiebst, zählt ebenfalls als „abgeflossen"
> (es ist ja nicht mehr zum Ausgeben da), taucht aber **nicht** in der Ausgaben-Statistik auf.

---

## Schulden / Sonderausgaben

Ein eigener Bereich für **einmalige grössere Verpflichtungen** (z.B. eine
Werkstattrechnung), die dein normales Tagesbudget *nicht* verfälschen sollen.

- **Posten anlegen:** Name, Gesamtbetrag, optional Fälligkeitsdatum und Notiz.
  Optional „in X Raten aufteilen" – die App schlägt dir die monatliche Rate vor.
- **Teilzahlungen** pro Posten erfassen; ein Fortschrittsbalken zeigt
  *bezahlt / offen*. Ist ein Posten voll bezahlt, wandert er automatisch ins
  (einklappbare) **Archiv**; du kannst ihn auch manuell auf „erledigt" setzen.
- Oben siehst du die **Summe aller offenen Schulden**.

**Trennung vom Tagesbudget (wichtig):** Diese Posten und ihre Teilzahlungen
fliessen **nicht** ins Tagesbudget und **nicht** in die Pace-Warnung ein – es ist
ein getrennter Topf. Eine einzelne 550-CHF-Zahlung färbt deinen Tag also nicht rot.

Damit du den Abbau trotzdem realistisch einplanst, gibt es in den **Einstellungen**
den Schalter **„Monatliche Schulden-Rate vom verfügbaren Geld abziehen"**. Ist er
aktiv, wird der eingestellte Betrag – genau wie die Sparrate – *vor* der
Tagesbudget-Berechnung vom verfügbaren Monatsgeld abgezogen.

## Märkte (Krypto-Kurse)

Der **Märkte**-Tab zeigt Live-Kurse von **CoinGecko** – kostenlos und **ohne API-Schlüssel**,
direkt aus dem Browser. Standard-Watchlist: Ethereum (zuerst), Bitcoin, Solana. Pro Coin:
Preis, 24h/7d/30d-Veränderung, Marktwert, Allzeithoch und eine 7-Tage-Kurslinie.

- Die Anzeigewährung (CHF/USD) stellst du in den **Einstellungen → Märkte** ein.
- Jeder erfolgreiche Abruf wird gespeichert; **offline** siehst du die letzten Werte mit „Stand: …".
- **Wichtig:** Kurse sind reine Information, **keine Anlageberatung**. Echte Aktienkurse gibt es
  gratis leider nicht zuverlässig direkt im Browser – darum der Fokus auf Krypto.

## KI-Coach (zwei Stufen)

1. **Smart-Analyse** – läuft **immer, offline, kostenlos** auf deinem Gerät. Einfache Regeln
   werten deine Zahlen aus (Tempo, Hochrechnung, grösste Kategorie, Abo-Anteil, Streak …) und
   geben Hinweise. Siehst du auch direkt auf dem „Heute"-Screen.
2. **Echter KI-Coach (optional)** – holt persönliche Analysen und tägliche Geld-Ideen von
   **Claude (Anthropic)**. Dafür brauchst du einen **eigenen API-Schlüssel** von
   `console.anthropic.com` (mit API-Guthaben).

> **Wichtig zum echten KI-Coach:**
> - Der Schlüssel bleibt **nur auf deinem Gerät** (localStorage) und wird ausschliesslich an
>   Anthropic für deine Anfrage gesendet. **Nie ins Repo schreiben.** (Achtung: ein JSON-Backup
>   enthält den Schlüssel – bewahre Backups sicher auf.)
> - Anthropic-API-Guthaben ist **getrennt** von einem „Claude Max"-Abo.
> - Bei eingeschaltetem Coach wird eine **Zusammenfassung deiner Finanzzahlen** an Anthropic gesendet.
> - Nichts davon ist personalisierte Finanzberatung.

## Geld-Ideen

Recherchierte, bodenständige Wege (Schweiz 2026), um als junger Gebäudetechnikplaner mehr zu
verdienen und Vermögen aufzubauen – von Weiterbildung (Techniker HF) über CAD/BIM-Freelancing
bis Säule 3a, günstige ETF-Sparpläne (DCA) und „Krypto nur klein halten". Mit aktivem KI-Coach
gibt's zusätzlich täglich eine frische Idee von Claude.

## Neue Funktionen hinzufügen

Ein paar typische Erweiterungen und wo sie hingehören:

- **Neue Kategorie:** direkt in der App unter *Einstellungen → Kategorien*. Im Code stehen
  die Standard-Kategorien in `js/defaults.js`.
- **Neue Kennzahl auf der Statistik-Seite:** Rechnung in `js/budget.js` ergänzen, ein
  Anzeige-Element in `index.html` einbauen, im `renderStatistik()` in `js/ui.js` füllen.
- **Neuer Bildschirm/Tab:** in `index.html` einen `<section class="view" id="view-xyz">`
  anlegen, einen Navigations-Knopf mit `data-view="xyz"` hinzufügen, eine `renderXyz()`-Funktion
  in `js/ui.js` schreiben und in `SK.ui.render()` aufrufen.

> Nach jeder Code-Änderung an den Dateien: erhöhe in `service-worker.js` die Zahl in
> `CACHE_NAME` (z.B. `sparkurs-v2`), damit der Browser die neue Version lädt.

---

## Backup

Alle Daten liegen **nur auf deinem Gerät** (im Browser-Speicher). Für einen Gerätewechsel
oder zur Sicherheit:

- **Einstellungen → Backup exportieren** speichert eine `.json`-Datei.
- **Einstellungen → Backup importieren** liest sie auf dem neuen Gerät wieder ein.

---

*Sparen an Shiii · Manoa Verner · 2026 · läuft offline, ohne Server und ohne Konto.*
