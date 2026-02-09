import Image from "next/image";
import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { StickyHeader } from "@/components/StickyHeader";
import { LandingAuthNav } from "@/components/LandingAuthNav";
import { MobileNav } from "@/components/MobileNav";
import { PricingCards } from "@/components/PricingCards";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const hasSession = !!user;

  return (
    <div className="min-h-screen">
      {/* Skip-to-content para accesibilidad */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Saltar al contenido principal
      </a>

      {/* Header */}
      <StickyHeader>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3">
                <Image
                  src="/img/logo.png"
                  alt="KontaScan - Inicio"
                  width={100}
                  height={100}
                  className="h-10 w-auto"
                  priority
                />
                <span className="text-2xl font-bold text-primary">
                  KontaScan
                </span>
              </Link>
            </div>
            <nav className="hidden md:flex space-x-8" aria-label="Navegación principal">
              <a
                href="#beneficios"
                className="text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
              >
                Beneficios
              </a>
              <a
                href="#como-funciona"
                className="text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
              >
                Cómo funciona
              </a>
              <a
                href="#planes"
                className="text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
              >
                Planes
              </a>
              <a
                href="#integraciones"
                className="text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
              >
                Integraciones
              </a>
              <a
                href="#contacto"
                className="text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
              >
                Contacto
              </a>
            </nav>
            <div className="flex items-center gap-2">
              <div className="hidden md:block">
                <LandingAuthNav />
              </div>
              <MobileNav />
            </div>
          </div>
        </div>
      </StickyHeader>

      {/* Hero Section */}
      <main id="main-content">
      <section className="pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <ScrollReveal direction="left">
            <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal text-foreground leading-tight">
              De la factura al Excel contable <br />
              <span className="text-primary"> en segundos.</span>
            </h1>
            <p className="text-lg sm:text-xl text-foreground-secondary mt-6 leading-relaxed">
              Automatiza la entrada de facturas y recibe un Excel listo para importar en tu programa contable. Preciso, seguro y con soporte cercano.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              {hasSession ? (
                <Link
                  href="/dashboard"
                  className="bg-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary-hover transition-colors shadow-lg text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Ir al dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/registro"
                    className="bg-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary-hover transition-colors shadow-lg text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Probar gratis
                  </Link>
                  <Link
                    href="#como-funciona"
                    className="border-2 border-primary text-primary px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary hover:text-white transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Ver cómo funciona
                  </Link>
                </>
              )}
            </div>
            <p className="mt-4 text-sm text-foreground-secondary">
              Funciona con Monitor Informático y los principales softwares contables.
            </p>
            </div>
          </ScrollReveal>
          <ScrollReveal direction="right" delayMs={120}>
            <div className="relative float-slow">
              <Image
                src="/img/hero-img.png"
                alt="Interfaz de KontaScan mostrando la conversión automática de facturas a Excel contable"
                className="w-full h-full object-cover rounded-lg"
                width={500}
                height={500}
              />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Beneficios Section */}
      <section id="beneficios" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-foreground mb-4">
                ¿Por qué elegir KontaScan?
              </h2>
              <p className="text-xl text-foreground-secondary max-w-3xl mx-auto">
                Ahorra horas de trabajo manual transformando facturas en Excel listos para importar. Céntrate en tus clientes, no en el tecleo.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <ScrollReveal delayMs={0}>
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Precisión real
                </h3>
                <p className="text-foreground-secondary">
                  IA + verificación: datos extraídos y validados para reducir errores al mínimo.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={120}>
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Integración sin fricción
                </h3>
                <p className="text-foreground-secondary">
                  Exporta en el formato que usa tu gestoría: Monitor Informático y otros.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={240}>
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Seguridad y cumplimiento
                </h3>
                <p className="text-foreground-secondary">
                  Tratamiento de datos seguro y confidencial. Tu información, protegida.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={360}>
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Acompañamiento cercano
                </h3>
                <p className="text-foreground-secondary">
                  Soporte humano cuando lo necesitas. Te ayudamos a ponerlo en marcha.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Cómo funciona Section */}
      <section id="como-funciona" className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-foreground mb-4">
                Cómo funciona en 3 pasos
              </h2>
              <p className="text-xl text-foreground-secondary">
                Un proceso simple para automatizar tu contabilidad.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8">
          <ScrollReveal delayMs={0}>
            <div className="text-center">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">
                Sube las facturas
              </h3>
              <p className="text-foreground-secondary">
                Arrastra tus PDFs o imágenes de forma segura.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={160}>
            <div className="text-center">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">
                Procesamos con IA
              </h3>
              <p className="text-foreground-secondary">
                Extraemos y categorizamos los datos automáticamente.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={320}>
            <div className="text-center">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">
                Descarga tu Excel
              </h3>
              <p className="text-foreground-secondary">
                Recibe un archivo listo para importar a tu software contable.
              </p>
            </div>
          </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Planes / Precios Section */}
      <PricingCards />

      {/* Integraciones Section */}
      <section id="integraciones" className="py-20 bg-foreground text-white">
        <ScrollReveal>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">
              Integraciones y formatos
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto mb-6">
              KontaScan genera Excel en el formato que tu gestoría ya utiliza. Compatible con Monitor Informático y los programas contables más usados.
            </p>
            <Link
              href="#contacto"
              className="text-white hover:text-white/80 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 rounded-sm"
            >
              Consultar formatos disponibles &rarr;
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <ScrollReveal>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
              ¿Listo para ganar horas cada semana?
            </h2>
            <p className="text-lg sm:text-xl text-foreground-secondary mb-8">
              Empieza hoy y comprueba cómo cambia tu carga de trabajo.
            </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {hasSession ? (
              <Link
                href="/dashboard"
                className="bg-white text-primary px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors shadow-lg text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                Ir al dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/registro"
                  className="bg-white text-primary px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors shadow-lg text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                >
                  Probar gratis
                </Link>
                <Link
                  href="/login"
                  className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-primary transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                >
                  Iniciar sesión
                </Link>
              </>
            )}
          </div>
          </div>
        </ScrollReveal>
      </section>
      </main>

      {/* Footer */}
      <footer id="contacto" className="bg-foreground text-white py-12">
        <ScrollReveal>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold mb-6 flex items-center space-x-3">
                  <Image
                    src="/img/logo.png"
                    alt="KontaScan"
                    width={100}
                    height={100}
                    className="h-10 w-auto"
                  />
                  <span>KontaScan</span>
                </h4>
                <p className="text-foreground-secondary">
                  KontaScan automatiza la extracción de datos de facturas y entrega Excel listos para importar. Precisión, seguridad y soporte cercano.
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-semibold mb-6">Contacto</h4>
                  <div className="space-y-2">
                    <p className="text-foreground-secondary">hola@ocrasesorias.com</p>
                    <p className="text-foreground-secondary">+34 900 123 456</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-6">Legal</h4>
                  <div className="flex flex-col space-y-2">
                    <Link
                      href="/privacidad"
                      className="text-foreground-secondary hover:text-white transition-colors"
                    >
                      Privacidad
                    </Link>
                    <Link
                      href="/terminos"
                      className="text-foreground-secondary hover:text-white transition-colors"
                    >
                      Términos
                    </Link>
                    <Link
                      href="/aviso-legal"
                      className="text-foreground-secondary hover:text-white transition-colors"
                    >
                      Aviso Legal
                    </Link>
                    <Link
                      href="/cookies"
                      className="text-foreground-secondary hover:text-white transition-colors"
                    >
                      Cookies
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-700 mt-8 pt-8 text-center text-foreground-secondary">
              <p>&copy; {new Date().getFullYear()} KontaScan. Todos los derechos reservados.</p>
            </div>
          </div>
        </ScrollReveal>
      </footer>
    </div>
  );
}
