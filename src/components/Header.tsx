'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Top-level app header with branding and product description.
 */
export default function Header() {
  return (
    <header className="text-center py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-green-800/30 pulse-glow">
          <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-green-500" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-neutral-100 via-green-400 to-neutral-100 bg-clip-text text-transparent">
          Gemini Watermark Remover
        </h1>
      </div>
      <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
        Professional AI-powered watermark removal for commercial photography.
        Upload multiple images, auto-detect or manually select watermarks, and download clean results.
      </p>
    </header>
  );
}
