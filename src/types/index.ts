export interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextureSample {
  r: number;
  g: number;
  b: number;
}

export type ImageStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ProcessedImage {
  id: string;
  file: File;
  originalUrl: string;
  processedUrl: string | null;
  status: ImageStatus;
  progress: number;
  error?: string;
  selection: Selection | null;
  originalWidth: number;
  originalHeight: number;
}

export interface ProcessingOptions {
  autoDetect: boolean;
  passes: number;
  margin: number;
  grainStrength: number;
  textureInjectionProbability: number;
}
