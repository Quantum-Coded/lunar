import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#030712',
};

export const metadata: Metadata = {
  title: 'Drop the Rover — NASA-IBM Lunar Navigation Simulation',
  description: 'Interactive 3D lunar rover navigation simulation powered by NASA-IBM Lunar Foundation Model outputs (Ice Prospectivity, Crater Detection, IMP Terrain Segmentation).',
  keywords: ['NASA', 'IBM', 'Lunar Foundation Model', 'Three.js', 'React Three Fiber', 'A* Pathfinding', 'Lunar Rover', 'Space Exploration', 'AI4Science'],
  authors: [{ name: 'Drop the Rover Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌕</text></svg>" />
      </head>
      <body>
        <div className="scanline-overlay" />
        {children}
      </body>
    </html>
  );
}
