# OpenType - Entwicklungsplan

## Projektziel
Lokaler Typing-Speed-Tester mit Analyse-Dashboard, gezieltem Ueben und sauberer Dateistruktur.
Kein Backend, kein Framework. Laeuft via `npx serve` oder `python -m http.server`.

---

## Leitprinzipien
- Alles laeuft lokal im Browser.
- Keine Abhaengigkeit von externen APIs oder Frameworks.
- Datenhaltung ist nachvollziehbar, versionierbar und migrierbar.
- Analysefunktionen werden nur auf Basis klar definierter Rohdaten gebaut.
- Features werden phasenweise fertiggestellt; spaetere Phasen duennen den Kern nicht aus.

---

## Finaler Tech-Stack
- **HTML / CSS / JS** - vanilla, kein Framework
- **IndexedDB** - lokale Datenpersistenz fuer Sessions, Keystrokes und Texte
- **JSON-Dateien** - Textinhalte (erfordert lokalen HTTP-Server wegen CORS)
- **SVG / HTML-Grid** - Charts und Heatmap in der Analyse-Ansicht

---

## Dateistruktur (Ziel)

```text
OpenType/
├── index.html
├── style.css
├── app.js
├── db.js
├── analytics.js
├── PLAN.md
└── data/
    ├── de.json
    ├── en.json
    ├── code.json
    └── literatur/
        ├── zitate.json
        └── klappentexte.json
```

---

## Datenmodell und Persistenz

### Datenbank-Metadaten
Die Datenbank bekommt eine explizite Schema-Version, damit Aenderungen an Stores oder Importlogik kontrolliert bleiben.

```js
const DB_NAME = 'OpenTypeDB';
const DB_VERSION = 2;
const TEXT_IMPORT_VERSION = '2026-04-23';
```

### Import-Strategie fuer Texte
- JSON-Dateien werden **nicht** bei jedem Start blind neu importiert.
- Beim App-Start wird geprueft, ob `meta.textImportVersion === TEXT_IMPORT_VERSION`.
- Nur wenn:
  - noch keine Texte vorhanden sind,
  - die Import-Version fehlt,
  - oder `TEXT_IMPORT_VERSION` geaendert wurde,
  wird der Textbestand neu eingelesen.
- Re-Import erfolgt als kontrollierter Replace:
  - vorhandene `texts`-Eintraege loeschen
  - JSON-Dateien neu laden
  - neue Eintraege schreiben
  - `meta.textImportVersion` aktualisieren

Damit entstehen keine Dubletten und Textaenderungen bleiben reproduzierbar.

### Object Store: `sessions`
```js
{
  id: auto,
  timestamp: Date.now(),
  mode: 'de' | 'en' | 'code' | 'literatur_zitate' | 'literatur_klappentexte' | 'practice',
  textId: string,
  wpm: number,
  accuracy: number,         // 0-100
  durationMs: number,
  totalKeystrokes: number,
  errors: number
}
```

### Object Store: `keystrokes`
```js
{
  id: auto,
  sessionId: number,        // FK -> sessions.id
  position: number,         // Zielposition im Soll-Text
  expected: string,         // Erwartetes Zeichen
  actual: string,           // Getipptes Zeichen oder Sonderwert
  correct: boolean,
  timestampMs: number,      // ms seit Session-Start
  eventType: 'input' | 'backspace'
}
```

### Object Store: `texts`
```js
{
  id: string,               // z.B. 'de_0', 'literatur_zitate_3'
  mode: string,
  text: string,
  title?: string,
  author?: string,
  year?: string,
  search?: string
}
```

### Object Store: `meta`
```js
{
  key: string,
  value: any
}
```

Empfohlene Keys:
- `textImportVersion`
- `lastOpenedAt`
- `theme`

---

## Klare Metrik-Definitionen

### WPM
Einheitliche Formel fuer gesamte App:

```js
wpm = (correctChars / 5) / (durationMs / 60000)
```

Regeln:
- Es zaehlen nur korrekt bestaetigte Zeichen.
- Berechnung erfolgt zentral an einer Stelle.
- Anzeige in Tippen-View und Analyse verwendet dieselbe Funktion.

### Accuracy

```js
accuracy = (correctKeystrokes / totalKeystrokes) * 100
```

Regeln:
- `totalKeystrokes` umfasst alle gespeicherten Input- und Backspace-Events.
- `correctKeystrokes` umfasst nur Events mit `correct === true`.
- Accuracy wird immer auf Session-Ebene gespeichert und fuer Analysen erneut reproduzierbar berechnet.

---

## Keystroke-Spezifikation

Die Analyse steht und faellt mit sauber definierten Events. Deshalb gilt vor Baubeginn folgende Regel:

### Was gespeichert wird
- Jeder eingegebene sichtbare Tastendruck wird als `eventType: 'input'` gespeichert.
- Jeder Rueckschritt wird als `eventType: 'backspace'` gespeichert.
- `Tab` fuer "neuer Text" wird **nicht** als Keystroke gespeichert.
- Modifier wie `Shift`, `Alt`, `Ctrl`, `Meta` werden **nicht** gespeichert.

