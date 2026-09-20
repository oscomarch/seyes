import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: 'Seyes',
  description: 'Your writing, on your machine.',
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
