import { Selection, TextureSample, ProcessingOptions } from '@/types';

const DEFAULT_OPTIONS: ProcessingOptions = {
  autoDetect: true,
  passes: 8,
  margin: 50,
  grainStrength: 2,
  textureInjectionProbability: 0.2,
};

/**
 * Build texture bank from margin around watermark (ONLY outside pixels).
 */
function buildTextureBank(
  imageData: ImageData,
  selection: Selection,
  margin: number = 50
): TextureSample[] {
  const { data, width } = imageData;
  const bank: TextureSample[] = [];

  const minX = Math.max(0, selection.x - margin);
  const maxX = Math.min(imageData.width, selection.x + selection.width + margin);
  const minY = Math.max(0, selection.y - margin);
  const maxY = Math.min(imageData.height, selection.y + selection.height + margin);

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      // Only sample pixels OUTSIDE the watermark region
      if (
        x < selection.x ||
        x >= selection.x + selection.width ||
        y < selection.y ||
        y >= selection.y + selection.height
      ) {
        const idx = (y * width + x) * 4;
        bank.push({
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2],
        });
      }
    }
  }

  return bank;
}

/**
 * Check if a pixel is inside the watermark selection.
 */
function isInsideSelection(x: number, y: number, selection: Selection): boolean {
  return (
    x >= selection.x &&
    x < selection.x + selection.width &&
    y >= selection.y &&
    y < selection.y + selection.height
  );
}

/**
 * Auto-detect Gemini watermark position (bottom-right corner).
 */
export function autoDetectWatermark(width: number, height: number): Selection {
  return {
    x: Math.max(0, width - 200),
    y: Math.max(0, height - 80),
    width: Math.min(180, width),
    height: Math.min(60, height),
  };
}

/**
 * Simple and effective content-aware fill using patch matching.
 * Replaces watermark region by copying patches from surrounding area.
 */
