import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppShell, ThemeProvider } from '@/components/layout';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://clave.app';

export const metadata: Metadata = {
  title: {
    default: 'Clave - Natural Language Dashboard Generator',
    template: '%s | Clave',
  },
  description:
    'Transform your data into beautiful dashboards using natural language. Ask questions, get visualizations instantly with Clave.',
  keywords: [
    'dashboard',
    'data visualization',
    'natural language',
    'AI',
    'charts',
    'analytics',
    'business intelligence',
  ],
  authors: [{ name: 'Clave' }],
  creator: 'Clave',
  metadataBase: new URL(siteUrl),
  icons: {
    icon: '/favicon.ico',
    apple: '/clave-logo-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Clave',
    title: 'Clave - Natural Language Dashboard Generator',
    description:
      'Transform your data into beautiful dashboards using natural language. Ask questions, get visualizations instantly.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Clave - Natural Language Dashboard Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clave - Natural Language Dashboard Generator',
    description:
      'Transform your data into beautiful dashboards using natural language. Ask questions, get visualizations instantly.',
    images: ['/og-image.png'],
    creator: '@clave',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme-storage');
                  if (stored) {
                    const { state } = JSON.parse(stored);
                    if (state?.theme) {
                      document.documentElement.classList.add(state.theme);
                    }
                  }
                } catch (e) {
                  // Ignore errors, will fall back to default light theme
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased w-full h-full`}
      >
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
