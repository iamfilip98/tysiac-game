import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

// Force dynamic rendering — ClerkProvider needs env vars at runtime
export const dynamic = 'force-dynamic';

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
            __html: `(function(){try{var c={classic:'#052e16',dark:'#08080c',chocolate:'#1a0f07',midnight:'#070b18',burgundy:'#1a070c',purple:'#0f0719'};var p=JSON.parse(localStorage.getItem('tysiac-preferences'));if(p&&p.state){if(p.state.theme){var t=p.state.theme;document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(m&&c[t])m.content=c[t];document.addEventListener('DOMContentLoaded',function(){if(c[t])document.body.style.backgroundColor=c[t]})}if(p.state.animationsEnabled===false)document.documentElement.setAttribute('data-animations','off');if(p.state.cardStyle)document.documentElement.setAttribute('data-card-style',p.state.cardStyle)}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans h-full overflow-hidden`}>
        <ClerkProvider>
          <ErrorBoundary>
            <ToastProvider>
              <ThemeProvider>
                <div className="felt-texture h-full overflow-auto">
                  {children}
                </div>
              </ThemeProvider>
            </ToastProvider>
          </ErrorBoundary>
        </ClerkProvider>
      </body>
    </html>
  );
}
