import React, { useState, useEffect, useRef } from 'react';
import { Upload, Sparkles, Download, X, RefreshCw, Layers, CheckCircle2, Clock, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import ImageComparison from './components/ImageComparison';

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
  const [isCancelled, setIsCancelled] = useState(false);
  const currentSocketRef = useRef(null);
  
  const currentItem = currentIndex !== null ? queue[currentIndex] : null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (droppedFiles.length > 0) {
      const newItems = droppedFiles.map((file, idx) => ({
        id: Date.now() + idx,
        file,
        preview: URL.createObjectURL(file),
        enhanced: null,
        progress: 0,
        status: 'Pending',
        isProcessing: false,
        error: null
      }));
      setQueue(prev => [...prev, ...newItems]);
      if (currentIndex === null) setCurrentIndex(0);
    }
  };

  const handleUpload = (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length > 0) {
      const newItems = uploadedFiles.map((file, idx) => ({
        id: Date.now() + idx,
        file,
        preview: URL.createObjectURL(file),
        enhanced: null,
        progress: 0,
        status: 'Pending',
        isProcessing: false,
        error: null
      }));
      setQueue(prev => [...prev, ...newItems]);
      if (currentIndex === null) setCurrentIndex(0);
    }
  };

  const updateQueueItem = (id, updates) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const processSingleImage = (index) => {
    return new Promise((resolve, reject) => {
      const item = queue[index];
      if (!item || item.enhanced) {
        resolve();
        return;
      }

      updateQueueItem(item.id, { isProcessing: true, status: 'Connecting...', progress: 0 });

      const reader = new FileReader();
      reader.readAsDataURL(item.file);
      reader.onload = () => {
        const socket = new WebSocket('ws://localhost:8000/ws/enhance');

        socket.onopen = () => {
          currentSocketRef.current = socket;
          socket.send(JSON.stringify({
            image: reader.result,
            fidelity: fidelity,
            remove_bg: removeBg,
            remove_glare: removeGlare,
            upscale: upscale,
            grain: grain
          }));
        };

        socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.progress !== undefined) {
            updateQueueItem(item.id, { progress: data.progress, status: data.status || 'Processing...' });
          }
          
          if (data.image) {
            updateQueueItem(item.id, { enhanced: data.image, isProcessing: false, status: 'Done', progress: 100 });
            currentSocketRef.current = null;
            socket.close();
            resolve();
          }

          if (data.error) {
            updateQueueItem(item.id, { error: data.status, isProcessing: false, status: 'Error' });
            currentSocketRef.current = null;
            socket.close();
            resolve();
          }
        };

        socket.onclose = () => {
          currentSocketRef.current = null;
          updateQueueItem(item.id, { isProcessing: false });
          resolve();
        };

        socket.onerror = () => {
          updateQueueItem(item.id, { error: 'Connection failed', isProcessing: false, status: 'Failed' });
          currentSocketRef.current = null;
          resolve();
        };
      };
    });
  };

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setIsCancelled(false);
    
    for (let i = 0; i < queue.length; i++) {
      if (isCancelled) break;
      if (!queue[i].enhanced) {
        setCurrentIndex(i);
        await processSingleImage(i);
      }
    }
    
    setIsProcessing(false);
    setIsCancelled(false);
  };

  const cancelProcessing = () => {
    setIsCancelled(true);
    if (currentSocketRef.current) {
      currentSocketRef.current.close();
    }
    if (currentItem) {
      updateQueueItem(currentItem.id, { isProcessing: false, status: 'Stopped' });
    }
    setIsProcessing(false);
  };

  const saveAll = () => {
    queue.filter(item => item.enhanced).forEach((item, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = item.enhanced;
        a.download = `sharpened-${idx + 1}-${(fidelity * 100).toFixed(0)}${upscale > 1 ? '-HD' : ''}${removeBg ? '-whitebg' : ''}.png`;
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

  return (
    <div className="main-container" style={{ maxWidth: queue.length > 0 ? '1400px' : '800px' }}>
      <header>
        <h1>Portrait <span style={{ color: 'var(--text-light)' }}>Sharpener</span></h1>
        {queue.length > 0 && <span className="text-xs font-bold uppercase tracking-widest text-muted" style={{ marginLeft: '1rem' }}>Bulk Studio</span>}
      </header>

      {queue.length === 0 ? (
        <div 
          className="uploader-box" 
          onClick={() => document.getElementById('inp').click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={isDragging ? { borderColor: '#000', background: '#f4f4f5' } : {}}
        >
          <Upload size={32} style={{ color: isDragging ? '#000' : '#a1a1aa', marginBottom: '1.5rem', transition: 'all 0.3s' }} />
          <h3>{isDragging ? 'Drop Portraits Here' : 'Select Portraits'}</h3>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>Upload or drag-and-drop multiple images for batch sharpening</p>
          <input id="inp" type="file" hidden multiple onChange={handleUpload} accept="image/*" />
        </div>
      ) : (
        <div className="queue-container">
          {/* SIDEBAR QUEUE */}
          <div 
            className="queue-sidebar"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={isDragging ? { borderColor: '#000', backgroundColor: '#f8fafc' } : {}}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-muted">Queue ({queue.length})</span>
              <button className="text-xs font-bold text-muted hover-primary" onClick={clearQueue}>Clear All</button>
            </div>
            
            <div className="queue-list">
              {queue.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={`queue-item ${currentIndex === idx ? 'active' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                >
                  <img src={item.preview} className="queue-node-thumbnail" alt="preview" />
                  <div className="flex-col" style={{ flex: 1, overflow: 'hidden' }}>
                    <span className="text-xs font-bold truncate" style={{ maxWidth: '160px' }}>{item.file.name}</span>
                    <div className="flex items-center gap-2 mt-2">
                       <span className={`status-dot ${item.status === 'Done' ? 'done' : item.isProcessing ? 'processing' : 'pending'}`} />
                       <span className="text-xs text-muted font-medium">{item.status}</span>
                    </div>
                    {item.isProcessing && (
                       <div className="progress-track mt-2" style={{ height: '4px' }}>
                         <div className="progress-fill" style={{ width: `${item.progress}%` }} />
                       </div>
                    )}
                  </div>
                  {item.enhanced && (
                    <div className="flex items-center">
                      <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button className="btn mt-4" onClick={() => document.getElementById('inp-add').click()}>
              Add More Photos
              <input id="inp-add" type="file" hidden multiple onChange={handleUpload} accept="image/*" />
            </button>
          </div>

          {/* MAIN PLAYER */}
          <div className="flex-col">
            <div style={{ position: 'relative', width: '100%', minHeight: '400px' }}>
              {currentItem && (
                <ImageComparison
                  before={currentItem.preview}
                  after={currentItem.enhanced || currentItem.preview}
                />
              )}
              
              {currentItem?.isProcessing && (
                <div className="progress-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, borderRadius: '12px' }}>
                  <div style={{ width: '100%', maxWidth: '240px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted">{currentItem.status}</span>
                      <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{currentItem.progress}%</span>
                    </div>
                    <div className="progress-track">
                       <div className="progress-fill" style={{ width: `${currentItem.progress}%` }} />
                    </div>
                    
                    <button 
                      onClick={cancelProcessing}
                      className="btn btn-secondary mt-4" 
                      style={{ width: '100%', borderColor: '#fecaca', color: '#ef4444' }}
                    >
                      <X size={14} /> Stop Processing
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="controls-card mt-8">
              <div className="control-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="font-bold uppercase tracking-widest" style={{ fontSize: '10px', color: 'var(--text-light)' }}>Sharpening Level</label>
                    <span className="font-bold" style={{ color: 'var(--primary)', fontSize: '12px' }}>{(fidelity * 100).toFixed(0)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.05" 
                    value={fidelity} 
                    onChange={(e) => setFidelity(parseFloat(e.target.value))}
                  />
              </div>

              <div className="control-group">
                  <label className="flex items-center gap-4 cursor-pointer">
                      <input 
                          type="checkbox" checked={removeBg} 
                          onChange={(e) => setRemoveBg(e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                      />
                      <div className="flex flex-col">
                          <span className="font-bold uppercase tracking-widest" style={{ fontSize: '10px', color: 'var(--text-light)' }}>Studio White Background</span>
                          <span className="text-xs text-muted" style={{ marginTop: '0.1rem' }}>Isolate portrait with pure white finish</span>
                      </div>
                  </label>
              </div>

              {/* ADVANCED TUNING DRAWER */}
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid #f1f5f9' }}>
                <button 
                  className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted hover-primary"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0', width: '100%' }}
                >
                  <div className="flex items-center gap-2">
                    <Sliders size={14} />
                    <span>Advanced High-Fidelity Tuning</span>
                  </div>
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showAdvanced && (
                   <div className="mt-6 flex-col gap-6">
                      <div className="control-group">
                        <label className="flex items-center gap-4 cursor-pointer">
                            <input 
                                type="checkbox" checked={removeGlare} 
                                onChange={(e) => setRemoveGlare(e.target.checked)}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                            />
                            <div className="flex flex-col">
                                <span className="font-bold uppercase tracking-widest" style={{ fontSize: '10px', color: 'var(--text-light)' }}>Optical Glare Removal</span>
                                <span className="text-xs text-muted" style={{ marginTop: '0.1rem' }}>Erase glasses glare and AI reconstruct eyes</span>
                            </div>
                        </label>
                      </div>

                      <div className="control-group">
                        <label className="flex items-center gap-4 cursor-pointer">
                            <input 
                                type="checkbox" checked={upscale === 2} 
                                onChange={(e) => setUpscale(e.target.checked ? 2 : 1)}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                            />
                            <div className="flex flex-col">
                                <span className="font-bold uppercase tracking-widest" style={{ fontSize: '10px', color: 'var(--text-light)' }}>2x AI HD Mode</span>
                                <span className="text-xs text-muted" style={{ marginTop: '0.1rem' }}>Double the final resolution for massive detail</span>
                            </div>
                        </label>
                      </div>

                      <div className="control-group mt-4">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="flex flex-col">
                            <span className="font-bold uppercase tracking-widest" style={{ fontSize: '10px', color: 'var(--text-light)' }}>Portrait Texture (Grain)</span>
                            <span className="text-xs text-muted" style={{ marginTop: '0.1rem' }}>Filmic grain for professional, non-plasticky skin</span>
                          </div>
                          <span className="font-bold" style={{ color: 'var(--primary)', fontSize: '12px' }}>{(grain * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="0.5" step="0.01" 
                          value={grain} 
                          onChange={(e) => setGrain(parseFloat(e.target.value))}
                        />
                      </div>
                   </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button
                  className="btn" style={{ flex: 1.5 }}
                  onClick={processAll}
                  disabled={isProcessing || queue.every(i => i.enhanced)}
                >
                  <Sparkles size={16} /> {isProcessing ? 'Processing...' : queue.length > 1 ? 'Process Batch' : 'Process'}
                </button>
                
                {queue.some(i => i.enhanced) && (
                  <button className="btn btn-secondary" onClick={saveAll}>
                    <Download size={16} /> Save All
                  </button>
                )}
                
                <button className="btn btn-secondary" onClick={() => removeItem(currentItem.id)}>
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

export default App;
