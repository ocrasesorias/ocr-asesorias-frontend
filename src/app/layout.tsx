import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

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
        className={`${lexend.variable} antialiased font-light`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
