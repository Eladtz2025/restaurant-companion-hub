import { Heebo } from 'next/font/google';

import type { Metadata } from 'next';

import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Restaurant OS',
  description: 'מערכת הפעלה למסעדות',
  manifest: '/manifest.json',
  themeColor: '#000000',
  viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Restaurant OS' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${heebo.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
