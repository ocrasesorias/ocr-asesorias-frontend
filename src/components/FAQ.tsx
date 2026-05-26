import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";

interface RelatedLink {
  label: string;
  href: string;
}

interface FaqItem {
  question: string;
  answer: string;
  relatedLinks?: RelatedLink[];
}

const faqs: FaqItem[] = [
  {
    question: "¿Qué es KontaScan y para quién está pensado?",
    answer:
      "KontaScan es un software SaaS de extracción automática de datos de facturas con IA, diseñado específicamente para gestorías y asesorías contables en España. Subes facturas en PDF o imagen y obtienes un Excel listo para importar en tu programa contable, eliminando la entrada manual de datos.",
    relatedLinks: [
      { label: "Ver beneficios", href: "#beneficios" },
      { label: "Cómo funciona", href: "#como-funciona" },
    ],
  },
  {
    question: "¿Con qué software contable es compatible KontaScan?",
    answer:
      "Actualmente KontaScan genera ficheros Excel compatibles con Monitor Informática. Estamos trabajando en la integración con otros programas contables habituales en España como A3, Contasol y Sage. Si necesitas un formato específico, contáctanos en ocrasesorias@gmail.com y lo estudiamos.",
    relatedLinks: [
      { label: "Integraciones y formatos", href: "#integraciones" },
    ],
  },
  {
    question: "¿Cuánto cuesta KontaScan? ¿Hay prueba gratuita?",
    answer:
      "Sí. Puedes empezar con 25 facturas gratis, sin necesidad de introducir tarjeta. Los planes de pago se adaptan al volumen mensual de tu gestoría — contáctanos en ocrasesorias@gmail.com o en el +34 610 75 50 79 para conocer las tarifas actuales.",
    relatedLinks: [
      { label: "Empezar gratis", href: "/login" },
    ],
  },
  {
    question: "¿Qué precisión tiene la IA al extraer los datos de la factura?",
    answer:
      "Nuestra IA híbrida combina modelos de visión (Anthropic Claude y OpenAI GPT) con extracción de texto OCR para alcanzar una precisión aproximada del 95% en campos clave: NIF/CIF, fecha de emisión, base imponible, IVA por tipos (21%, 10%, 4%) y totales. Además aplicamos validación matemática automática y verificación del formato NIF/CIF español para detectar inconsistencias antes de la exportación.",
    relatedLinks: [
      { label: "Ver detalles de precisión", href: "#beneficios" },
    ],
  },
  {
    question: "¿Cumple KontaScan con el RGPD y la LOPD?",
    answer:
      "Sí. Los datos se transmiten cifrados mediante SSL/TLS y se almacenan en infraestructura europea con Row-Level Security (RLS) a nivel de base de datos. Cumplimos con el Reglamento General de Protección de Datos (RGPD) y la LOPD española. Puedes consultar los detalles completos en nuestra Política de Privacidad.",
    relatedLinks: [
      { label: "Política de Privacidad", href: "/privacidad" },
      { label: "Aviso Legal", href: "/aviso-legal" },
    ],
  },
  {
    question: "¿Soporta facturas escaneadas y fotos de móvil además de PDF?",
    answer:
      "Sí. KontaScan procesa PDFs nativos, PDFs escaneados y fotografías de facturas en formato JPG o PNG. Para imágenes con baja resolución o ángulos forzados, recomendamos escanear con la cámara cenital y buena iluminación para maximizar la precisión de la extracción.",
    relatedLinks: [
      { label: "Cómo subir facturas", href: "#como-funciona" },
    ],
  },
  {
    question: "¿Cómo distingue KontaScan una factura de ingreso de una de gasto?",
    answer:
      "Al subir cada factura indicas si es de ingreso (factura emitida, tu empresa es la vendedora) o de gasto (factura recibida, tu empresa es la compradora). La IA usa esta información junto con el CIF de tu empresa para asignar correctamente los roles de proveedor y cliente en los datos extraídos, evitando confusiones habituales del OCR tradicional.",
    relatedLinks: [
      { label: "Ver el proceso paso a paso", href: "#como-funciona" },
    ],
  },
  {
    question: "¿Qué ocurre si la IA se equivoca en algún campo?",
    answer:
      "Todas las facturas pasan por una interfaz de validación donde tu equipo puede revisar y corregir cualquier campo antes de exportar a Excel. KontaScan está diseñado como un copiloto que acelera el trabajo del contable, no como un sustituto sin supervisión. La validación humana sigue siendo parte del flujo para garantizar calidad contable.",
    relatedLinks: [
      { label: "Cómo funciona la validación", href: "#como-funciona" },
    ],
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export function FAQ() {
  return (
    <section id="faq" className="py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <h2
              className="text-3xl sm:text-4xl font-bold mb-4"
              style={{ color: "var(--l-text)" }}
            >
              Preguntas frecuentes
            </h2>
            <p
              className="text-lg"
              style={{ color: "var(--l-text-secondary)" }}
            >
              Lo que las gestorías nos preguntan antes de empezar.
            </p>
          </div>
        </ScrollReveal>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <ScrollReveal key={faq.question} delayMs={i * 60}>
              <details
                className="bento-card group p-5 sm:p-6 transition-colors"
                style={{ borderColor: "var(--l-card-border)" }}
              >
                <summary
                  className="flex items-start justify-between gap-4 cursor-pointer list-none font-semibold text-base sm:text-lg"
                  style={{ color: "var(--l-text)" }}
                >
                  <span>{faq.question}</span>
                  <svg
                    className="w-5 h-5 mt-0.5 shrink-0 text-primary transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <p
                  className="mt-4 text-sm sm:text-base leading-relaxed"
                  style={{ color: "var(--l-text-secondary)" }}
                >
                  {faq.answer}
                </p>
                {faq.relatedLinks && faq.relatedLinks.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    {faq.relatedLinks.map((link) => {
                      const isInternal = link.href.startsWith("/");
                      const isAnchor = link.href.startsWith("#");
                      if (isInternal && !isAnchor) {
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="inline-flex items-center gap-1 text-primary hover:text-primary-hover font-medium"
                          >
                            <span aria-hidden="true">→</span>
                            {link.label}
                          </Link>
                        );
                      }
                      return (
                        <a
                          key={link.href}
                          href={link.href}
                          className="inline-flex items-center gap-1 text-primary hover:text-primary-hover font-medium"
                        >
                          <span aria-hidden="true">→</span>
                          {link.label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </details>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
