import { useState, useEffect, useRef } from 'react'
import { processImageForLaser } from './utils/dithering'
import { HfInference } from '@huggingface/inference'
import { LaserController } from './utils/LaserController'
import { gcodeGenerator } from './utils/GCodeGenerator'
import './App.css'

function App() {
  const envApiKey = import.meta.env.VITE_HF_API_KEY || ''
  const [apiKey, setApiKey] = useState(envApiKey)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('text2img') // 'text2img' oder 'img2img'
  
  // KI State (Allgemein)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)

  // Bild State (Aus Text oder Upload)
  const [sourceImageUrl, setSourceImageUrl] = useState(null)
  
  // Phase 3: Dithering State
  const [widthMm, setWidthMm] = useState(100)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedImageUrl, setProcessedImageUrl] = useState(null)
  const [processInfo, setProcessInfo] = useState(null)

  // Phase 4: Laser Status
  const laserRef = useRef(new LaserController())
  const [laserSpeed, setLaserSpeed] = useState(25000) // Atomstack Optimal: 20000-30000
  const [laserPower, setLaserPower] = useState(800)  // 0-1000 GRBL Spindle PWM
  const [passes, setPasses] = useState(1) // Phase 5: Multi-Pass
  const [airAssist, setAirAssist] = useState(false) // Phase 5: Air Assist
  const [isConnected, setIsConnected] = useState(false)
  const [isEngraving, setIsEngraving] = useState(false)
  const [engraveProgress, setEngraveProgress] = useState(0)
  const [laserLogs, setLaserLogs] = useState([])
  
  // Um auf das originale Canvas Element aus Phase 3 zurückzugreifen!
  const ditheredCanvasRef = useRef(null)

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!envApiKey) {
      const savedKey = localStorage.getItem('swiitol_hf_key')
      if (savedKey) {
        setApiKey(savedKey)
      } else {
        setIsSettingsOpen(true)
      }
    }

    // Callbacks für Phase 4 registrieren
    laserRef.current.setCallbacks({
      onMessage: (msg) => setLaserLogs(prev => [...prev, msg].slice(-10)),
      onProgress: (pct) => setEngraveProgress(pct),
      onComplete: () => {
        setIsEngraving(false)
        setLaserLogs(prev => [...prev, "Gravur erfolgreich beendet!"].slice(-10))
      },
      onError: (err) => {
        setError(`Laser-Fehler: ${err}`)
        setIsEngraving(false)
      }
    });
  }, [envApiKey])

  const handleSaveSettings = (e) => {
    e.preventDefault()
    localStorage.setItem('swiitol_hf_key', apiKey)
    setIsSettingsOpen(false)
  }

  // --- Phase 2: Text-to-Image ---
  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;
    if (!apiKey) return setIsSettingsOpen(true);

    setIsGenerating(true);
    setError(null);
    setSourceImageUrl(null);
    setProcessedImageUrl(null);

    try {
      const hf = new HfInference(apiKey);
      console.log('Starte Text-to-Image mit FLUX.1');
      
      const blob = await hf.textToImage({
        model: 'black-forest-labs/FLUX.1-schnell',
        inputs: `High contrast, very detailed black and white vector style illustration, clean lines, perfect for laser engraving: ${prompt}`
      });
      
      setSourceImageUrl(URL.createObjectURL(blob));
    } catch (err) {
      if (err.message.includes('fetch') || err.message.includes('loading')) {
         setError("Fehler (Failed to fetch). Das kostenlose KI-Modell wacht vielleicht gerade auf (Kaltstart). Warte 10-15s und versuche es erneut.");
      } else {
         setError(err.message);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  // --- Phase 2.5: Upload & Img2Img ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    setSourceImageUrl(url);
    setProcessedImageUrl(null);
    setError(null);
  }

  const handleProcessUploadedImage = async () => {
    if (!prompt.trim()) return setError("Bitte gib an, wie die KI das Foto für die Gravur verändern soll (Z.B. 'als detaillierte Bleistiftskizze')");
    if (!apiKey) return setIsSettingsOpen(true);
    if (!sourceImageUrl) return;

    setIsGenerating(true);
    setError(null);

    try {
      const hf = new HfInference(apiKey);      
      const imageResponse = await fetch(sourceImageUrl);
      const imageBlob = await imageResponse.blob();

      const resultBlob = await hf.imageToImage({
        model: 'timbrooks/instruct-pix2pix',
        inputs: imageBlob,
        parameters: { prompt: prompt }
      });
      
      setSourceImageUrl(URL.createObjectURL(resultBlob));
      setProcessedImageUrl(null);
    } catch (err) {
      setError(`Img2Img Fehler: ${err.message}. (Hinweis: Kostenlose Img-2-Img Modelle sind oft wegen Overload blockiert)`);
    } finally {
      setIsGenerating(false);
    }
  }

  // --- Phase 3: Dithering ---
  const handleDithering = async () => {
    if (!sourceImageUrl) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const result = await processImageForLaser(sourceImageUrl, widthMm, 0.08);
      setProcessedImageUrl(result.processedUrl);
      setProcessInfo(`Gerastert: ${result.widthPx} x ${result.heightPx} Pixel (0.08mm)`);
      ditheredCanvasRef.current = result.canvasId;
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  // --- Phase 4: Laser Commands ---
  const handleConnect = async () => {
    setError(null);
    try {
      if (isConnected) {
        await laserRef.current.disconnect();
        setIsConnected(false);
      } else {
        await laserRef.current.connect();
        setIsConnected(true);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const handleTestRun = async () => {
    if (!isConnected || !ditheredCanvasRef.current) return;
    // Test: Fährt das Muster ohne Laser Power (S0)
    setIsEngraving(true);
    setEngraveProgress(0);
    const canvas = ditheredCanvasRef.current;
    // Wir erzeugen den Generator
    const iter = gcodeGenerator(canvas, widthMm, laserSpeed, 0); 
    await laserRef.current.startEngraving(iter, canvas.height);
  }

  const handleStartEngraving = async () => {
    if (!isConnected || !ditheredCanvasRef.current) return;
    // Live Run (Laser an)
    setIsEngraving(true);
    setEngraveProgress(0);
    const canvas = ditheredCanvasRef.current;
    
    // Phase 5: Air Assist steuern
    if (airAssist) await laserRef.current.sendImmediate("M8");

    // Phase 5: Multi-Pass Logik
    for (let p = 1; p <= passes; p++) {
        if (!laserRef.current.isStreaming && p > 1) break; // Notstopp catch
        laserRef.current.callbacks.onMessage(`Starte Durchgang ${p} von ${passes}...`);
        
        const iter = gcodeGenerator(canvas, widthMm, laserSpeed, laserPower); 
        await laserRef.current.startEngraving(iter, canvas.height);
    }
    
    if (airAssist) await laserRef.current.sendImmediate("M9");
    setIsEngraving(false);
  }

  // --- Phase 5: Advanced Controls ---
  const handleFraming = async () => {
    if (!isConnected || !ditheredCanvasRef.current) return;
    const canvas = ditheredCanvasRef.current;
    const heightMm = (canvas.height * (widthMm / canvas.width)).toFixed(3);
    const w = widthMm.toFixed(3);
    const feed = 3000;
    
    await laserRef.current.sendImmediate("G21");
    // Laser für Ausrichtung schwach aufwecken (S1 = winziger blauer Punkt, brennt nicht!)
    await laserRef.current.sendImmediate("M3 S1"); 
    await laserRef.current.sendImmediate(`G1 X${w} Y0 F${feed}`);
    await laserRef.current.sendImmediate(`G1 X${w} Y${heightMm} F${feed}`);
    await laserRef.current.sendImmediate(`G1 X0 Y${heightMm} F${feed}`);
    await laserRef.current.sendImmediate(`G1 X0 Y0 F${feed}`);
    await laserRef.current.sendImmediate("M5"); // Sicher abschalten
  }

  const handleSetZero = () => laserRef.current.sendImmediate("G92 X0 Y0");
  const handleGoZero = () => laserRef.current.sendImmediate("G0 X0 Y0 F3000");
  const handleHoming = () => laserRef.current.sendImmediate("$H");
  const handleUnlock = () => laserRef.current.sendImmediate("$X");


  const handleEmergencyStop = () => {
    laserRef.current.stop();
    setIsEngraving(false);
  }

  // --- RENDER ---
  return (
    <div className="app-container">
      <header className="glass-panel header">
        <div className="logo-section">
          <h1>Atomstack / Swiitol Laser AI</h1>
          <span className="badge">Pro</span>
        </div>
        <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>
          ⚙️ API Setup
        </button>
      </header>

      <main className="main-content">
        <section className="glass-panel workspace">
          
          {/* Tabs Control */}
          <div className="tabs-container">
             <button 
               className={`tab-btn ${activeTab === 'text2img' ? 'active' : ''}`}
               onClick={() => { setActiveTab('text2img'); setSourceImageUrl(null); setProcessedImageUrl(null); setError(null); }}
             >
               KI Generierung aus Text
             </button>
             <button 
               className={`tab-btn ${activeTab === 'img2img' ? 'active' : ''}`}
               onClick={() => { setActiveTab('img2img'); setSourceImageUrl(null); setProcessedImageUrl(null); setError(null); }}
             >
               Eigenes Bild hochladen
             </button>
          </div>

          {/* Tab 1: Text to Image */}
          {activeTab === 'text2img' && (
            <div className="prompt-section">
              <h2>Aus dem Nichts ein Motiv erschaffen</h2>
              <div className="input-group">
                <input 
                  type="text" 
                  placeholder="Z.B. Ein majestätischer Löwenkopf im Tribal-Stil"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerateImage()}
                  disabled={isGenerating}
                  className="prompt-input"
                />
                <button 
                  className="primary generate-btn" 
                  onClick={handleGenerateImage}
                  disabled={isGenerating || !prompt.trim()}
                >
                  {isGenerating ? 'Malt...' : '✨ Bild erstellen'}
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Upload Image */}
          {activeTab === 'img2img' && (
            <div className="prompt-section">
              <h2>Lade ein eigenes Bild hoch</h2>
              <p className="tab-desc">Du kannst das hochgeladene Bild sofort rastern ODER es per Befehl von der KI für die Gravur umschreiben lassen!</p>
              
              <div className="upload-area" onClick={() => fileInputRef.current.click()}>
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   accept="image/png, image/jpeg" 
                   style={{display: 'none'}} 
                   onChange={handleFileUpload} 
                 />
                 <span className="upload-icon">📂</span>
                 <span>Klicken um Bild auszuwählen</span>
              </div>

              {sourceImageUrl && (
                <div className="input-group mt-2">
                  <input 
                    type="text" 
                    placeholder="Optionaler Befehl: Z.B. 'Verwandle es in eine Vektorskizze'"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isGenerating}
                    className="prompt-input"
                  />
                  <button 
                    className="primary generate-btn" 
                    onClick={handleProcessUploadedImage}
                    disabled={isGenerating || !prompt.trim()}
                  >
                    {isGenerating ? 'Verarbeitet...' : '🎨 KI-Transformation anwenden'}
                  </button>
                </div>
              )}
            </div>
          )}

          {error && <div className="error-message">Fehler: {error}</div>}

          <div className="separator"></div>

          {/* Darstellungen */}
          <div className="preview-section-grid">
            
            {/* Vorlage (KI oder Upload) */}
            <div className="preview-col">
              {!sourceImageUrl && !isGenerating && (
                <div className="empty-state">
                  <div className="placeholder-box"><span className="icon">{activeTab === 'text2img' ? '🎨' : '🖼️'}</span></div>
                  <p className="hint">Dein Bild-Modell erscheint hier.</p>
                </div>
              )}

              {isGenerating && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>KI arbeitet an deinem Motiv...</p>
                </div>
              )}

              {sourceImageUrl && !isGenerating && (
                <div className="result-card">
                  <h3>Originalvorlage</h3>
                  <img src={sourceImageUrl} alt="Source" className="generated-image" />
                </div>
              )}
            </div>

            {/* Dithering / Rasterung (Phase 3) */}
            {sourceImageUrl && (
              <div className="preview-col process-panel">
                <h3>Vorbereitung für Gravur</h3>
                <div className="form-group inline-form">
                  <label>Wunschgröße in mm (Breite):</label>
                  <input 
                    type="number" 
                    value={widthMm} 
                    onChange={(e) => setWidthMm(parseFloat(e.target.value) || 100)}
                    min="10" 
                    max="500" 
                    className="size-input"
                    disabled={isProcessing || isEngraving}
                  />
                </div>
                
                <button 
                  className="primary full-width" 
                  onClick={handleDithering}
                  disabled={isProcessing || isEngraving}
                >
                  {isProcessing ? 'Rastert...' : '⚙️ Für Laser Rastern (Dithering)'}
                </button>

                {processedImageUrl && (
                   <div className="result-card mt-2">
                     <p className="success-hint">✅ {processInfo}</p>
                     <img src={processedImageUrl} alt="Dithered for Laser" className="generated-image pixelated" />
                   </div>
                )}
              </div>
            )}
            
          </div>

          {/* --- PHASE 4: LASER CONTROL PANEL --- */}
          {processedImageUrl && (
            <div className="laser-control-panel fade-in">
              <div className="separator"></div>
              <h2>Laser Control Center</h2>
              
              <div className="laser-grid">
                
                <div className="laser-settings glass-panel">
                  <h3>Hardware Parametrierung</h3>
                  <div className="form-group">
                    <label>Geschwindigkeit (Feedrate F, mm/min):</label>
                    <input type="number" value={laserSpeed} onChange={(e)=>setLaserSpeed(parseFloat(e.target.value) || 1000)} disabled={isEngraving} />
                    <small>Empfehlung E18 Pro: 20.000 bis 36.000 (Zick-Zack Highspeed)</small>
                  </div>
                  <div className="form-group">
                    <label>Laser Stärke (Spindle S, 0-1000):</label>
                    <input type="number" value={laserPower} onChange={(e)=>setLaserPower(parseFloat(e.target.value) || 0)} disabled={isEngraving} />
                    <small>Je nach Holz z.B. 600 - 800 für kräftiges Schwarz.</small>
                  </div>
                  <div className="form-group inline-form" style={{marginBottom: 0}}>
                    <label>Durchgänge (Multi-Pass):</label>
                    <input type="number" value={passes} onChange={(e)=>setPasses(parseInt(e.target.value) || 1)} min="1" max="10" className="size-input" disabled={isEngraving} />
                  </div>
                  <div className="form-group inline-form mt-2">
                    <label>Air Assist Pumpe (Luft):</label>
                    <input type="checkbox" checked={airAssist} onChange={(e)=>setAirAssist(e.target.checked)} disabled={isEngraving} />
                  </div>
                  
                  <div className="actions mt-2">
                    <button className={isConnected ? "danger full-width" : "primary full-width"} onClick={handleConnect} disabled={isEngraving}>
                      {isConnected ? "🔌 USB Trennen" : "🔌 Verbinde Laser via Web Serial"}
                    </button>
                  </div>
                </div>

                <div className="laser-execution glass-panel">
                  <h3>Steuerung & Terminal</h3>
                  
                  <div className="control-buttons">
                    <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem'}}>
                       <button onClick={handleSetZero} disabled={!isConnected || isEngraving} title="Setzt aktuelle Position als X0 Y0">📍 Set Zero</button>
                       <button onClick={handleGoZero} disabled={!isConnected || isEngraving} title="Fährt zu X0 Y0">🏠 Go to Zero</button>
                       <button onClick={handleHoming} disabled={!isConnected || isEngraving} title="Hardware Homing via Endschalter">🔄 Homing ($H)</button>
                       <button onClick={handleUnlock} disabled={!isConnected || isEngraving} title="Entsperrt GRBL nach Fehlern">🔓 Unlock ($X)</button>
                    </div>

                    <button className="settings-btn" onClick={handleFraming} disabled={!isConnected || isEngraving} style={{marginBottom: '0.5rem'}}>
                      📐 Framing (Außenrand abfahren zur Holzausrichtung)
                    </button>
                    
                    <button className="primary" onClick={handleTestRun} disabled={!isConnected || isEngraving}>
                      🔰 Trockenlauf (Test mit Laser aus, S0)
                    </button>
                    <button className="danger" onClick={handleStartEngraving} disabled={!isConnected || isEngraving}>
                      🔥 LASER STARTEN (Ernstfall)
                    </button>
                    {isEngraving && (
                      <button className="danger blink" onClick={handleEmergencyStop}>
                        🛑 NOTSTOPP
                      </button>
                    )}
                  </div>

                  <div className="progress-container mt-2">
                     <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${engraveProgress}%` }}></div>
                     </div>
                     <p className="progress-text">{engraveProgress}% Sendevorgang abgeschlossen</p>
                  </div>

                  <div className="terminal mt-2">
                     {laserLogs.map((log, i) => (
                       <pre key={i}>{log}</pre>
                     ))}
                     <pre className="blink cursor">_</pre>
                  </div>

                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2>API Einstellungen</h2>
            <p>Du kannst die <strong>.env</strong> Datei nutzen (`VITE_HF_API_KEY=...`) oder den Key hier temporär speichern.</p>
            
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label htmlFor="apiKey">Hugging Face Access Token</label>
                <input 
                  type="password" 
                  id="apiKey"
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder="hf_..."
                  required={!envApiKey}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsSettingsOpen(false)} style={{background: 'transparent', border: '1px solid var(--panel-border)', color: 'white'}}>Schließen</button>
                <button type="submit" className="primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
