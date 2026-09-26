import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RICS Group 03 Study Hub',
  description: 'SOE, Q&A practice, case studies, calendar, attendance and discussions for RICS APC Group 03.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'RICS G03', statusBarStyle: 'default' },
  icons: { icon: '/favicon.svg', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef0f5' },
    { media: '(prefers-color-scheme: dark)', color: '#222734' },
  ],
};

// Applies the saved theme before first paint so dark mode doesn't flash light.
const themeScript = `try{var t=localStorage.getItem('g03-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
