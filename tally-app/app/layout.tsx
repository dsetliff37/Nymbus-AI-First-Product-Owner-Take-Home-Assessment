import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DatasetProvider } from "@/src/context/DatasetProvider";
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
  title: "Tally – Spending Analyst",
  description: "Ask plain-English questions about your spending.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DatasetProvider>{children}</DatasetProvider>
      </body>
    </html>
  );
}
