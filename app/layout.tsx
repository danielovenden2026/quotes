import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verdex Quotes",
  description: "Create, revise and test Verdex quotations with a customer quote portal.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
