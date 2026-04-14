/**
 * Generiert GRBL kompatiblen G-Code aus einem HTML5 Canvas Bild (schwarz/weiß).
 * Verwendet "Run-Length Encoding", um benachbarte Pixel gleicher Farbe 
 * als einen einzigen G1-Pfad zusammenzufassen. Das verhindert Puffer-Überläufe!
 * 
 * @param {HTMLCanvasElement} canvas - Das gerasterte Phase-3 Canvas
 * @param {number} widthMm - Die Zielbreite in Millimetern
 * @param {number} feedrate - Geschwindigkeit in mm/min
 * @param {number} power - Laser Power S-Wert (0-1000)
 */
export async function* gcodeGenerator(canvas, widthMm, feedrate = 20000, power = 1000) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const widthPx = canvas.width;
    const heightPx = canvas.height;
    
    // Wir errechnen den Pixel-Pitch basierend auf der Wunschbreite
    const dotSize = widthMm / widthPx;
    const imgData = ctx.getImageData(0, 0, widthPx, heightPx).data;

    // --- GRBL Header ---
    yield "G21";       // Einheit: Millimeter
    yield "G90";       // Absolute Positionierung
    yield "M4 S0";     // Laser ON im "Dynamic Power" Modus (verhindert Verbrennen in Kurven)
    yield `G0 F${feedrate}`; // Rapid Feedrate setzen
    yield `G1 F${feedrate}`; // Cut Feedrate setzen
    
    let isReverse = false; // Wir scannen Zeilen im "Zick-Zack" (Serpentine) um massive Zeit zu sparen!

    for (let y = 0; y < heightPx; y++) {
        let yMm = (y * dotSize).toFixed(3);
        
        // Führe den Laserkopf zum Start der aktuellen Zeile
        let startX = isReverse ? (widthPx * dotSize).toFixed(3) : "0.000";
        yield `G0 X${startX} Y${yMm}`;
        
        // Finde die Start-Leuchtstärke für Pixel Index 0 der iterierten Zeile
        let startPxIndex = isReverse ? widthPx - 1 : 0;
        let currentS = imgData[(y * widthPx + startPxIndex) * 4] < 128 ? power : 0;

        for (let i = 1; i <= widthPx; i++) {
            let isEnd = (i === widthPx);
            let nextS = 0;
            
            if (!isEnd) {
                let pxX = isReverse ? (widthPx - 1 - i) : i;
                nextS = imgData[(y * widthPx + pxX) * 4] < 128 ? power : 0;
            }

            // Wenn sich die Farbe ändert (Schwarz auf Weiß) ODER Zeilenende erreicht ist:
            // -> Wir committen die Linie!
            if (isEnd || nextS !== currentS) {
                let runEndX = isReverse ? (widthPx - i) : i;
                let runEndMm = (runEndX * dotSize).toFixed(3);
                
                // Wir senden einen G1 Cut-Befehl
                yield `G1 X${runEndMm} S${currentS}`;
                
                currentS = nextS;
            }
        }
        
        // Zeilen-Richtung umkehren für Serpentine-Scanning
        isReverse = !isReverse;

        // Gebe der Browser Main-Thread-Eventloop kurz Luft, damit UI nicht einfriert
        await new Promise(r => setTimeout(r, 0));
    }

    // --- GRBL Footer ---
    yield "M5";         // Laser komplett aus
    yield "G0 X0 Y0";   // Zurück zum Nullpunkt (Origin)
}
