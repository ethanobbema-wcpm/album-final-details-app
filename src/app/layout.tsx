import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Final Album Details",
  description: "Album final details intake for producers"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
