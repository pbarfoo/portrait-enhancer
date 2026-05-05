import React, { useState, useRef } from 'react';

const ImageComparison = ({ before, after }) => {
  const [position, setPosition] = useState(50);
  const containerRef = useRef(null);

  const handleMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const offset = ((x - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, offset)));
  };

  return (
    <div 
      ref={containerRef}
      className="comparison-container"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {/* AFTER (ENHANCED) */}
      <img src={after} alt="Enhanced" className="img-layer" />

      {/* BEFORE (ORIGINAL) */}
      <div 
        className="img-layer original-overlay"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img src={before} alt="Original" className="img-layer" />
      </div>

      {/* SLIDER BAR */}
      <div className="slider-line" style={{ left: `${position}%` }}>
        <div className="slider-button" />
      </div>

      {/* SIMPLE LABELS */}
      <div className="label-overlay left">Before</div>
      <div className="label-overlay right">After</div>
    </div>
  );
};

export default ImageComparison;
