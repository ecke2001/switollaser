---
title: Swiitol Laser AI
emoji: ⚡
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Swiitol Laser AI

Eine hochperformante React Single-Page Application zur automatisierten Bild-Generierung, -Aufbereitung und -Verpixelung (Dithering) zur Vorbereitung für den Atomstack/Swiitol E18 Pro Lasergravierer.

### Features
* **Text-to-Image**: Generiert Laser-optimierte Motive direkt aus Text (nutzt Hugging Face FLUX.1).
* **Img2Img**: Hochladen von privaten Fotos und optionale KI-Veredelung (InstructPix2Pix).
* **Canvas Upscaling**: Pixelgenaue Vergrößerung / Interpolation basierend auf der 0.08mm Punktgröße des Lasers.
* **Floyd-Steinberg Dithering**: Millisekundenschnelles, verlustfreies 1-Bit Dithering im Browser RAM, um aus jedem Foto reine Schwarz-Weiß G-Code Laser-Punkte zu generieren.

### Bereitstellung (Hugging Face Spaces)
Dieses Repository ist nativ konfiguriert, um als **Hugging Face Docker Space** gehostet zu werden.
Der inkludierte `Dockerfile` baut die Vite App in ein Produktions-Bundle und served sie blitzschnell auf Port 7860.
