# Projektplan: Swiitol Laser KI-App

Dieser Plan unterteilt das Projekt in überschaubare Phasen. Jeden Schritt haken wir nacheinander ab.

## Phase 1: Projekt-Setup und Basis-Restrukturierung
- [x] Initialisierung der Vite/React App (Single Page Application Architektur).
- [x] Erstellung eines "Premium-UI" Grundgerüsts (Vanilla CSS, Dark Mode, Glassmorphism).
- [x] Implementierung eines Settings-Bereichs (Eingabe und sicheres lokales Speichern / .env für API-Keys).
- [x] *ABNAHME: Erfolgreich lokal und in der Cloud (Hugging Face Spaces) deployed.*

## Phase 2: KI-Bildgenerierung über den Client
- [x] Direkte Client-Integration und Fetch-Request an die kostenlose Hugging Face Inference API.
- [x] Integration des State-of-the-Art FLUX.1 (schnell) Bildmodells.
- [x] UI für Bildeingabe (Prompt), Ladeanimationen, Fehlerbehandlung und Resultat.
- [x] *ABNAHME: Generieren und Darstellen von Laser-Vorlagen-Bildern im Browser.*

## Phase 2.5: Eigener Bild-Upload & Image-to-Image (Neu hinzugefügt)
- [x] Ausbau der UI um ein Tab-System (Generator vs. Upload).
- [x] Drag & Drop Feld für das Einfügen lokaler Nutzerbilder.
- [x] Implementierung des `@huggingface/inference` SDK für Bildmanipulation.
- [x] KI-Veredelung per `image-to-image` (InstructPix2Pix Modell) für eigene Fotos.
- [x] *ABNAHME: Eigene Bilder können unverändert gerastert ODER per KI zum Raster modifiziert werden.*

## Phase 3: Bildvorbereitung & Dithering (Atomstack E18 Pro)
- [x] UI Eingabe für Wunsch-Lasergravurbreite in mm.
- [x] Berechnung der korrekten Laserpunktanzahl (Faktor für 0.08mm Laserspot).
- [x] HTML5 Canvas Bild-Skalierung (Upscaling) & Graustufen-Konvertierung (Luminanz-Methode).
- [x] Implementierung des Floyd-Steinberg-Dithering in Native JS (Verlustfreie S/W Laser-Vorstufe).
- [x] *ABNAHME: Vorher/Nachher Ansicht inklusiv Browser 'pixelated' Image-Rendering zur Prüfung.*

## Phase 4: G-Code Generierung & Web Serial Laser-Verbindung (Ausstehend)
- [ ] Übersetzungs-Algorithmus: Liest die schwarzen/weißen Pixel des Canvas aus und baut den GRBL G-Code zusammen.
- [ ] Anbindung der "Web Serial API", damit Chrome den Atomstack Laser direkt per USB verbindet.
- [ ] Stream-Kontrolle: 128-Byte Command-Puffer (GRBL Spec) für schnelles Gravieren (36.000 mm/min) integrieren.
- [ ] UI zur Live-Steuerung: Start, Abbruch und Live-Fortschrittsbalken während des Sendevorgangs.
- [ ] *ABNAHME: Trockenlauf am Laser und anschließender erster Laserschnitt.*
