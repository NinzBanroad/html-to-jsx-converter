import "./globals.css";

export const metadata = {
  title: "HTML → JSX Converter",
  description: "Convert HTML files to JSX, with section splitting.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
