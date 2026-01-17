
import React, { useState, useRef, useEffect } from 'react';

interface ComparisonSliderProps {
  original: string;
  result: string;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ original, result }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  const onMouseDown = () => setIsDragging(true);
  const onMouseUp = () => setIsDragging(false);
  const onMouseMove = (e: React.MouseEvent) => isDragging && handleMove(e.clientX);
  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);

  useEffect(() => {
    const endDrag = () => setIsDragging(false);
    window.addEventListener('mouseup', endDrag);
    return () => window.removeEventListener('mouseup', endDrag);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl group select-none cursor-ew-resize"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onTouchMove={onTouchMove}
      onTouchStart={() => setIsDragging(true)}
      onTouchEnd={() => setIsDragging(false)}
    >
      {/* Background (Original) */}
      <img 
        src={original} 
        alt="Original"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
        Original
      </div>

      {/* Foreground (Result) */}
      <div 
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <img 
          src={result} 
          alt="AI Styled"
          className="absolute inset-0 h-full object-cover"
          style={{ width: `${100 / (sliderPosition / 100)}%`, maxWidth: 'none' }}
        />
        <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-full bg-primary/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
          AI Style
        </div>
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 z-30 w-0.5 bg-white shadow-xl flex items-center justify-center -translate-x-1/2"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="size-10 rounded-full bg-white shadow-lg flex items-center justify-center text-primary border-4 border-white/30 backdrop-blur-sm">
          <span className="material-symbols-outlined text-xl">unfold_more</span>
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center z-10 pointer-events-none">
        <p className="inline-block px-4 py-1.5 rounded-full bg-black/30 backdrop-blur-md text-white text-xs font-medium animate-pulse">
          Drag to compare
        </p>
      </div>
    </div>
  );
};

export default ComparisonSlider;
