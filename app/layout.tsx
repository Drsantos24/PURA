import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "PURA Health",
  description: "Clinical intelligence for modern chiropractic care.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased bg-background text-text-primary`}
      >
        {children}
        <footer className="w-full border-t border-border py-3 px-8 flex gap-4 justify-center">
          <a href="/legal/privacy" className="text-xs font-sans text-text-muted hover:text-text-primary transition-colors">Privacy Policy</a>
          <a href="/legal/terms" className="text-xs font-sans text-text-muted hover:text-text-primary transition-colors">Terms of Service</a>
        </footer>
      </body>
    </html>
  );
}
