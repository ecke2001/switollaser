# Agent & Tech-Stack Guidelines für Swiitol Laser App

## 1. Architektur & Tech-Stack (Optimiert & Vereinfacht)
Nach erneuter architektonischer Prüfung wurde das Setup massiv vereinfacht, um den optimalen goldenen Weg ("Simple & Optimal") zu gehen. Ein separates Backend (wie Express) wäre hier reiner Overhead. Wir bauen eine native, leichtgewichtige pure Frontend-App.

*   **App-Typ**: Single Page Application (SPA), die lokal im Browser läuft. Komplett Offline-fähig (bis auf die KI-Abfrage natürlich).
*   **Frontend-Framework**: Vite + React (schnell, modern, einfach).
*   **Styling**: Vanilla CSS (für "Glassmorphismus", fließende Micro-Animationen, Premium-Dark-Mode).
*   **Hardware-Kommunikation**: **Web Serial API**. Native Kommunikation direkt aus dem Browser mit dem Laser (der Swiitol verwendet meist GRBL) via USB. 
*   **KI-Bildgenerierung**: 
    *   Direkte API-Calls an OpenAI (DALL-E 3). Der User gibt seinen API-Key einmalig im Frontend (z.B. in den Einstellungen) ein. Dieser wird sicher lokal in deinem Browser (`localStorage`) gespeichert. Es gibt keinen Fremdserver, zu dem der Schlüssel geschickt wird.
*   **Bildverarbeitung für die Gravur**: 
    *   Komplette Bildverarbeitung im **HTML5 Canvas**.
    *   Nativer JavaScript-Algorithmus zur Umwandlung ins Graustufenbild und rastern mit **Floyd-Steinberg-Dithering** (ideal für präzise Lasergravuren). Keine Serverechnungen nötig!

## 2. Programmier-Richtlinien (Guidelines)
*   **KISS-Prinzip (Keep It Simple, Stupid)**: Keine unnötige Komplexität. Keine zweite Codebase. Alles passiert client-side im Browser.
*   **Ästhetik & UI/UX**: Die Oberfläche muss hochwertig ("Premium") wirken und fließende Übergänge bieten.
*   **Iterative Entwicklung**: Jede Phase wird granular geplant und umgesetzt.
*   **Abnahme-Prozess**: 
    1. Ich implementiere einen voll lauffähigen Schritt.
    2. Du (der User) testest ihn.
    3. Der nächste Schritt wird streng erst nach deiner positiven Abnahme begonnen.
*   **Modulare Hooks & Komponenten**: Saubere Trennung von React-UI und Logik, auch wenn alles Frontend ist.
