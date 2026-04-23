# OpenType

Lokaler Typing-Speed-Tester mit Analyse-Dashboard, Fehler-Heatmap und intelligentem Übungsmodus. Kein Backend, kein Framework — läuft komplett im Browser via IndexedDB.

---

## Starten

```bash
cd OpenType
python3 -m http.server 8080
```

Dann im Browser: `http://localhost:8080`

> Da ES-Module (`type="module"`) genutzt werden, funktioniert das Öffnen per `file://` nicht — ein lokaler HTTP-Server ist nötig.

---

## Features

### Tippen

- **5 Textmodi:** Deutsch, Englisch, Code, Literatur-Zitate, Klappentexte
- **Live-Statistiken:** WPM, Genauigkeit und Zeit werden während des Tippens aktualisiert
- **Zeichenanzeige:** Falsch getippte Zeichen werden rot angezeigt (nicht das erwartete, sondern das tatsächlich getippte Zeichen)
- **Wort löschen:** `Ctrl+Backspace` (Windows/Linux) oder `Alt+Backspace` (Mac) löscht das vorherige Wort
- **Neuer Text:** `Tab` lädt einen neuen Text (kein direktes Wiederholen)
- **Attribution:** Literatur-Texte zeigen Titel, Autor und Jahrgang — mit direktem Suchlink
- **Hell/Dunkel-Theme:** Toggle oben rechts, via CSS-Klasse umgesetzt
- **Ergebnisscreen:** Nach Abschluss werden WPM, Genauigkeit, Zeit, Tastenanschläge/Min und Fehleranzahl angezeigt

### Analyse

Über den Tab **Analyse** erreichbar. Alle Daten werden lokal in IndexedDB gespeichert.

#### WPM-Verlauf
Linechart der letzten 50 Sessions — zeigt die Entwicklung der Schreibgeschwindigkeit über die Zeit.

#### Zeit pro Wort (letzte Session)
Balkendiagramm der letzten Session: Jeder Balken entspricht einem Wort. Höhe = Tippzeit in Sekunden. Rote Balken = Wörter mit Fehlern. Hover zeigt genaue Zeit. Ermöglicht das Erkennen von Stockern mitten im Text.

#### Fehler-Heatmap
QWERTZ-Tastaturlayout eingefärbt nach Fehlerrate pro Taste:
- **Grün** (dunkel → hell): ≤5% / ≤15% Fehlerrate
- **Amber:** 16–35% Fehlerrate
- **Rot** (hell → kräftig): 36–60% / >60% Fehlerrate
- **Grau:** Noch nicht getippt (< 3 Anschläge)

Hover über eine Taste zeigt die genaue Fehlerrate und Anzahl Anschläge.

#### Schwächste Wörter
Tabelle der Wörter mit der höchsten Fehlerrate über alle Sessions, sortiert absteigend.

#### Schwächste Bigramme
Tabelle der häufigsten Zeichen-Übergänge mit Fehlern (z.B. `ei`, `ch`, `st`).

#### Übungsvorschläge
Algorithmus der 6 Muster erkennt und priorisierte Karten ausgibt:

| Typ | Beschreibung | Priorität |
|-----|-------------|-----------|
| **Langsame Tasten** | Zeichen die ≥1.8× über dem Durchschnitt liegen | Hoch |
| **Problematische Übergänge** | Bigramme mit hoher Fehlerrate UND langer Tippzeit | Hoch |
| **Ermüdung** | Genauigkeit fällt im letzten Drittel in ≥2 Sessions ab | Mittel |
| **Schwacher Modus** | WPM-Differenz zwischen Modi >10 | Mittel |
| **Plateau** | WPM-Änderung <3 WPM über 8 Sessions | Hinweis |
| **Konsistenz** | WPM-Standardabweichung >25% des Mittelwerts | Hinweis |

Vorschläge mit **Üben**-Button starten direkt eine passende Practice-Session.

### Gezieltes Üben

- **Manuell:** Button „gezielt üben" in der Analyse-Ansicht
- **Via Vorschlag:** Jede Karte mit Üben-Button startet den Practice-Modus direkt
- **Algorithmik:** Schwache Wörter werden in den Originaltexten gesucht. Sätze, die mehrere schwache Wörter enthalten, werden bevorzugt — das übt Fingerpositionswechsel im echten Kontext, nicht isoliert
- **Gewichtung:** Wörter mit höherer Fehlerrate erscheinen öfter im generierten Übungstext

---

## Datenbankschema (IndexedDB)

### `sessions`
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | auto | Primärschlüssel |
| `timestamp` | number | Unix-Timestamp |
| `mode` | string | Textmodus |
| `textId` | string | ID des Textes |
| `wpm` | number | Wörter pro Minute |
| `accuracy` | number | Genauigkeit 0–100 |
| `durationMs` | number | Dauer in ms |
| `totalKeystrokes` | number | Alle Tastenanschläge |
| `errors` | number | Fehleranzahl |

### `keystrokes`
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | auto | Primärschlüssel |
| `sessionId` | number | FK → sessions.id |
| `position` | number | Position im Text |
| `expected` | string | Erwartetes Zeichen |
| `actual` | string | Tatsächlich getipptes Zeichen |
| `correct` | boolean | Treffer ja/nein |
| `timestampMs` | number | ms seit Session-Start |

---

## Projektstruktur

```
OpenType/
├── index.html          # Markup, Navigation, Views
├── style.css           # Design, Theme, Responsive
├── app.js              # Tipp-Logik, Session-Tracking, Practice-Modus
├── db.js               # IndexedDB-Abstraktionsschicht
├── analytics.js        # Auswertungsalgorithmen, Charts, Vorschläge
├── PLAN.md             # Entwicklungsplan mit Phasenstatus
├── README.md
└── data/
    ├── de.json             # 40 deutsche Texte
    ├── en.json             # 40 englische Texte
    ├── code.json           # 30 Code-Schnipsel
    └── literatur/
        ├── zitate.json         # 5 Originalzitate (Kafka, Goethe, Rilke, ...)
        └── klappentexte.json   # 20 Buchbeschreibungen
```

---

## Offene Ziele / Roadmap

- [ ] Häufige Tippfehler-Muster aus Forschung einarbeiten (bekannte Bigramm-Stolpersteine auf QWERTZ)
- [ ] Mehr Textvarianz: Gesehene Texte tracken, Round-Robin durch den Pool
- [ ] Tipp-Rhythmus-Visualisierung (gleichmäßige vs. stoßweise Eingabe)
- [ ] Export der Analyse als CSV/JSON
- [ ] Mobile Keyboard-Support verbessern
