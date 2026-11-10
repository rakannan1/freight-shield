import "./globals.css";

export const metadata = {
  title: "Freight Watch",
  description: "Daily monitoring of your carriers' FMCSA records, with email alerts when something changes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