export async function inpaintWatermark(
  imageData: ImageData,
  selection: Selection,
  options: Partial<ProcessingOptions> = {},
  onProgress?: (progress: number) => void
): Promise<ImageData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height } = imageData;
  const originalData = new Uint8ClampedArray(imageData.data);
  const resultData = new Uint8ClampedArray(imageData.data);
  const { margin, passes, grainStrength } = opts;

  console.log('Inpainting selection:', selection);
  console.log('Image size:', width, 'x', height);

  // Clamp selection to image bounds
  const sel = {
    x: Math.max(0, Math.min(selection.x, width - 1)),
    y: Math.max(0, Math.min(selection.y, height - 1)),
    width: Math.min(selection.width, width - selection.x),
    height: Math.min(selection.height, height - selection.y),
  };

  console.log('Clamped selection:', sel);

  if (sel.width <= 0 || sel.height <= 0) {
    console.error('Invalid selection dimensions');
    return imageData;
  }

  // Build texture bank from surrounding area
  const textureBank = buildTextureBank(imageData, sel, margin);
  console.log('Texture bank size:', textureBank.length);

  if (textureBank.length === 0) {
    console.error('No texture samples found');
    return imageData;
  }

  // Calculate average color of surrounding area for base fill
  let avgR = 0, avgG = 0, avgB = 0;
  for (const sample of textureBank) {
    avgR += sample.r;
    avgG += sample.g;
    avgB += sample.b;
  }
  avgR = Math.round(avgR / textureBank.length);
  avgG = Math.round(avgG / textureBank.length);
  avgB = Math.round(avgB / textureBank.length);

  console.log('Average surrounding color:', avgR, avgG, avgB);

  // Step 1: Fill the entire selection with the average color first (removes watermark completely)
  for (let y = sel.y; y < sel.y + sel.height; y++) {
    for (let x = sel.x; x < sel.x + sel.width; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = (y * width + x) * 4;
        resultData[idx] = avgR;
        resultData[idx + 1] = avgG;
        resultData[idx + 2] = avgB;
        // Keep alpha unchanged
      }
    }
  }

  if (onProgress) onProgress(20);
  await new Promise(resolve => setTimeout(resolve, 0));

  // Step 2: Progressive refinement from edges inward
  // Create distance map
  const distMap = new Float32Array(sel.width * sel.height);
  let maxDist = 0;

  for (let ly = 0; ly < sel.height; ly++) {
    for (let lx = 0; lx < sel.width; lx++) {
      const distToLeft = lx;
      const distToRight = sel.width - 1 - lx;
      const distToTop = ly;
      const distToBottom = sel.height - 1 - ly;
      const dist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
      distMap[ly * sel.width + lx] = dist;
      maxDist = Math.max(maxDist, dist);
    }
  }

  // Process layer by layer from edge inward
  for (let layer = 0; layer <= maxDist; layer++) {
    for (let ly = 0; ly < sel.height; ly++) {
      for (let lx = 0; lx < sel.width; lx++) {
        const dist = distMap[ly * sel.width + lx];
        if (Math.floor(dist) !== layer) continue;

        const x = sel.x + lx;
        const y = sel.y + ly;

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        // Sample from already-filled neighbors and outside pixels
        let sumR = 0, sumG = 0, sumB = 0;
        let totalWeight = 0;
        const sampleRadius = Math.min(10, margin);

        for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
          for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
            const sx = x + dx;
            const sy = y + dy;

            if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > sampleRadius || d === 0) continue;

            // Check if this sample is outside selection or already processed (closer to edge)
            const isOutside = !isInsideSelection(sx, sy, sel);
            const sampleLx = sx - sel.x;
            const sampleLy = sy - sel.y;
            const sampleDist = isOutside ? -1 : distMap[sampleLy * sel.width + sampleLx];

            // Only use pixels that are outside or already processed (layer < current)
            if (!isOutside && sampleDist >= layer) continue;

            const weight = 1 / (1 + d * 0.3);
            const idx = (sy * width + sx) * 4;

            // Use result data for already-filled areas, original for outside
            const sourceData = isOutside ? originalData : resultData;
            sumR += sourceData[idx] * weight;
            sumG += sourceData[idx + 1] * weight;
            sumB += sourceData[idx + 2] * weight;
            totalWeight += weight;
          }
        }

        // Add some random texture samples
        const numRandomSamples = 2;
        for (let i = 0; i < numRandomSamples; i++) {
          const sample = textureBank[Math.floor(Math.random() * textureBank.length)];
          const weight = 0.1;
          sumR += sample.r * weight;
          sumG += sample.g * weight;
          sumB += sample.b * weight;
          totalWeight += weight;
        }

        if (totalWeight > 0) {
          const idx = (y * width + x) * 4;
          resultData[idx] = Math.round(sumR / totalWeight);
          resultData[idx + 1] = Math.round(sumG / totalWeight);
          resultData[idx + 2] = Math.round(sumB / totalWeight);
        }
      }
    }

    if (onProgress && maxDist > 0) {
      onProgress(20 + (layer / maxDist) * 50);
    }

    // Yield to UI
    if (layer % 3 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  if (onProgress) onProgress(75);

  // Step 3: Smoothing passes
  for (let pass = 0; pass < passes; pass++) {
    const tempData = new Uint8ClampedArray(resultData);

    for (let y = sel.y; y < sel.y + sel.height; y++) {
      for (let x = sel.x; x < sel.x + sel.width; x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        let sumR = 0, sumG = 0, sumB = 0;
        let count = 0;
        const radius = 2;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const sx = x + dx;
            const sy = y + dy;
            if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

            const idx = (sy * width + sx) * 4;
            sumR += tempData[idx];
            sumG += tempData[idx + 1];
            sumB += tempData[idx + 2];
            count++;
          }
        }

        if (count > 0) {
          const idx = (y * width + x) * 4;
          resultData[idx] = Math.round(sumR / count);
          resultData[idx + 1] = Math.round(sumG / count);
          resultData[idx + 2] = Math.round(sumB / count);
        }
      }
    }

    if (onProgress) {
      onProgress(75 + ((pass + 1) / passes) * 15);
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  if (onProgress) onProgress(92);

  // Step 4: Feather edges for seamless blending
  const featherWidth = 4;
  for (let y = sel.y; y < sel.y + sel.height; y++) {
    for (let x = sel.x; x < sel.x + sel.width; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const lx = x - sel.x;
      const ly = y - sel.y;
      const distToEdge = distMap[ly * sel.width + lx];

      if (distToEdge < featherWidth) {
        const blend = distToEdge / featherWidth;
        const idx = (y * width + x) * 4;

        // Find nearest outside pixel color
        let nearestR = originalData[idx];
        let nearestG = originalData[idx + 1];
        let nearestB = originalData[idx + 2];
        let minDist = Infinity;

        for (let dy = -featherWidth; dy <= featherWidth; dy++) {
          for (let dx = -featherWidth; dx <= featherWidth; dx++) {
            const sx = x + dx;
            const sy = y + dy;
            if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
            if (isInsideSelection(sx, sy, sel)) continue;

            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < minDist) {
              minDist = d;
              const sIdx = (sy * width + sx) * 4;
              nearestR = originalData[sIdx];
              nearestG = originalData[sIdx + 1];
              nearestB = originalData[sIdx + 2];
            }
          }
        }

        resultData[idx] = Math.round(resultData[idx] * blend + nearestR * (1 - blend));
        resultData[idx + 1] = Math.round(resultData[idx + 1] * blend + nearestG * (1 - blend));
        resultData[idx + 2] = Math.round(resultData[idx + 2] * blend + nearestB * (1 - blend));
      }
    }
  }

  // Step 5: Add subtle noise for texture
  for (let y = sel.y; y < sel.y + sel.height; y++) {
    for (let x = sel.x; x < sel.x + sel.width; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const idx = (y * width + x) * 4;
      const noise = (Math.random() - 0.5) * grainStrength * 2;

      resultData[idx] = Math.max(0, Math.min(255, resultData[idx] + noise));
      resultData[idx + 1] = Math.max(0, Math.min(255, resultData[idx + 1] + noise));
      resultData[idx + 2] = Math.max(0, Math.min(255, resultData[idx + 2] + noise));
    }
  }

  if (onProgress) onProgress(100);
  console.log('Inpainting complete');

  return new ImageData(resultData, width, height);
}