### Bedeutung der Felder
- `position`: Zielindex im Soll-Text zum Zeitpunkt des Events
- `expected`: Zeichen, das an dieser Position erwartet wird
- `actual`: tatsaechlich eingegebenes Zeichen
- bei Backspace: `actual = '[Backspace]'`

### Mehrfachfehler
- Wenn dieselbe Position mehrfach falsch getippt wird, wird **jeder Versuch einzeln gespeichert**.
- Wenn der Nutzer korrigiert und danach korrekt tippt, bleiben sowohl Fehlversuch als auch Korrektur erhalten.

### Sonderfaelle
- Backspace auf leerem Input wird nicht gespeichert.
- Nichtdruckbare Tasten ausser Backspace werden ignoriert.
- Practice-Texte werden wie normale Texte behandelt und als `mode: 'practice'` gespeichert.

Damit bleiben Heatmap, Fehlerraten, Bigramme und Accuracy spaeter konsistent.

---

## Modi

| Key | Beschreibung |
|-----|-------------|
| `de` | Deutsche Alltagstexte |
| `en` | Englische Texte |
| `code` | Code-Schnipsel |
| `literatur_zitate` | Echte Originalzitate aus Buechern |
| `literatur_klappentexte` | Buchbeschreibungen / Klappentexte |
| `practice` | Generierter Uebungstext aus individuellen Schwachstellen |

---

## UI-Struktur

### Navigation (oben, immer sichtbar)
```text
[ Tippen ]   [ Analyse ]
```

### View 1: Tippen
- Modus-Buttons: `deutsch`, `english`, `code`, `zitate`, `klappentexte`
- `Tab` -> neuer Text
- Hell/Dunkel-Toggle via CSS-Klasse statt inline Styling
- `--red` auch im Light-Mode korrekt gesetzt

### View 2: Analyse
- **WPM-Verlauf** - Linechart der letzten Sessions
- **Fehler-Heatmap** - QWERTZ-Layout, Farbe = Fehlerrate pro Taste
- **Schwaechste Woerter** - Tabelle, sortiert nach Fehlerrate
- **Schwaechste Bigramme** - haeufige fehlerhafte Zeichenpaare
- **Gezielt ueben** - startet Practice-Modus aus Analyse heraus

### View 3: Practice-Modus
- Generiert Uebungstext aus haeufig fehlerhaften Zeichen
- Nutzt Gewichtung nach Fehlerrate
- Bleibt les- und tippbar, nicht nur zufaellig

---

## Analyse-Logik

### `getWeakWords(keystrokes, texts)` - konkrete Regel
Schwaeche auf Wortebene wird **nicht** frei aus Einzelzeichen geraten, sondern so rekonstruiert:

1. Session kennt `textId`
2. `textId` liefert den Volltext
3. Volltext wird in Woerter tokenisiert
4. Jedes Wort kennt seinen Start- und Endindex im Text
5. Keystrokes werden ueber `position` den betroffenen Woertern zugeordnet
6. Pro Wort werden berechnet:
   - `attempts`
   - `errorCount`
   - `errorRate = errorCount / attempts`
7. Woerter mit zu wenig Daten werden gefiltert, z.B. `attempts < 2`

So wird vermieden, dass seltene Einzelwoerter die Statistik verzerren.

### `getWeakBigrams(keystrokes)`
- Bigrams basieren auf Soll-Zeichenpaaren im Ursprungstext
- Ein Bigramm gilt als problematisch, wenn mindestens eines der beiden Zielzeichen in seinem Auftreten fehlerhaft war
- Ergebnis wird nach Fehlerhaeufigkeit und Mindestanzahl gefiltert

### `getCharErrorRate(keystrokes)`
- Aggregation nur ueber `eventType: 'input'`
- Backspaces werden getrennt betrachtet und nicht als Zeichenfehler auf Tasten gemappt

---

## Practice-Modus - Regel fuer gute Uebungstexte

Ziel ist kein kompletter Zufallstext, sondern kuenstlich erzeugter, aber gut tippbarer Stoff.

### Generierungsregeln
- Eingabe: Top-N Problemzeichen mit Fehlerraten
- Gewichtung proportional zur Fehlerrate
- Aufbau aus kurzen Silben und einfachen Mustern:
  - `KV`
  - `VK`
  - `KVC`
  - `CV`
- Hauefige Problem-Bigramme werden bevorzugt eingebaut
- Vokale werden gezielt beigemischt, um Tippbarkeit zu erhalten
- Maximale Zeichendichte eines einzelnen Problemzeichens begrenzen

### Qualitaetsgrenze
Ein Practice-Text ist nur gueltig, wenn:
- kein Zeichen mehr als 35 % des Textes ausmacht
- mindestens 3 unterschiedliche Zeichen vorkommen
- Wortlaengen gemischt sind
- der Text lautlos "sprechbar" bleibt

---

## Phasen & Status

### Phase 1 - Dateistruktur + Inhalte [x]
- [x] `data/de.json` - Deutsche Texte
- [x] `data/en.json` - Englische Texte
- [x] `data/code.json` - Code-Schnipsel
- [x] `data/literatur/zitate.json` - nur echte Originalzitate
- [x] `data/literatur/klappentexte.json` - Buchbeschreibungen
- [x] `index.html` - bereinigt, laedt CSS + JS extern
- [x] `style.css` - aus `Opentype.html` extrahiert, responsive, Theme-Fix

