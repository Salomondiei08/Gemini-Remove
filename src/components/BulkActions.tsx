'use client';

import React from 'react';
import {
  Play,
  Download,
  Trash2,
  Crosshair,
  Loader2,
} from 'lucide-react';
import { ProcessedImage } from '@/types';

interface BulkActionsProps {
  images: ProcessedImage[];
  onAutoDetectAll: () => void;
  onProcessAll: () => void;
  onDownloadAll: () => void;
  onClearAll: () => void;
  isProcessing: boolean;
}

/**
 * Global actions for operating on all queued images at once.
 */
export default function BulkActions({
  images,
  onAutoDetectAll,
  onProcessAll,
  onDownloadAll,
  onClearAll,
  isProcessing,
}: BulkActionsProps) {
  const pendingWithSelection = images.filter(
    (img) => img.status === 'pending' && img.selection
  ).length;
  const pendingWithoutSelection = images.filter(
    (img) => img.status === 'pending' && !img.selection
  ).length;
  const completedCount = images.filter((img) => img.status === 'completed').length;
  const processingCount = images.filter((img) => img.status === 'processing').length;

  if (images.length === 0) return null;

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <h3 className="text-sm font-medium text-neutral-200 w-full sm:w-auto sm:mr-2">
          Bulk Actions:
        </h3>

        {/* Auto-detect all */}
        {pendingWithoutSelection > 0 && (
          <button
            onClick={onAutoDetectAll}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
          >
            <Crosshair className="w-4 h-4" />
            Auto-detect All ({pendingWithoutSelection})
          </button>
        )}

        {/* Process all */}
        {pendingWithSelection > 0 && (
          <button
            onClick={onProcessAll}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-green-700 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing ({processingCount})
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Process All ({pendingWithSelection})
              </>
            )}
          </button>
        )}

        {/* Download all */}
        {completedCount > 0 && (
          <button
            onClick={onDownloadAll}
            className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-green-700 text-white hover:bg-green-600 transition-colors w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            Download All ({completedCount})
          </button>
        )}

        <div className="hidden sm:block sm:flex-1" />

        {/* Clear all */}
        <button
          onClick={onClearAll}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-neutral-800 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
        >
          <Trash2 className="w-4 h-4" />
          Clear All
        </button>
      </div>
    </div>
  );
}
