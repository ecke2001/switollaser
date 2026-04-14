/**
 * LaserController: Steuert die Web Serial API und das GRBL Streaming mit Character-Counting.
 */

export class LaserController {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.connected = false;
    
    // GRBL Character Counting
    this.pendingBytes = 0;
    this.inflightLines = [];
    this.maxBuffer = 127; // GRBL standard safe rx buffer size
    
    this.isStreaming = false;
    this.callbacks = {
      onMessage: () => {},
      onProgress: () => {},
      onComplete: () => {},
      onError: () => {}
    };
  }

  // Erlaubt das Registrieren von UI Callbacks
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Öffnet das USB-Device via Browser (User muss aktiv klicken!)
  async connect() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API wird von diesem Browser nicht unterstützt. Bitte nutze Google Chrome oder Microsoft Edge!');
    }

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 }); // Atomstack nutzt idR 115200
      this.connected = true;
      this.callbacks.onMessage("Laser via USB verbunden (115200 Baud).");

      // Starte Read-Loop im Hintergrund
      this.startReadLoop();
      
      // Wecke das Board auf
      await this._sendRaw("\r\n\r\n");
      
    } catch (err) {
      this.connected = false;
      throw new Error("Verbindung fehlgeschlagen: " + err.message);
    }
  }

  async disconnect() {
    this.isStreaming = false;
    if (this.reader) {
      this.reader.cancel();
    }
    if (this.port) {
      await this.port.close();
    }
    this.connected = false;
    this.port = null;
    this.callbacks.onMessage("Verbindung getrennt.");
  }

  async _sendRaw(str) {
    if (!this.port) return;
    try {
      if (!this.writer) {
        const encoder = new TextEncoderStream();
        encoder.readable.pipeTo(this.port.writable);
        this.writer = encoder.writable.getWriter();
      }
      await this.writer.write(str);
    } catch (e) {
      this.callbacks.onError(e.message);
    }
  }

  // Startet den Hintergrundprozess zum Auslesen des Serial-Ports
  async startReadLoop() {
    let buffer = "";
    const decoder = new TextDecoderStream();
    this.port.readable.pipeTo(decoder.writable);
    this.reader = decoder.readable.getReader();

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          
          while (buffer.includes('\n')) {
            const newlineIndex = buffer.indexOf('\n');
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            // Verarbeite GRBL Antworten
            if (line === "ok" || line.startsWith("error:")) {
              if (this.inflightLines.length > 0) {
                // Das Brett hat die Ausführung dieses Befehls theoretisch gepulled. 
                // Zähler reduzieren!
                const bytesAcked = this.inflightLines.shift();
                this.pendingBytes -= bytesAcked;
              }
            } else if (line.length > 0 && !line.startsWith("<")) {
               console.log("GRBL:", line); // Andere Meldungen wie Grbl 1.1f ['$' for help]
               this.callbacks.onMessage("E18 Pro: " + line);
            }
          }
        }
      }
    } catch (e) {
      this.callbacks.onError("Lese-Fehler: " + e.message);
    } finally {
      this.reader.releaseLock();
    }
  }

  // Streamt unseren G-Code Iterator
  async startEngraving(gcodeIterator, totalLines) {
    if (!this.connected) throw new Error("Nicht verbunden!");
    this.isStreaming = true;
    this.pendingBytes = 0;
    this.inflightLines = [];
    let linesSent = 0;

    this.callbacks.onMessage("Starte Gravur-Stream...");

    for await (const cmd of gcodeIterator) {
      if (!this.isStreaming) {
        // Abbruch
        await this._sendRaw("M5\nG0 X0 Y0\n"); // Laser aus, zurück zum Start
        this.callbacks.onMessage("Gravur abgebrochen!");
        return;
      }

      const lineOut = cmd + '\n';
      const bytes = lineOut.length;

      // Character-Counting Wait Loop: Hält den Loop an, bis Platz im 128-byte Rx Buffer ist!
      while (this.pendingBytes + bytes >= this.maxBuffer) {
        // Yielding the thread to allow readLoop to process 'ok's
        await new Promise(r => setTimeout(r, 1));
      }

      // Feuer frei!
      this.pendingBytes += bytes;
      this.inflightLines.push(bytes);
      await this._sendRaw(lineOut);
      
      linesSent++;
      if (totalLines && linesSent % 100 === 0) {
        this.callbacks.onProgress(Math.round((linesSent / totalLines) * 100));
      }
    }

    // Warteschleife bis alles gepuffert und verarbeitet wurde
    while (this.pendingBytes > 0 && this.isStreaming) {
      await new Promise(r => setTimeout(r, 10));
    }

    this.isStreaming = false;
    this.callbacks.onProgress(100);
    this.callbacks.onComplete();
  }

  // Notstopp
  stop() {
    this.isStreaming = false;
  }
}
