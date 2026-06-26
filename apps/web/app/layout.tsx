import type { ReactNode } from "react";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import "@/client/styles/global.css";

// The neo-brutalist stylesheet keys off these family names via --font / --mono.
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap"
});
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata = {
  title: "Agent City",
  description: "A living isometric society for coding agents."
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#161310"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
