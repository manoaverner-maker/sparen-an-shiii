# Money Manager

**Deine persönliche Budget-App** (früher „Sparen an Shiii"). Sie beantwortet jeden Tag die eine wichtige Frage:

> **Wie viel kann ich heute noch ausgeben, ohne mein Sparziel und meine Fixkosten zu gefährden?**

Die App läuft **offline** auf deinem Gerät, speichert lokal und **synchronisiert sich optional** über ein privates GitHub-Repository zwischen Laptop und Handy. Sie lässt sich als **App auf den iPhone- oder Desktop-Homescreen** legen.

---

## Design (v4)

Seit Version 4 ist die App bewusst **luftig und reduziert**:

- **Eine Botschaft pro Karte** – der Heute-Screen zeigt nur die grosse Zahl im Fortschrittsring, eine Statuszeile und die letzten Ausgaben.
- **Erklärungen auf Abruf** – statt Erklärtexten unter jeder Zeile gibt es kleine **ⓘ-Knöpfe**; ein Tipp öffnet ein kleines Blatt mit der Erklärung (siehe `SK.ui.INFO` in `js/ui.js`).
- **4 Tabs + ＋ in der Mitte** – Heute, Verlauf, Ziele, Mehr. Die **Statistik** ist der zweite Schalter im Verlauf. Hinter „Mehr" liegen Abos, Schulden & Bussen, Ferienmodus, Listen und Einstellungen.
- **Ziel-Karten klappen auf** – zugeklappt nur Name, Balken, Prozent; Details und Knöpfe erst beim Antippen.

## Was die App kann

| Bereich | Was es macht |
|--------|--------------|
| **Heute** | Grosse Zahl „heute noch verfügbar" im Ampel-Ring (grün/gelb/rot), Statuszeile, Abo-Erinnerung, Hauptsparziel, letzte Ausgaben. |
| **Erfassen** (＋) | Ausgabe in Sekunden: Betrag, Kategorie, optionale Notiz. |
| **Verlauf** | Alle Buchungen nach Tag gruppiert, filterbar, bearbeit- und löschbar. Umschalter oben: **Liste / Statistik**. |
| **Statistik** | Kalender-Heatmap, Monatsverlauf (Soll/Ist), Tortendiagramm, Streak, Ø-Werte, Hochrechnung, Vormonat, Schulden-Überblick. |
| **Ziele** | *Ziel mit Datum* (z.B. Kroatien) und *fester Monats-Topf* (z.B. Motorrad 250/Monat). Automatisches Ansparen der Monats-Töpfe. |
| **Abos** | Abo-Radar mit Gesamtsumme, Erinnerung 3 Tage vor Verlängerung, aktiv/gekündigt-Schalter. |
| **Schulden & Bussen** | Eigener Topf mit Teilzahlungen, Fortschritt, Fälligkeit, Archiv – getrennt vom Tagesbudget. |
| **Ferienmodus** | Getrennter Reise-Topf mit eigenem Ferien-Tagesbudget, optionaler Fremdwährung, Rückblick und Schnell-Links. |
| **Listen** | Wunschlisten mit Preisen und Abhaken – rein informativ. |
| **Sync** | Automatischer Abgleich zwischen Geräten über ein privates GitHub-Repo (siehe unten). |
| **Einstellungen** | Lohn, Fixkosten, Schulden-Rate, Kategorien, Sync, Backup-Export/Import, Zurücksetzen. |

---

## Schnellstart

**Online (am einfachsten):** Die App liegt auf GitHub Pages:
`https://manoaverner-maker.github.io/sparen-an-shiii/`

**Lokal testen:** Im Projektordner einen kleinen Webserver starten und
`http://localhost:8200/` öffnen (der Offline-Service-Worker funktioniert
nicht per Doppelklick auf `index.html`):

```bash
python3 -m http.server 8200        # Mac/Linux
powershell -File .\serve.ps1       # Windows
```

## Aufs iPhone legen

1. Die GitHub-Pages-Adresse in **Safari** öffnen.
2. **Teilen-Symbol** → **„Zum Home-Bildschirm"**.
3. Fertig – die App startet im Vollbild, auch offline.

---

## Synchronisation Laptop ↔ Handy

Der komplette App-Zustand wird als `data.json` in einem **privaten**
GitHub-Repository (Standard: `money-manager-data`) gespeichert.
Beim Öffnen holt die App den neuesten Stand; nach jeder Änderung lädt sie
ihn (leicht verzögert) hoch. Es gewinnt immer der **neuere** Stand
(`meta.updatedAt`) – darum die Geräte **nacheinander** benutzen.

**Einrichtung pro Gerät** (Einstellungen → Synchronisation):

1. Auf github.com ein **Fine-grained Token** erstellen
   (*Settings → Developer settings → Fine-grained tokens*):
   nur Zugriff auf das Daten-Repo, Berechtigung **Contents: Read and write**.
2. Token + Repo-Name in der App eintragen → **Verbinden**.

> Das Token bleibt im localStorage des Geräts und steht auch im
> JSON-Backup – Backups darum sicher aufbewahren. Die ganze Logik steht
> kommentiert in [`js/sync.js`](js/sync.js).

---

## Aufbau der Dateien

```
sparen-an-shiii/
├── index.html            Grundgerüst (alle Bildschirme + PWA + Info-Sheet)
├── manifest.json         App-Infos für den Homescreen
├── service-worker.js     Offline-Cache (bei Änderungen CACHE_NAME erhöhen!)
├── css/styles.css        Das komplette Aussehen (Design v4)
└── js/
    ├── defaults.js       Startwerte & Stammdaten
    ├── icons.js          Icon-Set (Inline-SVG)
    ├── storage.js        Speichern/Laden (localStorage) + Backup
    ├── budget.js         Rechen-Logik (Tagesbudget usw.)  ← das Herzstück
    ├── charts.js         Selbst gezeichnete Diagramme (SVG)
    ├── sync.js           GitHub-Sync zwischen Geräten
    ├── ui.js             Anzeige: baut alle Bildschirme + ⓘ-Erklärungen
    └── app.js            Steuerung: verbindet Klicks, Daten und Anzeige
```

**So hängt es zusammen:**
`defaults` legt Startdaten fest → `storage` speichert/lädt → `budget` rechnet →
`charts` & `ui` zeigen an → `app` reagiert auf Eingaben → `sync` gleicht ab.

## Wie das Tagesbudget berechnet wird

Ausführlich kommentiert in [`js/budget.js`](js/budget.js). In Worten:

1. **Monatliche Sparrate** = Summe der benötigten Raten aller Ziele.
2. **Verfügbar diesen Monat** = Lohn − Fixkosten − Sparrate − (optionale Schulden-Rate).
3. **Tagesbudget heute** = (verfügbar − schon ausgegeben) ÷ verbleibende Tage.
4. **Heute noch verfügbar** = Tagesbudget − was du heute schon ausgegeben hast.

Gibst du heute weniger aus, steigt das Budget der Resttage – dieser Effekt
soll helfen, bewusster mit Geld umzugehen.

## Nach Code-Änderungen

In `service-worker.js` die Zahl in `CACHE_NAME` erhöhen (z.B. `sparkurs-v16`)
und in `index.html` die Version am Stylesheet-Link (`styles.css?v=…`) anpassen,
damit installierte Apps die neuen Dateien laden.

---

*Money Manager · Manoa Verner · 2026 · läuft offline, synchronisiert über dein privates GitHub-Repo.*
