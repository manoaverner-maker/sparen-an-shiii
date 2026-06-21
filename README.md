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
| **Ziele** | Mehrere Sparziele mit Fortschrittsbalken, benötigter Sparrate, Einzahlen-Knopf. |
| **Abos** | Abo-Radar mit Gesamtsumme, Erinnerung 3 Tage vor Verlängerung, aktiv/gekündigt-Schalter. |
| **Statistik** | Monatsverlauf (Soll gegen Ist), Tortendiagramm nach Kategorie, Streak, Ø pro Tag/Woche, Hochrechnung, Vormonatsvergleich. |
| **Einstellungen** | Lohn, Fixkosten, Kategorien, Backup-Export/Import, Zurücksetzen. |

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
│   ├── charts.js         Selbst gezeichnete Diagramme (SVG)
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
3. **Verfügbar diesen Monat** = Lohn − Fixkosten − Sparrate.
4. **Bereits ausgegeben** = Summe der Buchungen dieses Monats vor heute.
5. **Noch verfügbar (Tagesbeginn)** = (3) − (4).
6. **Tagesbudget heute** = (5) ÷ verbleibende Tage im Monat (heute mitgezählt).
7. **Heute noch verfügbar** (die grosse Zahl) = Tagesbudget − was du heute schon ausgegeben hast.

👉 Gibst du heute weniger aus, steigt das Tagesbudget der Resttage. Gibst du mehr aus,
sinkt es sichtbar. Genau dieser Effekt soll dir helfen, bewusster mit Geld umzugehen.

> **Hinweis:** Geld, das du ins Sparziel verschiebst, zählt ebenfalls als „abgeflossen"
> (es ist ja nicht mehr zum Ausgeben da), taucht aber **nicht** in der Ausgaben-Statistik auf.

---

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
