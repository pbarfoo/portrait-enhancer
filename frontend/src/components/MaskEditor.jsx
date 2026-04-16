import React, { useRef, useState, useEffect } from 'react';
import { X, Check, Trash2, Brush, Undo2, Redo2 } from 'lucide-react';

const MaskEditor = ({ imageSrc, onSave, onCancel }) => {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  
  // History State for Undo/Redo
  const [history, setHistory] = useState([]);
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const handleResize = () => {
      // Handle resize if necessary
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const saveState = (canvas) => {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, step + 1);
    newHistory.push(data);
    setHistory(newHistory);
    setStep(newHistory.length - 1);
  };

  const undo = () => {
    if (step > 0) {
      const newStep = step - 1;
      setStep(newStep);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(history[newStep], 0, 0);
    }
  };

  const redo = () => {
    if (step < history.length - 1) {
      const newStep = step + 1;
      setStep(newStep);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(history[newStep], 0, 0);
    }
  };

  const initCanvas = (e) => {
    const img = e.target;
    const canvas = canvasRef.current;
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Save empty state
    saveState(canvas);
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'; // Red
    ctx.lineWidth = brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.closePath();
    
    saveState(canvas);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState(canvas);
  };

  const saveMask = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    
    const currentData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const exportData = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
    
    for (let i = 0; i < currentData.data.length; i += 4) {
        if (currentData.data[i + 3] > 0) {
            exportData.data[i] = 255;
            exportData.data[i + 1] = 255;
            exportData.data[i + 2] = 255;
        }
    }
    
    ctx.putImageData(exportData, 0, 0);
    const maskBase64 = exportCanvas.toDataURL('image/png');
    onSave(maskBase64);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(250,250,250,0.95)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}>
      
      {/* TOOLBAR */}
      <div style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center gap-4 text-black">
            <Brush size={20} />
            <span className="font-bold tracking-widest uppercase text-xs">AI Inpaint Studio</span>
            <div style={{ width: '1px', height: '24px', background: 'var(--border-strong)', margin: '0 1rem' }} />
            
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted uppercase tracking-widest">Brush Size</span>
                <input 
                    type="range" min="5" max="100" value={brushSize} 
                    onChange={e => setBrushSize(parseInt(e.target.value))}
                    style={{ width: '120px' }} 
                />
            </div>
            
            <div style={{ width: '1px', height: '24px', background: 'var(--border-strong)', margin: '0 1rem' }} />
            
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={undo} disabled={step <= 0} title="Undo">
                <Undo2 size={16} />
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={redo} disabled={step >= history.length - 1} title="Redo">
                <Redo2 size={16} />
            </button>
        </div>

        <div className="flex gap-4">
            <button className="btn btn-secondary" style={{ color: '#ef4444', borderColor: '#fecaca' }} onClick={clearCanvas}>
                <Trash2 size={16} /> Clear Mask
            </button>
            <button className="btn btn-secondary" onClick={onCancel}>
                <X size={16} /> Cancel
            </button>
            <button className="btn" onClick={saveMask} title="Save this mask">
                <Check size={16} /> Save Mask
            </button>
        </div>
      </div>

      {/* CANVAS AREA */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '2rem' }}>
          <div style={{ position: 'relative', display: 'inline-block', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
            <img 
              ref={imgRef}
              src={imageSrc} 
              alt="Background to mask" 
              onLoad={initCanvas}
              style={{ display: 'block', width: 'auto', height: 'auto', maxHeight: 'calc(100vh - 150px)', maxWidth: '100%', userSelect: 'none', pointerEvents: 'none' }} 
            />
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%', height: '100%',
                cursor: 'crosshair'
              }}
            />
          </div>
      </div>

      <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '0.75rem 2rem', borderRadius: '30px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <span className="text-black text-xs font-bold tracking-widest uppercase">Paint over blemishes or stray hairs to erase them flawlessly</span>
      </div>
    </div>
  );
};

export default MaskEditor;
