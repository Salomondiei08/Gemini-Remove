'use client';

import React from 'react';
import { ProcessedImage, Selection } from '@/types';
import ImageCard from './ImageCard';

interface ProcessingQueueProps {
  images: ProcessedImage[];
  onRemove: (id: string) => void;
  onSelectionChange: (id: string, selection: Selection | null) => void;
  onProcess: (id: string) => void;
}

/**
 * Renders processing stats and the image cards for the queue.
 */
export default function ProcessingQueue({
  images,
  onRemove,
  onSelectionChange,
  onProcess,
}: ProcessingQueueProps) {
  if (images.length === 0) return null;

  const pendingCount = images.filter((img) => img.status === 'pending').length;
  const processingCount = images.filter((img) => img.status === 'processing').length;
  const completedCount = images.filter((img) => img.status === 'completed').length;
  const errorCount = images.filter((img) => img.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
        <span className="text-neutral-200">
          {images.length} image{images.length !== 1 ? 's' : ''}
        </span>
        {pendingCount > 0 && (
          <span className="text-neutral-500">{pendingCount} pending</span>
        )}
        {processingCount > 0 && (
          <span className="text-yellow-500">{processingCount} processing</span>
        )}
        {completedCount > 0 && (
          <span className="text-green-500">{completedCount} completed</span>
        )}
        {errorCount > 0 && (
          <span className="text-red-400">{errorCount} failed</span>
        )}
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            onRemove={onRemove}
            onSelectionChange={onSelectionChange}
            onProcess={onProcess}
          />
        ))}
      </div>
    </div>
  );
}
