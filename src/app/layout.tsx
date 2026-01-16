import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gemini Watermark Remover",
  description: "Professional AI-powered watermark removal for commercial photography",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
