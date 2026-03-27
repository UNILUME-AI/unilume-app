import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UNILUME — Noon Seller AI Assistant",
  description:
    "Ask anything about Noon seller policies, fees, and procedures. Powered by 223+ official help articles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
