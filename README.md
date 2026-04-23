# OpenType

OpenType ist ein lokaler Typing-Speed-Tester mit Analyse-Dashboard, gezieltem Ueben und reinem Frontend-Stack.

## Stack
- HTML
- CSS
- Vanilla JavaScript
- IndexedDB
- JSON-Dateien als Textquelle

## Starten

Mit Node:

```bash
npx serve .
```

Mit Python:

```bash
python3 -m http.server 8080
```

Danach im Browser oeffnen:
- `http://localhost:3000` bei `serve`
- `http://localhost:8080` bei Python

## Projektstruktur

```text
OpenType/
├── index.html
├── style.css
├── app.js
├── db.js
├── analytics.js
├── PLAN.md
├── README.md
└── data/
    ├── de.json
    ├── en.json
    ├── code.json
    └── literatur/
        ├── zitate.json
        └── klappentexte.json
```

## Features
- Mehrere Textmodi
- Lokale Session-Speicherung via IndexedDB
- WPM-Verlauf
- Fehler-Heatmap
- Analyse schwaecherer Woerter und Bigramme
- Gezielter Practice-Modus

## GitHub verbinden

Repository lokal initialisieren:

```bash
git init
git branch -M main
git add .
git commit -m "Initial commit"
```

Remote hinzufuegen:

```bash
git remote add origin https://github.com/DEIN-NAME/OpenType.git
git push -u origin main
```

Alternativ mit SSH:

```bash
git remote add origin git@github.com:DEIN-NAME/OpenType.git
git push -u origin main
```
