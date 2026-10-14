import "./globals.css";

export const metadata = {
  title: "Polat Transfer – Fahrt bestellen",
  description: "Taxi und Krankenfahrten in Augsburg online bestellen – Polat Transfer",
  manifest: "/manifest.json",
};

export const viewport = { themeColor: "#0f2a44", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
