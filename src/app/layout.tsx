import type { Metadata } from "next";
import Providers from "./providers";
import "../index.css";
import "maplibre-gl/dist/maplibre-gl.css";

const metadataBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: "azeen App",
  description: "azeen Web Application",
  authors: [{ name: "azeen" }],
  icons: {
    icon: "/azeen-logo.webp",
  },
  openGraph: {
    title: "azeen App",
    description: "azeen Web Application",
    type: "website",
    images: ["/azeen-logo.webp"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@azeen",
    images: ["/azeen-logo.webp"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
