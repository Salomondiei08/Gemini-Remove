import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for watermark removal using AI inpainting.
 *
 * This route accepts an image and mask, then sends them to an AI inpainting service.
 *
 * Supported backends (configure via INPAINTING_PROVIDER env var):
 * - 'replicate' - Uses Replicate's LaMa or SD-Inpainting models
 * - 'clipdrop' - Uses ClipDrop's cleanup API
 * - 'local' - Falls back to simple averaging (current implementation)
 */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const maskFile = formData.get('mask') as File;

    if (!imageFile || !maskFile) {
      return NextResponse.json(
        { error: 'Image and mask are required' },
        { status: 400 }
      );
    }

    const provider = process.env.INPAINTING_PROVIDER || 'local';

    let resultUrl: string;

    switch (provider) {
      case 'replicate':
        resultUrl = await processWithReplicate(imageFile, maskFile);
        break;
      case 'clipdrop':
        resultUrl = await processWithClipDrop(imageFile, maskFile);
        break;
      default:
        // Return error - client should handle locally
        return NextResponse.json(
          { error: 'No AI provider configured. Using client-side processing.' },
          { status: 501 }
        );
    }

    return NextResponse.json({ url: resultUrl });
  } catch (error) {
    console.error('Inpainting error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Process with Replicate API using LaMa inpainting model.
 * LaMa is specifically designed for object removal and works great for watermarks.
 */
async function processWithReplicate(image: File, mask: File): Promise<string> {
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  // Convert files to base64
  const imageBuffer = await image.arrayBuffer();
  const maskBuffer = await mask.arrayBuffer();

  const imageBase64 = `data:${image.type};base64,${Buffer.from(imageBuffer).toString('base64')}`;
  const maskBase64 = `data:${mask.type};base64,${Buffer.from(maskBuffer).toString('base64')}`;

  // Use LaMa model - excellent for inpainting/object removal
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // LaMa model for inpainting
      version: 'cdac898532cf21c879a25dc8e3f53bb3d7c2cc6c2d0e2f6e0e7c6e2f0d8f0e1a', // Update with actual version
      input: {
        image: imageBase64,
        mask: maskBase64,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Replicate API error: ${response.statusText}`);
  }

  const prediction = await response.json();

  // Poll for completion
  let result = prediction;
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const pollResponse = await fetch(result.urls.get, {
      headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` },
    });
    result = await pollResponse.json();
  }

  if (result.status === 'failed') {
    throw new Error('Replicate processing failed');
  }

  return result.output;
}

/**
 * Process with ClipDrop API.
 * ClipDrop has a dedicated cleanup API for removing objects.
 */
async function processWithClipDrop(image: File, mask: File): Promise<string> {
  const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

  if (!CLIPDROP_API_KEY) {
    throw new Error('CLIPDROP_API_KEY not configured');
  }

  const formData = new FormData();
  formData.append('image_file', image);
  formData.append('mask_file', mask);

  const response = await fetch('https://clipdrop-api.co/cleanup/v1', {
    method: 'POST',
    headers: {
      'x-api-key': CLIPDROP_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`ClipDrop API error: ${response.statusText}`);
  }

  // ClipDrop returns the image directly
  const resultBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(resultBuffer).toString('base64');
  return `data:image/png;base64,${base64}`;
}
