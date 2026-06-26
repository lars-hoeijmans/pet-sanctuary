import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Agent Pet Sanctuary",
  description: "Local-first Living Room Kernel for persistent agent pets"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111916"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
