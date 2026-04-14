# Projektplan: Swiitol Laser KI-App (Vereinfachte Architektur)

Dieser Plan unterteilt das Projekt in überschaubare Phasen. Jeden Schritt haken wir nacheinander ab.

## Phase 1: Projekt-Setup und Basis-Restrukturierung
- [ ] Initialisierung der Vite/React App (ohne redundantes Backend).
- [ ] Erstellung eines "Premium-UI" Grundgerüsts (Vanilla CSS, Dark Mode).
- [ ] Implementierung eines lokalen Settings-Bereichs (Eingabe und sicheres lokales Speichern des OpenAI/Replicate API Keys).
- [ ] *ABNAHME: Du prüfst die App lokal in deinem Browser (Chrome/Edge empfohlen).*

## Phase 2: KI-Bildgenerierung über den Client
- [ ] Direkte Client-Integration der KI-API (z.B. OpenAI) über Fetch aus dem React-Frontend.
- [ ] UI für Bildeingabe (Prompt), Ladeanimationen, Fehlerbehandlung und Anzeige des Ergebnisses.
- [ ] *ABNAHME: Generieren und Darstellen von Bildern über deinen lokalen Browser.*

## Phase 3: Bildvorbereitung & Dithering via Canvas
- [ ] HTML5 Canvas Pipeline aufsetzen.
- [ ] Funktion: Bild in reines Graustufen-Format umwandeln (Luminanz-Matching).
- [ ] Funktion: Implementierung des Floyd-Steinberg-Algorithmus in JavaScript (Umwandlung in reine Schwarz-Weiß-Pixel für den Laser).
- [ ] UI für die Vorher/Nachher-Vorschau.
- [ ] *ABNAHME: Visuelle Überprüfung der bearbeiteten Bilder.*

## Phase 4: G-Code Generierung & Web Serial Laser-Verbindung
- [ ] Übersetzungs-Algorithmus: Liest die schwarzen/weißen Pixel des Canvas aus und baut den GRBL G-Code zusammen.
- [ ] Anbindung der "Web Serial API", so dass der Browser den Swiitol Laser per USB koppelt.
- [ ] Stream-Kontrolle: Start, Abbruch und Live-Fortschrittsbalken im UI während des Sendevorgangs.
- [ ] *ABNAHME: Trockenlauf am Laser und anschließender erster Laserschnitt.*
