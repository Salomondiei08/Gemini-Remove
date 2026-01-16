'use client';

import React, { useCallback, useState } from 'react';
import { Upload, ImagePlus } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Drag-and-drop plus click-to-upload area for image selection.
 */
export default function UploadZone({ onFilesSelected, disabled }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((file) =>
        file.type.startsWith('image/')
      );
      if (files.length > 0) {
        onFilesSelected(files);
      }
      e.target.value = '';
    },
    [onFilesSelected]
  );

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer
        transition-all duration-300 ease-out
        ${isDragOver
          ? 'border-green-600 bg-green-900/20 scale-[1.02]'
          : 'border-neutral-700 bg-neutral-900/30 hover:border-green-700 hover:bg-green-900/10'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !disabled && document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled}
      />

      <div className="flex flex-col items-center gap-4">
        <div className={`
          p-3 sm:p-4 rounded-full bg-green-800/20
          ${isDragOver ? 'scale-110' : ''}
          transition-transform duration-300
        `}>
          {isDragOver ? (
            <ImagePlus className="w-10 h-10 sm:w-12 sm:h-12 text-green-500" />
          ) : (
            <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-neutral-400" />
          )}
        </div>

        <div>
          <p className="text-base sm:text-lg text-neutral-200 font-medium">
            {isDragOver ? 'Drop images here' : 'Drop images here or click to browse'}
          </p>
          <p className="text-xs sm:text-sm text-neutral-500 mt-2">
            Supports PNG, JPG, WebP • Multiple files supported
          </p>
        </div>
      </div>

      {isDragOver && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none">
          <div className="absolute inset-0 rounded-2xl shimmer opacity-50" />
        </div>
      )}
    </div>
  );
}
