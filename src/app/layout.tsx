import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans'
import { clsx } from 'clsx'
import { Providers } from "@/components/providers"
import "./globals.css";

export const metadata: Metadata = {
  title: "Dataset JSON Viewer",
  description: "A lightweight, modern web application for viewing and analyzing dataset JSON files",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={clsx(GeistSans.className, 'antialiased')}>
      <body>
        {children}
        <Providers />
      </body>
    </html>
  );
}
