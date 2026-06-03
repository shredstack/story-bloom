import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StoryBloom - AI-Powered Personalized Children\'s Stories',
  description: 'Create magical, personalized stories for your child with AI. Age-appropriate content tailored to their interests, reading level, and imagination.',
  icons: {
    icon: '/storybloom_logo.png',
    apple: '/storybloom_logo.png',
  },
}

// `viewport-fit=cover` lets games run edge-to-edge under notches/home indicators
// (paired with CSS env(safe-area-inset-*)). The native shell additionally disables
// pinch-zoom at runtime (see NativeShellProvider) so the browser stays zoomable.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
