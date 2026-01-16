import { Selection, TextureSample, ProcessingOptions } from '@/types';

const DEFAULT_OPTIONS: ProcessingOptions = {
  autoDetect: true,
  passes: 8,
  margin: 30,
  grainStrength: 4,
  textureInjectionProbability: 0.3,
};

// Build texture bank from margin around watermark
function buildTextureBank(
  imageData: ImageData,
  selection: Selection,
  margin: number = 30
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

// Gaussian weight function
function gaussianWeight(dist: number, kernelSize: number): number {
  return Math.exp(-(dist * dist) / (2 * kernelSize * kernelSize));
}

// Calculate adaptive kernel size based on distance to edge
function getAdaptiveKernelSize(
  x: number,
  y: number,
  selection: Selection,
  baseSize: number = 15
): number {
  const distToLeft = x - selection.x;
  const distToRight = selection.x + selection.width - x;
  const distToTop = y - selection.y;
  const distToBottom = selection.y + selection.height - y;

  const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
  const maxDist = Math.min(selection.width, selection.height) / 2;
  const normalizedDist = minDist / maxDist;

  return baseSize * (0.5 + normalizedDist * 0.5);
}

// Auto-detect Gemini watermark position (bottom-right corner)
export function autoDetectWatermark(width: number, height: number): Selection {
  return {
    x: width - 200,
    y: height - 80,
    width: 180,
    height: 60,
  };
}

// Progressive texture synthesis inpainting
export async function inpaintWatermark(
  imageData: ImageData,
  selection: Selection,
  options: Partial<ProcessingOptions> = {},
  onProgress?: (progress: number) => void
): Promise<ImageData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);
  const { margin, passes, textureInjectionProbability, grainStrength } = opts;

  // Build texture bank
  const textureBank = buildTextureBank(imageData, selection, margin);

  if (textureBank.length === 0) {
    return imageData;
  }

  // 8-pass progressive inpainting
  for (let pass = 0; pass < passes; pass++) {
    const tempData = new Uint8ClampedArray(data);
    const passProgress = pass / passes;

    for (let y = selection.y; y < selection.y + selection.height; y++) {
      for (let x = selection.x; x < selection.x + selection.width; x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const kernelSize = getAdaptiveKernelSize(x, y, selection);
        const sampleRadius = Math.ceil(kernelSize * (1 + passProgress));

        let totalWeight = 0;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;

        // Sample surrounding pixels (skip watermark interior in early passes)
        for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
          for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
            const sx = x + dx;
            const sy = y + dy;

            if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

            // In early passes, only sample from outside watermark
            // In later passes, allow sampling from already-filled areas
            const isInsideWatermark =
              sx >= selection.x &&
              sx < selection.x + selection.width &&
              sy >= selection.y &&
              sy < selection.y + selection.height;

            if (isInsideWatermark && pass < passes * 0.5) continue;

            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > sampleRadius) continue;

            const weight = gaussianWeight(dist, kernelSize);
            const idx = (sy * width + sx) * 4;

            sumR += tempData[idx] * weight;
            sumG += tempData[idx + 1] * weight;
            sumB += tempData[idx + 2] * weight;
            totalWeight += weight;
          }
        }

        // Inject random texture bank samples (30% chance)
        if (Math.random() < textureInjectionProbability && textureBank.length > 0) {
          const sample = textureBank[Math.floor(Math.random() * textureBank.length)];
          const injectionWeight = 0.2;
          sumR += sample.r * injectionWeight;
          sumG += sample.g * injectionWeight;
          sumB += sample.b * injectionWeight;
          totalWeight += injectionWeight;
        }

        if (totalWeight > 0) {
          const idx = (y * width + x) * 4;
          data[idx] = Math.round(sumR / totalWeight);
          data[idx + 1] = Math.round(sumG / totalWeight);
          data[idx + 2] = Math.round(sumB / totalWeight);
        }
      }
    }

    // Report progress
    if (onProgress) {
      onProgress(((pass + 1) / passes) * 70); // 0-70% for inpainting passes
    }

    // Allow UI to update between passes
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Bilateral filtering for edge preservation
  if (onProgress) onProgress(75);

  const bilateralRadius = 5;
  const spatialSigma = 3;
  const colorSigma = 30;
  const finalData = new Uint8ClampedArray(data);

  for (let y = selection.y; y < selection.y + selection.height; y++) {
    for (let x = selection.x; x < selection.x + selection.width; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const centerIdx = (y * width + x) * 4;
      const centerR = data[centerIdx];
      const centerG = data[centerIdx + 1];
      const centerB = data[centerIdx + 2];

      let totalWeight = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;

      for (let dy = -bilateralRadius; dy <= bilateralRadius; dy++) {
        for (let dx = -bilateralRadius; dx <= bilateralRadius; dx++) {
          const sx = x + dx;
          const sy = y + dy;

          if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

          const idx = (sy * width + sx) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Spatial weight
          const spatialDist = Math.sqrt(dx * dx + dy * dy);
          const spatialWeight = gaussianWeight(spatialDist, spatialSigma);

          // Color weight
          const colorDist = Math.sqrt(
            (r - centerR) ** 2 + (g - centerG) ** 2 + (b - centerB) ** 2
          );
          const colorWeight = gaussianWeight(colorDist, colorSigma);

          const weight = spatialWeight * colorWeight;
          sumR += r * weight;
          sumG += g * weight;
          sumB += b * weight;
          totalWeight += weight;
        }
      }

      if (totalWeight > 0) {
        finalData[centerIdx] = Math.round(sumR / totalWeight);
        finalData[centerIdx + 1] = Math.round(sumG / totalWeight);
        finalData[centerIdx + 2] = Math.round(sumB / totalWeight);
      }
    }
  }

  if (onProgress) onProgress(90);

  // Add subtle film grain for natural texture (4px random noise)
  for (let y = selection.y; y < selection.y + selection.height; y++) {
    for (let x = selection.x; x < selection.x + selection.width; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const idx = (y * width + x) * 4;
      const grain = (Math.random() - 0.5) * grainStrength * 2;

      finalData[idx] = Math.max(0, Math.min(255, finalData[idx] + grain));
      finalData[idx + 1] = Math.max(0, Math.min(255, finalData[idx + 1] + grain));
      finalData[idx + 2] = Math.max(0, Math.min(255, finalData[idx + 2] + grain));
    }
  }

  if (onProgress) onProgress(100);

  return new ImageData(finalData, width, height);
}

// Load image and get ImageData
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

// Convert ImageData to blob URL
export function imageDataToUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

// Process a single image
export async function processImage(
  file: File,
  selection: Selection | null,
  options: Partial<ProcessingOptions> = {},
  onProgress?: (progress: number) => void
): Promise<string> {
  const { imageData, width, height } = await loadImageData(file);

  const finalSelection = selection || (options.autoDetect !== false ? autoDetectWatermark(width, height) : null);

  if (!finalSelection) {
    throw new Error('No selection provided and auto-detect is disabled');
  }

  const processed = await inpaintWatermark(imageData, finalSelection, options, onProgress);
  return imageDataToUrl(processed);
}

// Download image from URL
export function downloadImage(url: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
}

// Download all images as a zip (using JSZip if available, otherwise individual downloads)
export async function downloadAllImages(
  images: { url: string; filename: string }[]
): Promise<void> {
  // Simple sequential download for now
  for (const { url, filename } of images) {
    downloadImage(url, filename);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Delay between downloads
  }
}
