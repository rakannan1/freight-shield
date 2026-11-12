import "./globals.css";

export const metadata = {
  title: "FreightShield",
  description: "FreightShield watches FMCSA authority, insurance and contact records for every carrier you book, and tells you in plain English what changed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
