import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme-provider";

import "./globals.css";

const proximaNova = localFont({
  src: [
    {
      path: "../public/fonts/Proxima Nova Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/Proxima Nova Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Proxima Nova Semibold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/Proxima Nova Extrabold.ttf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-proxima",
});

export const metadata: Metadata = {
  title: "Autolinium Execution Log",
  description: "Internal operational briefings and proofs of work.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={proximaNova.variable}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
