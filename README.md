# Gemini Watermark Remover

Fast, client-side watermark removal for Gemini-generated images. Upload one or many images, select the watermark area (auto-detect or manual), process locally in the browser, and download clean PNGs.

## Features

- Drag-and-drop multi-image upload with preview
- Auto-detect Gemini watermark position or draw a custom selection
- Batch processing with progress feedback
- Before/after comparison toggle
- Mobile-friendly, dark UI with green accent

## Tech Stack

- Next.js (App Router)
- TypeScript (strict)
- Tailwind CSS
- shadcn/ui styling conventions
- Canvas-based image processing in the browser

## Requirements

- Node.js 18+
- npm 9+

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Usage

1. Upload one or more images (PNG, JPG, WebP).
2. Use Auto-detect or draw a box around the watermark.
3. Process the image(s).
4. Download cleaned PNGs.

## Scripts

- `npm run dev` - Start the dev server
- `npm run build` - Create a production build
- `npm run start` - Run the production server
- `npm run lint` - Lint the codebase

## Notes

- All processing happens in your browser. Images are not uploaded to a server.
- Best results come from selecting the smallest watermark region possible.

## Project Structure

```
src/
  app/            Next.js App Router routes and layout
  components/     UI components
  lib/            Image processing logic
  types/          Shared TypeScript types
public/           Static assets
```

## License

MIT
