import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, DM_Sans, Open_Sans } from 'next/font/google';
import './globals.css';

const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-display', display: 'swap' });
const sans = Open_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const data = DM_Sans({ subsets: ['latin'], variable: '--font-data', display: 'swap' });

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
  themeColor: '#f5f3ee',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${sans.variable} ${data.variable}`}>
      <body>{children}</body>
    </html>
  );
}
