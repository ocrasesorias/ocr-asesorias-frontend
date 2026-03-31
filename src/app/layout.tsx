import { Providers } from "@/app/providers";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { DeferredAnalytics } from "@/components/DeferredAnalytics";

export const metadata: Metadata = {
  title: "KontaScan – De facturas a Excel contable en segundos",
  description: "Automatiza la entrada de facturas con IA y recibe Excel listos para importar en tu software contable. Precisión, seguridad y soporte cercano.",
  keywords: "OCR, contabilidad, facturas, automatización, gestorías, IA, Excel, Monitor Informática",
  authors: [{ name: "KontaScan" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <DeferredAnalytics />
      </body>
    </html>
  );
}
