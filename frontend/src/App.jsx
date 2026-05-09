import React, { useState, useRef } from 'react';
import { Upload, Sparkles, Download, X, CheckCircle2, ChevronDown, ChevronUp, Sliders, Brush, StopCircle, Zap, Eye, Layers } from 'lucide-react';
import ImageComparison from './components/ImageComparison';
import MaskEditor from './components/MaskEditor';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/enhance`;

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="toggle-track" />
    </label>
  );
}

function App() {
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fidelity, setFidelity] = useState(0.5);
  const [removeBg, setRemoveBg] = useState(false);
  const [upscale, setUpscale] = useState(1);
  const [grain, setGrain] = useState(0.15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [removeGlare, setRemoveGlare] = useState(false);
  const [showMaskEditor, setShowMaskEditor] = useState(false);

  const cancelRef = useRef(false);
  const currentItem = currentIndex !== null ? queue[currentIndex] : null;

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  const filterFiles = (files) => {
    const oversized = [], valid = [];
    files.forEach(f => (f.size > MAX_FILE_BYTES ? oversized : valid).push(f));
    if (oversized.length > 0) alert(`${oversized.map(f => f.name).join(', ')} exceed 50 MB and were skipped.`);
    return valid;
  };

  const addFiles = (files) => {
    if (files.length === 0) return;
    const newItems = files.map((file, idx) => ({
      id: Date.now() + idx,
      file,
      preview: URL.createObjectURL(file),
      enhanced: null,
      progress: 0,
      status: 'Pending',
      isProcessing: false,
      error: null,
    }));
    setQueue(prev => {
      if (currentIndex === null) setCurrentIndex(0);
      return [...prev, ...newItems];
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(filterFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))));
  };

  const handleUpload = (e) => {
    addFiles(filterFiles(Array.from(e.target.files)));
    e.target.value = '';
  };

  const updateQueueItem = (id, updates) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const processSingleImage = (index) => {
    return new Promise((resolve) => {
      const item = queue[index];
      if (!item || item.enhanced) { resolve(); return; }

      updateQueueItem(item.id, { isProcessing: true, status: 'Connecting...', progress: 0 });

      const reader = new FileReader();
      reader.readAsDataURL(item.file);
      reader.onload = () => {
        let attempts = 0;
        const maxAttempts = 3;

        const connect = () => {
          if (cancelRef.current) {
            updateQueueItem(item.id, { isProcessing: false, status: 'Cancelled' });
            resolve();
            return;
          }

          const socket = new WebSocket(WS_URL);
          let settled = false;

          const settle = (updates) => {
            if (settled) return;
            settled = true;
            socket.close();
            updateQueueItem(item.id, { isProcessing: false, ...updates });
            resolve();
          };

          socket.onopen = () => {
            socket.send(JSON.stringify({
              image: reader.result,
              custom_mask: item.customMask || null,
              fidelity,
              remove_bg: removeBg,
              remove_glare: removeGlare,
              upscale,
              grain,
            }));
          };

          socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.progress !== undefined) {
              updateQueueItem(item.id, { progress: data.progress, status: data.status || 'Processing...' });
            }
            if (data.image) settle({ enhanced: data.image, status: 'Done', progress: 100 });
            if (data.error) settle({ error: data.status, status: 'Error' });
          };

          socket.onerror = () => {
            attempts++;
            if (attempts < maxAttempts && !cancelRef.current) {
              const delay = Math.pow(2, attempts) * 1000;
              updateQueueItem(item.id, { status: `Retrying in ${delay / 1000}s...` });
              setTimeout(connect, delay);
            } else {
              settle({ error: 'Connection failed', status: 'Failed' });
            }
          };
        };

        connect();
      };
    });
  };

  const processAll = async () => {
    if (isProcessing) return;
    cancelRef.current = false;
    setIsProcessing(true);
    for (let i = 0; i < queue.length; i++) {
      if (cancelRef.current) break;
      if (!queue[i].enhanced) {
        setCurrentIndex(i);
        await processSingleImage(i);
      }
    }
    cancelRef.current = false;
    setIsProcessing(false);
  };

  const cancelProcessing = () => { cancelRef.current = true; };

  const saveAll = () => {
    queue.filter(item => item.enhanced).forEach((item, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = item.enhanced;
        a.download = `portrait-${idx + 1}-${(fidelity * 100).toFixed(0)}pct${upscale > 1 ? '-2x' : ''}${removeBg ? '-whitebg' : ''}.png`;
        a.click();
      }, idx * 400);
    });
  };

  const clearQueue = () => {
    queue.forEach(item => URL.revokeObjectURL(item.preview));
    setQueue([]);
    setCurrentIndex(null);
  };

  const removeItem = (id) => {
    const item = queue.find(i => i.id === id);
    if (item) URL.revokeObjectURL(item.preview);
    const newQueue = queue.filter(i => i.id !== id);
    setQueue(newQueue);
    if (newQueue.length === 0) setCurrentIndex(null);
    else if (currentIndex >= newQueue.length) setCurrentIndex(newQueue.length - 1);
  };

  const statusDotClass = (item) => {
    if (item.status === 'Done') return 'done';
    if (item.isProcessing) return 'processing';
    if (item.status === 'Error' || item.status === 'Failed') return 'error';
    return 'pending';
  };

  return (
    <div className="main-container" style={{ maxWidth: queue.length > 0 ? '1340px' : '820px' }}>
      <header>
        <div className="header-logo">
          <Sparkles size={20} color="white" />
        </div>
        <h1>Chroma <span style={{ color: 'var(--text-light)', fontWeight: 500 }}>Studio</span></h1>
        <span className="header-sub">AI Portrait Enhancement</span>
      </header>

      {queue.length === 0 ? (
        <div
          className="uploader-box"
          onClick={() => document.getElementById('inp').click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={isDragging ? { borderColor: 'var(--primary)', background: '#f9f9fb', boxShadow: 'var(--shadow-md)' } : {}}
        >
          <Upload size={28} style={{ color: isDragging ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '1rem', transition: 'color 0.2s' }} />
          <h3>{isDragging ? 'Drop portraits here' : 'Select portraits'}</h3>
          <p>Drag & drop or click to upload — supports batch processing</p>
          <div className="upload-features">
            <span className="upload-feature-pill"><Zap size={11} /> Face Restoration</span>
            <span className="upload-feature-pill"><Eye size={11} /> Glare Removal</span>
            <span className="upload-feature-pill"><Layers size={11} /> 2× HD Upscale</span>
          </div>
          <input id="inp" type="file" hidden multiple onChange={handleUpload} accept="image/*" />
        </div>
      ) : (
        <div className="queue-container">
          {/* SIDEBAR */}
          <div className="queue-sidebar">
            <div className="sidebar-header">
              <div className="flex items-center">
                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-light)' }}>
                  Queue
                </span>
                <span className="sidebar-count">{queue.length}</span>
              </div>
              <button
                onClick={clearQueue}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'inherit', padding: 0 }}
                className="advanced-toggle-btn"
              >
                Clear all
              </button>
            </div>

            <div className="queue-list">
              {queue.map((item, idx) => (
                <div
                  key={item.id}
                  className={`queue-item ${currentIndex === idx ? 'active' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                >
                  <img src={item.preview} className="queue-node-thumbnail" alt="preview" />
                  <div className="queue-item-info">
                    <div className="queue-item-name">{item.file.name}</div>
                    <div className="status-chip">
                      <span className={`status-dot ${statusDotClass(item)}`} />
                      {item.status}
                    </div>
                    {item.isProcessing && (
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}
                  </div>
                  {item.enhanced && <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />}
                </div>
              ))}
            </div>

            <div className="sidebar-footer">
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => document.getElementById('inp-add').click()}>
                <Upload size={14} /> Add photos
                <input id="inp-add" type="file" hidden multiple onChange={handleUpload} accept="image/*" />
              </button>
            </div>
          </div>

          {/* MAIN VIEWER */}
          <div className="flex-col gap-4">
            <div style={{ position: 'relative', width: '100%' }}>
              {currentItem && (
                <ImageComparison
                  before={currentItem.preview}
                  after={currentItem.enhanced || currentItem.preview}
                  customMask={currentItem.customMask}
                />
              )}

              {currentItem?.isProcessing && (
                <div className="progress-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, borderRadius: 'var(--radius)' }}>
                  <div style={{ width: '200px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-light)' }}>
                      {currentItem.status}
                    </p>
                    <div className="progress-track" style={{ height: '5px' }}>
                      <div className="progress-fill" style={{ width: `${currentItem.progress}%`, background: 'var(--primary)' }} />
                    </div>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{currentItem.progress}%</p>
                  </div>
                </div>
              )}
            </div>

            {/* CONTROLS */}
            <div className="controls-card">
              {/* Sharpening */}
              <div className="control-group">
                <div className="flex justify-between items-center">
                  <span className="control-label">Sharpening Level</span>
                  <span className="control-value">{(fidelity * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fidelity} onChange={e => setFidelity(parseFloat(e.target.value))} />
              </div>

              <div className="section-divider" />

              {/* White Background */}
              <label className="toggle-row" style={{ cursor: 'pointer' }}>
                <div className="toggle-text">
                  <span className="control-label">Studio White Background</span>
                  <span className="toggle-desc">Isolate subject on pure white</span>
                </div>
                <Toggle checked={removeBg} onChange={e => setRemoveBg(e.target.checked)} />
              </label>

              {/* Advanced drawer */}
              <div className="section-divider" />

              <button className="advanced-toggle-btn" onClick={() => setShowAdvanced(!showAdvanced)}>
                <div className="flex items-center gap-2">
                  <Sliders size={13} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Advanced Options</span>
                </div>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showAdvanced && (
                <div className="flex-col gap-6">
                  <label className="toggle-row" style={{ cursor: 'pointer' }}>
                    <div className="toggle-text">
                      <span className="control-label">Optical Glare Removal</span>
                      <span className="toggle-desc">Remove glasses glare & reconstruct eyes</span>
                    </div>
                    <Toggle checked={removeGlare} onChange={e => setRemoveGlare(e.target.checked)} />
                  </label>

                  <label className="toggle-row" style={{ cursor: 'pointer' }}>
                    <div className="toggle-text">
                      <span className="control-label">2× AI HD Mode</span>
                      <span className="toggle-desc">Double resolution for maximum detail</span>
                    </div>
                    <Toggle checked={upscale === 2} onChange={e => setUpscale(e.target.checked ? 2 : 1)} />
                  </label>

                  <div className="control-group">
                    <div className="flex justify-between items-center">
                      <div className="toggle-text">
                        <span className="control-label">Filmic Grain</span>
                        <span className="toggle-desc">Adds natural texture to avoid AI look</span>
                      </div>
                      <span className="control-value">{(grain * 100).toFixed(0)}%</span>
                    </div>
                    <input type="range" min="0" max="0.5" step="0.01" value={grain} onChange={e => setGrain(parseFloat(e.target.value))} />
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="section-divider" />

              <div className="flex gap-2">
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={isProcessing ? cancelProcessing : processAll}
                  disabled={!isProcessing && queue.every(i => i.enhanced)}
                >
                  {isProcessing
                    ? <><StopCircle size={15} /> Cancel</>
                    : <><Sparkles size={15} /> Enhance All</>}
                </button>

                {queue.some(i => i.enhanced) && (
                  <button className="btn btn-secondary" onClick={saveAll} title="Download all enhanced">
                    <Download size={15} /> Save
                  </button>
                )}

                {currentItem && !currentItem.enhanced && !isProcessing && (
                  <button className="btn btn-secondary btn-icon" onClick={() => setShowMaskEditor(true)} title="Draw inpainting mask">
                    <Brush size={15} />
                  </button>
                )}

                {currentItem && (
                  <button className="btn btn-secondary btn-icon btn-danger" onClick={() => removeItem(currentItem.id)} title="Remove image">
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showMaskEditor && currentItem && (
        <MaskEditor
          imageSrc={currentItem.preview}
          onSave={(maskBase64) => {
            updateQueueItem(currentItem.id, { customMask: maskBase64 });
            setShowMaskEditor(false);
          }}
          onCancel={() => setShowMaskEditor(false)}
        />
      )}
    </div>
  );
}

export default App;
