/**
 * Konvertiert ein Bild via HTML5 Canvas in ein lasergraviermaschinen-
 * taugliches Schwarz-Weiß-Pixel-Format (Floyd-Steinberg Dithering).
 * Beachtet dabei die physische Skalierung basierend auf der Laser-Spot-Größe.
 * 
 * @param {string} imageSrc - Die URL/Blob des Quellbildes
 * @param {number} widthMm - Gewünschte physikalische Breite in mm
 * @param {number} dotSize - Laserpunkt-Größe in mm (Def: 0.08 für Atomstack E18 Pro)
 */
export function processImageForLaser(imageSrc, widthMm, dotSize = 0.08) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      // 1. Pixelauflösung exakt für den Laserpunkt berechnen
      // Beispiel: 200mm Breite / 0.08mm Spot = 2500 Pixel Breite!
      const targetWidthPx = Math.round(widthMm / dotSize);
      const aspectRatio = img.height / img.width;
      const targetHeightPx = Math.round(targetWidthPx * aspectRatio);
      
      // 2. Off-Screen Canvas initialisieren und Bild hochskalieren
      const canvas = document.createElement('canvas');
      canvas.width = targetWidthPx;
      canvas.height = targetHeightPx;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      // Bild wird vom Browser in der Regel mit Bicubic/Smooth Scaling hochskaliert
      ctx.drawImage(img, 0, 0, targetWidthPx, targetHeightPx);
      
      // 3. Pixel auslesen
      const imageData = ctx.getImageData(0, 0, targetWidthPx, targetHeightPx);
      const data = imageData.data;
      
      // 4. Graustufen-Konvertierung (Luminanz-Methode)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Gewichtete Leuchtkraft für das menschliche Auge
        const gray = (r * 299 + g * 587 + b * 114) / 1000;
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
      
      // 5. Floyd-Steinberg Dithering (Umwandlung in reine Schwarz/Weiß Punkte)
      for (let y = 0; y < targetHeightPx; y++) {
        for (let x = 0; x < targetWidthPx; x++) {
          const index = (y * targetWidthPx + x) * 4;
          const oldPixel = data[index];
          // Threshold bei 128 (Mitte)
          const newPixel = oldPixel < 128 ? 0 : 255;
          
          data[index] = data[index + 1] = data[index + 2] = newPixel;
          const quantError = oldPixel - newPixel;
          
          // Fehlerverteilung auf die Nachbarpixel (falls vorhanden)
          if (x + 1 < targetWidthPx) {
            const idxRight = index + 4;
            data[idxRight] += quantError * (7 / 16);
            data[idxRight + 1] += quantError * (7 / 16);
            data[idxRight + 2] += quantError * (7 / 16);
          }
          if (y + 1 < targetHeightPx) {
            if (x - 1 >= 0) {
              const idxBotLeft = ((y + 1) * targetWidthPx + (x - 1)) * 4;
              data[idxBotLeft] += quantError * (3 / 16);
              data[idxBotLeft + 1] += quantError * (3 / 16);
              data[idxBotLeft + 2] += quantError * (3 / 16);
            }
            const idxBot = ((y + 1) * targetWidthPx + x) * 4;
            data[idxBot] += quantError * (5 / 16);
            data[idxBot + 1] += quantError * (5 / 16);
            data[idxBot + 2] += quantError * (5 / 16);
            
            if (x + 1 < targetWidthPx) {
              const idxBotRight = ((y + 1) * targetWidthPx + (x + 1)) * 4;
              data[idxBotRight] += quantError * (1 / 16);
              data[idxBotRight + 1] += quantError * (1 / 16);
              data[idxBotRight + 2] += quantError * (1 / 16);
            }
          }
        }
      }
      
      // 6. Das generierte Dithering-Raster auf den Canvas zurückschreiben
      ctx.putImageData(imageData, 0, 0);
      
      resolve({
         processedUrl: canvas.toDataURL('image/png'),
         widthPx: targetWidthPx,
         heightPx: targetHeightPx,
         canvasId: canvas // Für später Phase 4 (GCode) hilfreich
      });
    };
    
    img.onerror = () => reject(new Error('Fehler beim Laden des Bildes ins Canvas.'));
    img.src = imageSrc;
  });
}
