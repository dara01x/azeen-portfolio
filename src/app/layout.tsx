import type { Metadata } from "next";
import Providers from "./providers";
import "../index.css";

export const metadata: Metadata = {
  title: "azeen App",
  description: "azeen Web Application",
  authors: [{ name: "azeen" }],
  icons: {
    icon: "/azeen-favicon.svg",
  },
  openGraph: {
    title: "azeen App",
    description: "azeen Web Application",
    type: "website",
    images: ["/azeen-og-image.svg"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@azeen",
    images: ["/azeen-og-image.svg"],
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