**Definition of Done**
- Alle benoetigten Dateien existieren.
- JSON-Dateien sind gueltig und im Browser ladbar.
- Keine Inline-Skripte oder Inline-Styles mehr noetig.

### Phase 2 - IndexedDB-Schicht [x]
- [x] `db.js` schreiben
  - `initDB()`
  - `saveSession(data)`
  - `saveKeystrokes(sessionId, strokes)`
  - `getSessions(limit?)`
  - `getKeystrokes(sessionId)`
  - `getAllKeystrokes()`
  - `clearAll()`
- [x] `meta`-Store fuer Import-Version und App-Metadaten
- [x] kontrollierter Text-Import mit `TEXT_IMPORT_VERSION`

**Definition of Done**
- DB initialisiert ohne Fehler in leerem Browserprofil.
- Re-Import erzeugt keine Dubletten.
- Reset loescht reproduzierbar alle lokalen Daten.

### Phase 3 - App-Logik + Tracking [x]
- [x] `app.js` aus `index.html` extrahieren
- [x] Nach `finish()`: Session + Keystrokes in IndexedDB speichern
- [x] Keystroke-Array waehrend des Tippens aufbauen
- [x] `pickEntry()` - kein direktes Wiederholen
- [x] Theme-Toggle auf CSS-Klasse umstellen
- [x] `--red` im Light-Mode korrekt setzen
- [x] Keystroke-Tracking nach definierter Event-Spezifikation umsetzen
- [x] zentrale Berechnung fuer `wpm` und `accuracy`

**Definition of Done**
- Eine Session laesst sich komplett tippen, speichern und erneut auswerten.
- Gespeicherte Events stimmen sichtbar mit dem Nutzerverhalten ueberein.
- Theme und Textauswahl funktionieren ohne Seiteneffekte.

### Phase 4 - Analyse-View [x]

#### Phase-4-MVP
- [x] `analytics.js` - Basisfunktionen
  - `getWpmHistory(sessions)`
  - `getCharErrorRate(keystrokes)`
- [x] Analyse-View HTML-Struktur in `index.html`
- [x] Navigation Tippen <-> Analyse
- [x] WPM-Linechart
- [x] einfache Fehlerstatistik sichtbar

#### Phase-4-Ausbau
- [x] QWERTZ-Heatmap
- [x] `getWeakWords(keystrokes, texts)`
- [x] `getWeakBigrams(keystrokes)`
- [x] Tabellen fuer schwaeche Woerter / Bigramme

**Definition of Done**
- Analyse laeuft mit leerer und mit befuellter Historie stabil.
- Leere Daten fuehren zu sinnvollen Fallback-States statt Fehlern.
- Jede angezeigte Kennzahl laesst sich auf gespeicherte Rohdaten zurueckfuehren.

### Phase 5 - Practice-Modus [x]
- [x] `generatePracticeText(weakChars, length)` in `app.js`
- [x] Problemzeichen gewichten
- [x] tippbare Silbenfolgen statt reiner Zufallsstrings
- [x] Practice-Modus als eigener `mode`
- [x] "Gezielt ueben"-Button verlinkt direkt in den Modus

**Definition of Done**
- Practice-Text basiert sichtbar auf echten Schwachstellen.
- Der Text ist tippbar und nicht nur repetitiv.
- Practice-Sessions werden wie normale Sessions gespeichert und analysiert.

---

## Bekannte Bugs (aus Code-Review)

| # | Bug | Datei | Status |
|---|-----|-------|--------|
| 1 | `--red` wird im Light-Mode nicht ueberschrieben | `style.css` | [x] |
| 2 | Theme-Toggle setzt inline CSS statt Klasse | `app.js` | [x] |
| 3 | `pickEntry()` kann denselben Text wiederholen | `app.js` | [x] |
| 4 | Literatur: Klappentexte als Zitate gefuehrt | `data/` | [x] |
| 5 | `result-label` lowercase, Stats-Labels Pascal Case | `style.css` | [x] |

---

## Offene Produktgrenzen

Nicht Teil dieses Plans:
- Nutzerkonten
- Cloud-Sync
- Server-Backend
- Mehrspieler-Modus
- Export/Import von Sessions
- Framework-Migration

Diese Grenze verhindert Scope-Schleichwuchs, vor allem in Phase 4 und 5.

---

## Start-Kommando

```bash
cd OpenType
npx serve .
# oder
python3 -m http.server 8080
```

---

## Fortsetzungs-Hinweis (bei Token-Limit)

Aktuellen Stand ermitteln:
1. `PLAN.md` lesen - Checkboxen zeigen, was fertig ist
2. Dateien in `OpenType/` pruefen - welche existieren bereits?
3. Nächste offene Stelle oder Verfeinerung aufgreifen

Reihenfolge bleibt bindend:
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5

Nie eine Phase ueberspringen - jede baut auf der vorherigen auf.
