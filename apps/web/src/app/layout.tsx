import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Tysiąc - Polish Card Game',
  description: 'Play the classic Polish card game Tysiąc (1000) online with friends or AI opponents',
  keywords: ['card game', 'Polish', 'Tysiąc', '1000', 'multiplayer', 'online'],
  openGraph: {
    title: 'Tysiąc - Polish Card Game',
    description: 'Play the classic Polish card game Tysiąc (1000) online with friends or AI opponents',
    type: 'website',
    siteName: 'Tysiąc',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tysiąc - Polish Card Game',
    description: 'Play the classic Polish card game Tysiąc (1000) online with friends or AI opponents',
  },
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
    <html lang="en" className="h-full" data-theme="classic" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#1a3d2b" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c={classic:'#1a3d2b',dark:'#1c1c22',chocolate:'#3d2517',midnight:'#0f1a3d',burgundy:'#3d1520',purple:'#261540'};var p=JSON.parse(localStorage.getItem('tysiac-preferences'));if(p&&p.state){if(p.state.theme){var t=p.state.theme;document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(m&&c[t])m.content=c[t]}if(p.state.animationsEnabled===false)document.documentElement.setAttribute('data-animations','off')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans h-full overflow-hidden`}>
        <ErrorBoundary>
          <ToastProvider>
            <ThemeProvider>
              <div className="felt-texture h-full overflow-auto">
                {children}
              </div>
            </ThemeProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
