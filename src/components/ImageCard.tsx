'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Download,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { ProcessedImage, Selection } from '@/types';
import { downloadImage } from '@/lib/watermark-remover';

interface ImageCardProps {
  image: ProcessedImage;
  onRemove: (id: string) => void;
  onSelectionChange: (id: string, selection: Selection | null) => void;
  onProcess: (id: string) => void;
}

/**
 * Displays an image, selection controls, and processing status.
 */
export default function ImageCard({
  image,
  onRemove,
  onSelectionChange,
  onProcess,
}: ImageCardProps) {
  const [zoom, setZoom] = useState(1);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draw image and selection on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image.originalUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * zoom;
      canvas.height = img.height * zoom;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw the appropriate image (processed or original)
      if (showComparison && image.processedUrl) {
        const processedImg = new Image();
        processedImg.onload = () => {
          ctx.drawImage(processedImg, 0, 0, canvas.width, canvas.height);
        };
        processedImg.src = image.processedUrl;
      } else {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      // Draw selection rectangle
      if (image.selection && !showComparison) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          image.selection.x * zoom,
          image.selection.y * zoom,
          image.selection.width * zoom,
          image.selection.height * zoom
        );
        ctx.setLineDash([]);
      }
    };
    img.src = showComparison && image.processedUrl ? image.processedUrl : image.originalUrl;
  }, [image, zoom, showComparison]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Canvas mouse handlers for selection
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / zoom),
      y: Math.floor((e.clientY - rect.top) / zoom),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (image.status === 'processing' || showComparison) return;
    const coords = getCanvasCoords(e);
    setIsSelecting(true);
    setSelectionStart(coords);
    onSelectionChange(image.id, null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !selectionStart) return;
    const coords = getCanvasCoords(e);
    onSelectionChange(image.id, {
      x: Math.min(selectionStart.x, coords.x),
      y: Math.min(selectionStart.y, coords.y),
      width: Math.abs(coords.x - selectionStart.x),
      height: Math.abs(coords.y - selectionStart.y),
    });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setSelectionStart(null);
  };

  // Auto-detect watermark position
  const autoDetect = () => {
    onSelectionChange(image.id, {
      x: image.originalWidth - 200,
      y: image.originalHeight - 80,
      width: 180,
      height: 60,
    });
  };

  const clearSelection = () => {
    onSelectionChange(image.id, null);
  };

  const handleDownload = () => {
    if (image.processedUrl) {
      const filename = `${image.file.name.replace(/\.[^/.]+$/, '')}-cleaned.png`;
      downloadImage(image.processedUrl, filename);
    }
  };

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border-b border-neutral-700/50">
        <div className="flex items-center gap-2 flex-1 min-w-0 w-full">
          {image.status === 'completed' && (
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
          )}
          {image.status === 'error' && (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          )}
          {image.status === 'processing' && (
            <Loader2 className="w-4 h-4 text-green-500 animate-spin flex-shrink-0" />
          )}
          <span className="text-sm text-neutral-200 truncate">{image.file.name}</span>
          <span className="text-xs text-neutral-500 flex-shrink-0">
            {image.originalWidth} × {image.originalHeight}
          </span>
        </div>

        <button
          onClick={() => onRemove(image.id)}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors self-end sm:self-auto"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative bg-black/30 overflow-auto max-h-[260px] sm:max-h-[320px]"
      >
        <div className="flex justify-center p-2">
          <canvas
            ref={canvasRef}
            className={`${image.status !== 'processing' && !showComparison ? 'cursor-crosshair' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>

        {/* Processing overlay */}
        {image.status === 'processing' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <div className="glass rounded-lg p-4 pulse-glow">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                <span className="text-neutral-200">Processing...</span>
              </div>
              <div className="mt-3 w-40 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 rounded-full transition-all duration-300 progress-pulse"
                  style={{ width: `${image.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-3 border-t border-neutral-700/50">
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center justify-between sm:justify-start gap-1 bg-neutral-800/50 rounded-lg p-1 w-full sm:w-auto">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              disabled={zoom <= 0.5}
              className="p-1 rounded text-neutral-400 hover:bg-neutral-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-neutral-400 min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              disabled={zoom >= 3}
              className="p-1 rounded text-neutral-400 hover:bg-neutral-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Selection controls */}
          {image.status !== 'processing' && image.status !== 'completed' && (
            <>
              <button
                onClick={autoDetect}
                className="flex items-center gap-1.5 px-2 py-1 text-xs sm:text-sm rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                <Crosshair className="w-3 h-3" />
                Auto-detect
              </button>

              {image.selection && (
                <>
                  <span className="text-xs sm:text-sm text-neutral-500">
                    {image.selection.width} × {image.selection.height}
                  </span>
                  <button
                    onClick={clearSelection}
                    className="flex items-center gap-1 px-2 py-1 text-xs sm:text-sm rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear
                  </button>
                </>
              )}
            </>
          )}

          <div className="hidden sm:block sm:flex-1" />

          {/* Action buttons */}
          {image.status === 'completed' && image.processedUrl && (
            <>
              <button
                onClick={() => setShowComparison(!showComparison)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs sm:text-sm rounded-lg transition-colors ${
                  showComparison
                    ? 'bg-green-600 text-white'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <Eye className="w-3 h-3" />
                {showComparison ? 'After' : 'Compare'}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-green-700 text-white hover:bg-green-600 transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            </>
          )}

          {image.status === 'pending' && image.selection && (
            <button
              onClick={() => onProcess(image.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-green-700 text-white hover:bg-green-600 transition-colors"
            >
              Remove Watermark
            </button>
          )}

          {image.status === 'error' && (
            <span className="text-xs sm:text-sm text-red-400">
              {image.error || 'Processing failed'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
