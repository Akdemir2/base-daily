import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
});

const APP_URL = "https://base-daily-three.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: "Base Daily",

  description:
    "One Base question every day. Answer, earn points and keep your streak alive.",

  applicationName: "Base Daily",

  icons: {
    icon: "/base-daily-icon.png",
    apple: "/base-daily-icon.png",
  },

  openGraph: {
    title: "Base Daily",
    description:
      "One Base question every day. Answer, earn points and keep your streak alive.",
    url: APP_URL,
    siteName: "Base Daily",
    type: "website",
    images: [
      {
        url: "/base-daily-share.png",
        alt: "Base Daily",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Base Daily",
    description:
      "One Base question every day. Answer, earn points and keep your streak alive.",
    images: ["/base-daily-share.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.className}>
      <body>{children}</body>
    </html>
  );
}