/**
 * Load image file and get ImageData.
 */
export function loadImageData(file: File): Promise<{ imageData: ImageData; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      URL.revokeObjectURL(img.src);
      resolve({ imageData, width: img.width, height: img.height });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Convert ImageData to data URL.
 */
export function imageDataToUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Process a single image file.
 */
export async function processImage(
  file: File,
  selection: Selection | null,
  options: Partial<ProcessingOptions> = {},
  onProgress?: (progress: number) => void
): Promise<string> {
  console.log('Processing image:', file.name);
  console.log('Selection:', selection);

  const { imageData, width, height } = await loadImageData(file);
  console.log('Loaded image:', width, 'x', height);

  const finalSelection = selection || (options.autoDetect !== false ? autoDetectWatermark(width, height) : null);
  console.log('Final selection:', finalSelection);

  if (!finalSelection) {
    throw new Error('No selection provided and auto-detect is disabled');
  }

  const processed = await inpaintWatermark(imageData, finalSelection, options, onProgress);
  return imageDataToUrl(processed);
}

/**
 * Download image from data URL.
 */
export function downloadImage(url: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
}

/**
 * Download multiple images sequentially.
 */
export async function downloadAllImages(
  images: { url: string; filename: string }[]
): Promise<void> {
  for (const { url, filename } of images) {
    downloadImage(url, filename);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
