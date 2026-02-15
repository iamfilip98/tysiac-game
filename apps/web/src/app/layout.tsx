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
        <meta name="theme-color" content="#052e16" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem('tysiac-preferences'));if(p&&p.state){if(p.state.theme){document.documentElement.setAttribute('data-theme',p.state.theme);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',p.state.theme==='dark'?'#0a0a0a':'#052e16')}if(p.state.animationsEnabled===false)document.documentElement.setAttribute('data-animations','off')}}catch(e){}})()`,
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
