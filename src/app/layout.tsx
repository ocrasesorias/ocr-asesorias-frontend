import { Providers } from "@/app/providers";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { DeferredAnalytics } from "@/components/DeferredAnalytics";

const SITE_URL = "https://kontascan.com";
const SITE_NAME = "KontaScan";
const TITLE = "KontaScan – De facturas a Excel contable en segundos";
const DESCRIPTION =
  "Automatiza la entrada de facturas con IA y recibe Excel listos para importar en tu software contable. Precisión, seguridad y soporte cercano para gestorías.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | KontaScan",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "KontaScan" }],
  creator: "KontaScan",
  publisher: "KontaScan",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "business",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/img/logo.png`,
  description: DESCRIPTION,
  areaServed: {
    "@type": "Country",
    name: "Spain",
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "AccountingSoftware",
  operatingSystem: "Web",
  description:
    "Software SaaS de extracción automática de datos de facturas con IA para gestorías y asesorías españolas. Convierte PDFs e imágenes de facturas en Excel listo para importar en software contable (A3, Contasol, Sage, Holded).",
  url: SITE_URL,
  inLanguage: "es-ES",
  audience: {
    "@type": "BusinessAudience",
    audienceType: "Gestorías y asesorías contables en España",
  },
  featureList: [
    "Extracción automática de datos de facturas con IA",
    "Soporte para PDF e imágenes escaneadas",
    "Validación de NIF/CIF español",
    "Desglose de IVA por tipos (21%, 10%, 4%)",
    "Exportación a Excel para software contable",
    "Distinción automática entre facturas de ingreso y gasto",
  ],
  offers: {
    "@type": "Offer",
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareApplicationSchema),
          }}
        />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <DeferredAnalytics />
      </body>
    </html>
  );
}
