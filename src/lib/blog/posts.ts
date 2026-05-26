export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified: string;
  category: string;
  readingTimeMin: number;
  keywords: string[];
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "importar-facturas-monitor-informatica",
    title:
      "Cómo importar facturas en Monitor Informática (miConta) desde Excel: guía 2026",
    description:
      "Guía completa para automatizar la importación de facturas en miConta de Monitor Informática. Compara miConversor, importación manual y extracción con IA, con flujo paso a paso y errores frecuentes.",
    datePublished: "2026-05-26",
    dateModified: "2026-05-26",
    category: "Integraciones",
    readingTimeMin: 9,
    keywords: [
      "monitor informatica importar facturas",
      "miconta importar excel",
      "miconversor facturas",
      "automatizar miconta",
      "facturas pdf miconta",
    ],
  },
  {
    slug: "validacion-nif-cif-facturas",
    title:
      "Validación automática de NIF y CIF en facturas: el error que cuesta horas a tu gestoría",
    description:
      "Cómo funciona el algoritmo de validación de NIF (módulo 23) y CIF en España, por qué el OCR tradicional falla y cómo la IA con post-validación detecta los errores antes de la contabilización.",
    datePublished: "2026-05-26",
    dateModified: "2026-05-26",
    category: "Técnico",
    readingTimeMin: 8,
    keywords: [
      "validacion nif cif factura",
      "algoritmo nif modulo 23",
      "validar cif español",
      "errores nif cif factura",
      "validacion automatica nif",
    ],
  },
  {
    slug: "elegir-software-ocr-gestoria",
    title:
      "Cómo elegir software OCR de facturas para tu gestoría: 7 criterios honestos (2026)",
    description:
      "Checklist práctico para evaluar software OCR de facturas en una gestoría española: precisión real, validación NIF/CIF, integraciones con software contable, RGPD, soporte y escalabilidad.",
    datePublished: "2026-05-26",
    dateModified: "2026-05-26",
    category: "Guía",
    readingTimeMin: 11,
    keywords: [
      "mejor ocr facturas gestoria",
      "software ocr facturas españa",
      "comparativa ocr gestoria",
      "elegir ocr contable",
      "criterios ocr facturas",
    ],
  },
];

export function getPostBySlug(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getRelatedPosts(slug: string, limit = 2): BlogPostMeta[] {
  return BLOG_POSTS.filter((p) => p.slug !== slug).slice(0, limit);
}
