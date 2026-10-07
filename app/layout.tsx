import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import { RevealObserver } from "@/components/motion";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz", "SOFT", "WONK"] });
const grotesk = Schibsted_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Ocus AI: remote jobs you can actually take",
  description: "A job-search agent that reads the fine print, keeps only roles open to where you live, tailors your resume without inventing a line, and applies after you approve.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${grotesk.variable} ${plexMono.variable} h-full antialiased`}>
      <head>
        {/* Scroll reveals only hide content once JS is known to be running. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <RevealObserver />
      </body>
    </html>
  );
}
