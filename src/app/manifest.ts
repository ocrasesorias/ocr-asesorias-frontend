import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KontaScan — De facturas a Excel contable en segundos",
    short_name: "KontaScan",
    description:
      "Automatiza la entrada de facturas con IA y recibe Excel listos para importar en tu software contable.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#2563eb",
    lang: "es-ES",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/img/logo.png",
        sizes: "256x256",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/img/logo.png",
        sizes: "256x256",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
