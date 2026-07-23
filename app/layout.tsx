import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { PwaRegistration } from "@/components/pwa-registration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "FriendCircle",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FriendCircle",
  },
  title: {
    default: "FriendCircle",
    template: "%s · FriendCircle",
  },
  description: "A private place for friends to run polls and split bills.",
  icons: {
    apple: [
      {
        sizes: "180x180",
        type: "image/png",
        url: "/icons/friendcircle-apple-180.png",
      },
    ],
    icon: [
      {
        sizes: "192x192",
        type: "image/png",
        url: "/icons/friendcircle-192.png",
      },
      {
        sizes: "512x512",
        type: "image/png",
        url: "/icons/friendcircle-512.png",
      },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#1473e6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
