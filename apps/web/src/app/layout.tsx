import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Tysiąc - Polish Card Game',
  description: 'Play the classic Polish card game Tysiąc (1000) online with friends or AI opponents',
  keywords: ['card game', 'Polish', 'Tysiąc', '1000', 'multiplayer', 'online'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        <ToastProvider>
          <div className="felt-texture min-h-screen">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
