import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alpha Vantage CSV-to-JSON API",
  description: "Public API proxy for Alpha Vantage CSV endpoints",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}