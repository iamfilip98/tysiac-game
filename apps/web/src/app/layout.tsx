import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Tysiąc - Polish Card Game',
  description: 'Play the classic Polish card game Tysiąc (1000) online with friends or AI opponents',
  keywords: ['card game', 'Polish', 'Tysiąc', '1000', 'multiplayer', 'online'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tysiąc',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className={`${inter.variable} font-sans h-full overflow-hidden`}>
        <ToastProvider>
          <div className="felt-texture h-full overflow-auto">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
