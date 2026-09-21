import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: 'Seyes',
  description: 'Your writing, on your machine.',
}

// Runs before paint so the correct theme (and font) is applied on first
// frame, avoiding a flash of the wrong palette. Kept tiny and
// dependency-free: it only reads localStorage and toggles one attribute.
const THEME_INIT = `
(function () {
  try {
    var t = window.localStorage.getItem('seyes-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
    var r = window.localStorage.getItem('seyes-ruled');
    document.documentElement.setAttribute('data-ruled', r === '0' ? '0' : '1');
  } catch (e) {}
})();
`

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
