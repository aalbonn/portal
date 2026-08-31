import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Personel Portalı",
  description: "Personel Yönetim Sistemi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body suppressHydrationWarning className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
