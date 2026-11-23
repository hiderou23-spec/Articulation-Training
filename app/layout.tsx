import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TabBar } from "@/components/TabBar";
import { SWRegister } from "@/components/SWRegister";

export const metadata: Metadata = {
  title: "Articulate AI",
  description: "Your 5-minute daily articulation coach: speak, get specific feedback, speak again.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Articulate", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1013" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
          <main className="safe-top flex-1 px-4 pb-28">{children}</main>
          <TabBar />
        </div>
        <SWRegister />
      </body>
    </html>
  );
}
