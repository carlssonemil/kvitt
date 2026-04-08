import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#262626' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://kvitt.emca.app'),
  title: {
    default: "Kvitt — Shared expenses made simple",
    template: "%s — Kvitt",
  },
  description: "Split bills and track shared expenses with friends and groups. Kvitt makes it easy to settle up.",
  openGraph: {
    siteName: "Kvitt",
    title: "Kvitt — Shared expenses made simple",
    description: "Split bills and track shared expenses with friends and groups. Kvitt makes it easy to settle up.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Kvitt — Shared expenses made simple",
    description: "Split bills and track shared expenses with friends and groups. Kvitt makes it easy to settle up.",
  },
  appleWebApp: {
    title: "Kvitt",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans", inter.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-background focus:text-foreground focus:border focus:border-border focus:shadow-md"
          >
            Skip to main content
          </a>
          <SiteHeader />
          <div id="main-content" className="flex flex-col flex-1">
            {children}
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
