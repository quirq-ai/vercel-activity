import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
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
  title: "Vercel activity",
  description: "Live deployment activity across our Vercel projects.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <svg viewBox="0 0 76 65" className="size-5 fill-current" aria-hidden>
                <path d="M37.5 0 75 65H0z" />
              </svg>
              Vercel activity
            </h1>
            <Nav />
          </header>
          {children}
          <footer className="mt-4 text-xs text-muted">
            Only projects deployed from our workspace are listed. Preview URLs, private repos
            and account details such as IDs and emails are never shown.
          </footer>
        </main>
      </body>
    </html>
  );
}
