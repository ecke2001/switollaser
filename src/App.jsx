import { useState, useEffect, useRef } from 'react'
import { processImageForLaser } from './utils/dithering'
import { HfInference } from '@huggingface/inference'
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
    
    // Setze das Bild sofort als Source (damit kann man es auch OHNE KI sofort lasern/dithern)
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
      console.log('Starte Image-to-Image');
      
      // Umwandeln der URL in ein echtes Blob für die API
      const imageResponse = await fetch(sourceImageUrl);
      const imageBlob = await imageResponse.blob();

      // Das beste kostenlose Modell für textbasierte Bild-Veränderung bei HF
      const resultBlob = await hf.imageToImage({
        model: 'timbrooks/instruct-pix2pix',
        inputs: imageBlob,
        parameters: { prompt: prompt }
      });
      
      setSourceImageUrl(URL.createObjectURL(resultBlob));
      setProcessedImageUrl(null);
    } catch (err) {
      setError(`Img2Img Fehler: ${err.message}. (Hinweis: Kostenlose Img-2-Img Modelle sind manchmal wegen Overload nicht erreichbar)`);
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
      setProcessInfo(`Gerastert auf ${result.widthPx} x ${result.heightPx} Pixel (0.08mm)`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

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
              <p className="tab-desc">Du kannst das hochgeladene Bild sofort rastern (rechts unten) ODER es per Extra-Befehl von der KI für die Gravur umschreiben lassen!</p>
              
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
                    placeholder="Optionaler KI-Befehl: Z.B. 'Verwandle es in eine simple Bleistiftskizze'"
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
                  />
                </div>
                
                <button 
                  className="primary full-width" 
                  onClick={handleDithering}
                  disabled={isProcessing}
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
