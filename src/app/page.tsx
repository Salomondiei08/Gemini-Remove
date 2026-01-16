'use client';

import React, { useState, useCallback } from 'react';
import Header from '@/components/Header';
import UploadZone from '@/components/UploadZone';
import ProcessingQueue from '@/components/ProcessingQueue';
import BulkActions from '@/components/BulkActions';
import { ProcessedImage, Selection } from '@/types';
import { processImage, downloadImage, autoDetectWatermark, loadImageData } from '@/lib/watermark-remover';

/**
 * Main page for uploading, selecting, and processing images.
 */
export default function Home() {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle new files
  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newImages: ProcessedImage[] = [];

    for (const file of files) {
      try {
        const { width, height } = await loadImageData(file);
        newImages.push({
          id: generateId(),
          file,
          originalUrl: URL.createObjectURL(file),
          processedUrl: null,
          status: 'pending',
          progress: 0,
          selection: null,
          originalWidth: width,
          originalHeight: height,
        });
      } catch (error) {
        console.error('Failed to load image:', file.name, error);
      }
    }

    setImages((prev) => [...prev, ...newImages]);
  }, []);

  // Remove image
  const handleRemove = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img?.originalUrl) URL.revokeObjectURL(img.originalUrl);
      if (img?.processedUrl) URL.revokeObjectURL(img.processedUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  // Update selection
  const handleSelectionChange = useCallback((id: string, selection: Selection | null) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, selection } : img
      )
    );
  }, []);

  // Process single image
  const handleProcess = useCallback(async (id: string) => {
    const image = images.find((img) => img.id === id);
    if (!image || !image.selection) return;

    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, status: 'processing', progress: 0 } : img
      )
    );

    try {
      const processedUrl = await processImage(
        image.file,
        image.selection,
        {},
        (progress) => {
          setImages((prev) =>
            prev.map((img) =>
              img.id === id ? { ...img, progress } : img
            )
          );
        }
      );

      setImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? { ...img, status: 'completed', progress: 100, processedUrl }
            : img
        )
      );
    } catch (error) {
      setImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? { ...img, status: 'error', error: (error as Error).message }
            : img
        )
      );
    }
  }, [images]);

  // Auto-detect all pending images
  const handleAutoDetectAll = useCallback(() => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.status === 'pending' && !img.selection) {
          return {
            ...img,
            selection: autoDetectWatermark(img.originalWidth, img.originalHeight),
          };
        }
        return img;
      })
    );
  }, []);

  // Process all pending images with selection
  const handleProcessAll = useCallback(async () => {
    const pendingImages = images.filter(
      (img) => img.status === 'pending' && img.selection
    );

    if (pendingImages.length === 0) return;

    setIsProcessing(true);

    // Process images sequentially to avoid overwhelming the browser
    for (const image of pendingImages) {
      await handleProcess(image.id);
    }

    setIsProcessing(false);
  }, [images, handleProcess]);

  // Download all completed images
  const handleDownloadAll = useCallback(() => {
    const completedImages = images.filter(
      (img) => img.status === 'completed' && img.processedUrl
    );

    completedImages.forEach((img, index) => {
      setTimeout(() => {
        const filename = `${img.file.name.replace(/\.[^/.]+$/, '')}-cleaned.png`;
        downloadImage(img.processedUrl!, filename);
      }, index * 500);
    });
  }, [images]);

  // Clear all images
  const handleClearAll = useCallback(() => {
    images.forEach((img) => {
      if (img.originalUrl) URL.revokeObjectURL(img.originalUrl);
      if (img.processedUrl) URL.revokeObjectURL(img.processedUrl);
    });
    setImages([]);
  }, [images]);

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Header />

        <div className="glass rounded-2xl p-4 sm:p-6">
          <UploadZone
            onFilesSelected={handleFilesSelected}
            disabled={isProcessing}
          />
        </div>

        {images.length > 0 && (
          <>
            <BulkActions
              images={images}
              onAutoDetectAll={handleAutoDetectAll}
              onProcessAll={handleProcessAll}
              onDownloadAll={handleDownloadAll}
              onClearAll={handleClearAll}
              isProcessing={isProcessing}
            />

            <ProcessingQueue
              images={images}
              onRemove={handleRemove}
              onSelectionChange={handleSelectionChange}
              onProcess={handleProcess}
            />
          </>
        )}

        {/* Instructions */}
        {images.length === 0 && (
          <div className="glass rounded-xl p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-neutral-100 mb-4">
              How it works
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-green-800/30 flex items-center justify-center text-green-500 font-bold">
                  1
                </div>
                <h4 className="font-medium text-neutral-200">Upload Images</h4>
                <p className="text-sm text-neutral-500">
                  Drag and drop or click to upload multiple images at once.
                  Supports PNG, JPG, and WebP formats.
                </p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-green-800/30 flex items-center justify-center text-green-500 font-bold">
                  2
                </div>
                <h4 className="font-medium text-neutral-200">Select Watermark</h4>
                <p className="text-sm text-neutral-500">
                  Use Auto-detect for Gemini watermarks, or click and drag to
                  manually select the watermark area on each image.
                </p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-green-800/30 flex items-center justify-center text-green-500 font-bold">
                  3
                </div>
                <h4 className="font-medium text-neutral-200">Process & Download</h4>
                <p className="text-sm text-neutral-500">
                  Process all images with one click. Download individually or
                  all at once as clean PNG files.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-4 text-sm text-neutral-600">
          Professional watermark removal using 8-pass texture synthesis inpainting
        </footer>
      </div>
    </main>
  );
}
