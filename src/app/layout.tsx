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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e9f0f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1222' },
  ],
};

// Runs before the first paint so the page never flashes the wrong theme.
// A saved choice wins; otherwise the device's light or dark setting decides.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('g03-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* Soft colour shapes that sit behind the frosted glass. */}
        <div className="backdrop" aria-hidden="true">
          <span className="blob green" />
          <span className="blob blue" />
          <span className="blob orange" />
          <span className="blob purple" />
        </div>
        {children}
      </body>
    </html>
  );
}
