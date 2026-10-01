import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import './globals.css';

// A clean sans for everything, with a serif italic for the one word in a title that carries it.
const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Group 03 Tracker',
  description: 'SOE, Q&A practice, case studies, calendar, attendance and discussions for RICS APC Group 03.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Group 03', statusBarStyle: 'default' },
  icons: { icon: '/favicon.svg', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#e9f0f8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${sans.variable}`}>
      <body>
        {/* Soft colour shapes that sit behind the frosted glass. */}
        <div className="backdrop" aria-hidden="true">
          <span className="blob green" />
          <span className="blob blue" />
          <span className="blob orange" />
          <span className="blob purple" />
          <span className="sheen" />
        </div>
        {children}
      </body>
    </html>
  );
}
