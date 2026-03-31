import { GridCell } from "@/components/GridCell";
import { LandingAuthNav } from "@/components/LandingAuthNav";
import { LandingThemeProvider } from "@/components/LandingThemeProvider";
import { LandingThemeToggle } from "@/components/LandingThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { PricingCards } from "@/components/PricingCards";
import { ScrollReveal } from "@/components/ScrollReveal";
import { StickyHeader } from "@/components/StickyHeader";
import { createClient } from "@/lib/supabase/server";
import { isStripeEnabled } from "@/lib/features";
import Image from "next/image";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const hasSession = !!user;

  return (
    <LandingThemeProvider>
      <div className="min-h-screen">
        {/* Skip-to-content */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:bg-secondary focus:text-white focus:px-4 focus:py-2 focus:rounded-none focus:text-sm focus:font-medium"
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
                  <span className="text-2xl font-bold" style={{ color: 'var(--l-text)' }}>
                    KontaScan
                  </span>
                </Link>
              </div>
              <nav className="hidden md:flex space-x-8" aria-label="Navegacion principal">
                {[
                  { href: '#beneficios', label: 'Beneficios' },
                  { href: '#como-funciona', label: 'Como funciona' },
                  ...(isStripeEnabled ? [{ href: '#planes', label: 'Planes' }] : []),
                  { href: '#contacto', label: 'Contacto' },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="landing-nav-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 rounded-sm"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="flex items-center gap-3">
                <div className="hidden md:block">
                  <LandingAuthNav />
                </div>
                <MobileNav />
                <LandingThemeToggle />
              </div>
            </div>
          </div>
        </StickyHeader>

        <main id="main-content" className="landing-section">
            {/* Glow effect */}
            <div className="landing-glow top-[-200px] left-1/2 -translate-x-1/2" />

            {/* Grid cells — asymmetric, organic, full page */}
            {/* ── Hero zone ── */}
            <GridCell style={{ top: 128, left: 0 }} delay={0} />
            <GridCell style={{ top: 192, left: 0 }} delay={0.1} />
            <GridCell style={{ top: 192, left: 64 }} delay={0.15} />
            <GridCell style={{ top: 64, left: 'calc(var(--grid-right-base) - 64px)' }} delay={0.05} />
            <GridCell style={{ top: 192, left: 512 }} delay={0.2} />
            <GridCell style={{ top: 384, left: 448 }} delay={0.12} />
            {/* ── Bento zone ── pair + lone */}
            <GridCell style={{ top: 640, left: 576 }} delay={0.1} />
            <GridCell style={{ top: 640, left: 640 }} delay={0.15} />
            <GridCell style={{ top: 960, left: 0 }} delay={0.05} />
            {/* ── Como funciona ── pair */}
            <GridCell style={{ top: 1088, left: 0 }} delay={0} />
            <GridCell style={{ top: 1088, left: 64 }} delay={0.08} />
            {/* ── Planes ── pair + pair */}
            <GridCell style={{ top: 1856, left: 'calc(var(--grid-right-base) - 64px)' }} delay={0.05} />
            <GridCell style={{ top: 1920, left: 'calc(var(--grid-right-base) - 64px)' }} delay={0.1} />
            <GridCell style={{ top: 2048, left: 256 }} delay={0.05} />
            <GridCell style={{ top: 2048, left: 320 }} delay={0.1} />
            {/* ── Post-planes ── triplet */}
            <GridCell style={{ top: 2752, left: 256 }} delay={0.05} />
            <GridCell style={{ top: 2752, left: 320 }} delay={0.1} />
            <GridCell style={{ top: 2816, left: 256 }} delay={0.15} />
            {/* ── Integraciones ── pair */}
            <GridCell style={{ top: 3392, left: 0 }} delay={0.05} />
            <GridCell style={{ top: 3456, left: 0 }} delay={0.1} />
            <GridCell style={{ top: 3520, left: 'calc(var(--grid-right-base) - 192px)' }} delay={0.08} />
            <GridCell style={{ top: 3520, left: 'calc(var(--grid-right-base) - 128px)' }} delay={0.12} />
            {/* ── CTA ── triplet reversed, left */}
            <GridCell style={{ top: 3712, left: 64 }} delay={0.05} />
            <GridCell style={{ top: 3712, left: 0 }} delay={0.1} />
            <GridCell style={{ top: 3776, left: 0 }} delay={0.15} />

            {/* Hero */}
            <section className="relative z-10 pt-36 pb-20 sm:pt-40 sm:pb-28">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                {/* Badge */}
                <ScrollReveal direction="up" delayMs={0}>
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-none mb-8"
                    style={{ backgroundColor: 'var(--l-badge-bg)', border: '1px solid var(--l-badge-border)' }}
                  >
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm text-primary font-medium">
                      Automatizacion contable con IA
                    </span>
                  </div>
                </ScrollReveal>

                {/* Headline */}
                <ScrollReveal direction="up" delayMs={150}>
                  <h1
                    className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight"
                    style={{ color: 'var(--l-text)' }}
                  >
                    De la factura al Excel contable{" "}
                    <span className="text-primary">en segundos.</span>
                  </h1>
                </ScrollReveal>

                {/* Subtitle */}
                <ScrollReveal direction="up" delayMs={300}>
                  <p
                    className="text-lg sm:text-xl mt-6 max-w-2xl mx-auto leading-relaxed"
                    style={{ color: 'var(--l-text-secondary)' }}
                  >
                    Automatiza la entrada de facturas y recibe un Excel listo para importar en tu programa contable. Preciso, seguro y con soporte cercano.
                  </p>
                </ScrollReveal>

                {/* CTA Buttons */}
                <ScrollReveal direction="up" delayMs={450}>
                  <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                    {hasSession ? (
                      <Link
                        href="/panel"
                        className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-all shadow-lg shadow-secondary/20 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                      >
                        Ir al panel
                      </Link>
                    ) : isStripeEnabled ? (
                      <>
                        <Link
                          href="/registro"
                          className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-all shadow-lg shadow-secondary/20 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                        >
                          Empieza gratis
                        </Link>
                        <Link
                          href="#como-funciona"
                          className="landing-outline-btn px-8 py-4 rounded-none text-lg font-semibold text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                        >
                          Ver cómo funciona
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-all shadow-lg shadow-secondary/20 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                        >
                          Iniciar sesion
                        </Link>
                        <Link
                          href="#como-funciona"
                          className="landing-outline-btn px-8 py-4 rounded-none text-lg font-semibold text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                        >
                          Ver cómo funciona
                        </Link>
                      </>
                    )}
                  </div>
                </ScrollReveal>

                {/* Trust line */}
                <ScrollReveal direction="up" delayMs={600}>
                  <p className="mt-6 text-sm" style={{ color: 'var(--l-text-muted)' }}>
                    Empieza con <span className="font-semibold" style={{ color: 'var(--l-text-secondary)' }}>25 facturas gratis</span>, sin tarjeta. Compatible con Monitor Informatico.
                  </p>
                </ScrollReveal>
              </div>
            </section>

            {/* Beneficios — Bento Grid */}
            <section id="beneficios" className="relative z-10 pb-24 sm:pb-32">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <ScrollReveal>
                  <div className="text-center mb-14">
                    <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--l-text)' }}>
                      Acceso al futuro de la contabilidad
                    </h2>
                    <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--l-text-secondary)' }}>
                      Ahorra horas de trabajo manual transformando facturas en Excel listos para importar. Centrate en tus clientes, no en el tecleo.
                    </p>
                  </div>
                </ScrollReveal>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                  {/* Card 1 — Large: App preview (spans 2 cols) */}
                  <ScrollReveal delayMs={0} className="md:col-span-2">
                    <div className="bento-card p-6 sm:p-8 h-full flex flex-col justify-between min-h-[280px]">
                      <div>
                        <span className="inline-block text-xs font-semibold tracking-wider text-primary uppercase mb-3">
                          Plataforma
                        </span>
                        <h3 className="text-xl sm:text-2xl font-bold mb-3" style={{ color: 'var(--l-text)' }}>
                          Procesa facturas a escala con ayuda de nuestra IA
                        </h3>
                        <p style={{ color: 'var(--l-text-secondary)' }} className="max-w-md">
                          Sube tus PDFs, la IA extrae los datos y tu los validas en una interfaz pensada para contables.
                        </p>
                      </div>
                      <div
                        className="mt-6 rounded-none overflow-hidden"
                        style={{ border: '1px solid var(--l-card-border)' }}
                      >
                        <Image
                          src="/img/bento-card-landing-img-3.jpg"
                          alt="Flujo de procesamiento de facturas con IA en KontaScan"
                          width={600}
                          height={340}
                          className="w-full h-auto object-cover"
                          style={{ opacity: 'var(--l-img-opacity)', filter: 'var(--l-img-filter)' }}
                        />
                      </div>
                    </div>
                  </ScrollReveal>

                  {/* Card 2 — Stat: Precision */}
                  <ScrollReveal delayMs={120}>
                    <div className="bento-card p-6 sm:p-8 h-full flex flex-col justify-between min-h-[280px]">
                      <div>
                        <span className="inline-block text-xs font-semibold tracking-wider text-primary uppercase mb-3">
                          Precision
                        </span>
                        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--l-text)' }}>
                          Precision real
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--l-text-secondary)' }}>
                          Datos extraidos y validados para reducir errores al minimo.
                        </p>
                      </div>
                      <div className="mt-6">
                        <div className="text-6xl sm:text-7xl font-bold text-primary">
                          99<span className="text-4xl">%</span>
                        </div>
                        <p className="text-sm mt-1" style={{ color: 'var(--l-text-muted)' }}>
                          Tasa de extraccion correcta
                        </p>
                        {/* Verification tags */}
                        <div className="flex flex-wrap gap-2 mt-4">
                          {['NIF/CIF', 'IVA', 'Totales'].map((label) => (
                            <span
                              key={label}
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 bg-primary/10 border border-primary/20"
                              style={{ color: 'var(--l-text-secondary)' }}
                            >
                              <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>

                  {/* Card 3 — Integration */}
                  <ScrollReveal delayMs={180}>
                    <div className="bento-card p-6 sm:p-8 h-full flex flex-col justify-between min-h-[280px]">
                      <div>
                        <span className="inline-block text-xs font-semibold tracking-wider text-primary uppercase mb-3">
                          Integracion
                        </span>
                        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--l-text)' }}>
                          Integracion sin friccion
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--l-text-secondary)' }}>
                          Exporta en el formato que usa tu gestoria: Monitor Informatico y otros.
                        </p>
                      </div>
                      {/* Mini spreadsheet preview */}
                      <div className="mt-4 rounded-none border overflow-hidden" style={{ borderColor: 'var(--l-card-border)' }}>
                        <div className="grid grid-cols-[1fr_1.2fr_0.8fr_0.8fr] text-[10px] font-semibold bg-primary/10 border-b" style={{ borderColor: 'var(--l-card-border)' }}>
                          <div className="px-2 py-1.5 text-primary">Fecha</div>
                          <div className="px-2 py-1.5 text-primary">NIF</div>
                          <div className="px-2 py-1.5 text-primary text-right">Base</div>
                          <div className="px-2 py-1.5 text-primary text-right">Total</div>
                        </div>
                        {[
                          ['15/03/26', 'B123•••78', '1.200,00', '1.452,00'],
                          ['12/03/26', 'A876•••21', '850,00', '1.028,50'],
                          ['08/03/26', 'B998•••66', '3.500,00', '4.235,00'],
                        ].map((row, i, arr) => (
                          <div
                            key={i}
                            className={`grid grid-cols-[1fr_1.2fr_0.8fr_0.8fr] text-[10px]${i < arr.length - 1 ? ' border-b' : ''}`}
                            style={{ borderColor: 'var(--l-card-border)', color: 'var(--l-text-secondary)' }}
                          >
                            <div className="px-2 py-1">{row[0]}</div>
                            <div className="px-2 py-1 font-mono">{row[1]}</div>
                            <div className="px-2 py-1 text-right">{row[2]}</div>
                            <div className="px-2 py-1 text-right font-medium" style={{ color: 'var(--l-text)' }}>{row[3]}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollReveal>

                  {/* Card 4 — Time saved */}
                  <ScrollReveal delayMs={240}>
                    <div className="bento-card p-6 sm:p-8 h-full flex flex-col justify-between min-h-[220px]">
                      <div>
                        <span className="inline-block text-xs font-semibold tracking-wider text-primary uppercase mb-3">
                          Eficiencia
                        </span>
                        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--l-text)' }}>
                          Ahorra tiempo
                        </h3>
                      </div>
                      <div>
                        <div className="text-5xl sm:text-6xl font-bold" style={{ color: 'var(--l-text)' }}>
                          90<span className="text-3xl text-primary">%</span>
                        </div>
                        <p className="text-sm mt-1" style={{ color: 'var(--l-text-muted)' }}>
                          Menos tiempo en entrada manual
                        </p>
                        {/* Mini bar chart */}
                        <div className="flex items-end gap-1.5 mt-4 h-12">
                          {[3, 5, 7, 6, 9, 8, 10, 12].map((h, i) => (
                            <div
                              key={i}
                              className="w-3 rounded-sm"
                              style={{
                                height: `${h * 4}px`,
                                backgroundColor: `color-mix(in srgb, var(--primary) ${20 + i * 10}%, transparent)`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>

                  {/* Card 5 — Security */}
                  <ScrollReveal delayMs={300}>
                    <div className="bento-card p-6 sm:p-8 h-full flex flex-col justify-between min-h-[220px]">
                      <div>
                        <span className="inline-block text-xs font-semibold tracking-wider text-primary uppercase mb-3">
                          Seguridad
                        </span>
                        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--l-text)' }}>
                          Seguridad y cumplimiento
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--l-text-secondary)' }}>
                          Tratamiento de datos seguro y confidencial. Tu informacion, protegida.
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-4">
                        <div className="w-20 h-20 rounded-none overflow-hidden border border-primary/20 shrink-0">
                          <Image
                            src="/img/bento-card-landing-shield.jpg"
                            alt="Escudo de seguridad"
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                            style={{ opacity: 'var(--l-img-opacity)', filter: 'var(--l-img-filter)' }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {['SSL/TLS', 'RGPD', 'RLS'].map((label) => (
                            <span
                              key={label}
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 bg-primary/10 border border-primary/20"
                              style={{ color: 'var(--l-text-secondary)' }}
                            >
                              <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                </div>
              </div>
            </section>
          {/* Como funciona */}
          <section id="como-funciona" className="py-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <ScrollReveal>
                <div className="text-center mb-16">
                  <h2 className="text-4xl font-bold mb-4" style={{ color: 'var(--l-text)' }}>
                    Como funciona en 3 pasos
                  </h2>
                  <p className="text-xl" style={{ color: 'var(--l-text-secondary)' }}>
                    Un proceso simple para automatizar tu contabilidad.
                  </p>
                </div>
              </ScrollReveal>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { n: '01', title: 'Sube las facturas', desc: 'Arrastra tus PDFs o imágenes. Procesamos cualquier formato de factura española.', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
                  { n: '02', title: 'Procesamos con IA', desc: 'Nuestra IA híbrida extrae y categoriza todos los campos automáticamente.', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', accent: true },
                  { n: '03', title: 'Descarga tu Excel', desc: 'Recibe un archivo listo para importar en Monitor Informático.', icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                ].map((step, i) => (
                  <ScrollReveal key={step.n} delayMs={i * 160}>
                    <div className="bento-card p-8 h-full flex flex-col">
                      <div className="flex items-center gap-4 mb-6">
                        <span className={`text-xs font-bold tracking-widest ${step.accent ? 'text-secondary' : 'text-primary'}`}>{step.n}</span>
                        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--l-card-border)' }} />
                      </div>
                      <div className={`w-12 h-12 flex items-center justify-center mb-5 ${step.accent ? 'bg-secondary/10 border border-secondary/20' : 'bg-primary/10 border border-primary/20'}`}>
                        <svg className={`w-6 h-6 ${step.accent ? 'text-secondary' : 'text-primary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--l-text)' }}>
                        {step.title}
                      </h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--l-text-secondary)' }}>
                        {step.desc}
                      </p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* Planes */}
          {isStripeEnabled && <PricingCards hasSession={hasSession} />}

          {/* Integraciones */}
          <section id="integraciones" className="py-20">
            <ScrollReveal>
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 className="text-4xl font-bold mb-4" style={{ color: 'var(--l-text)' }}>
                  Integraciones y formatos
                </h2>
                <p className="text-xl max-w-3xl mx-auto mb-6" style={{ color: 'var(--l-text-secondary)' }}>
                  KontaScan genera Excel en el formato que tu gestoria ya utiliza. Compatible actualmente con Monitor Informatico y trabajando para otros programas contables.
                </p>
              </div>
            </ScrollReveal>
          </section>

          {/* CTA */}
          <section className="py-20">
            <ScrollReveal>
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{ color: 'var(--l-text)' }}>
                  Listo para ganar horas cada semana?
                </h2>
                <p className="text-lg sm:text-xl mb-8" style={{ color: 'var(--l-text-secondary)' }}>
                  Empieza hoy y comprueba como cambia tu carga de trabajo.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {hasSession ? (
                    <Link
                      href="/panel"
                      className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-colors shadow-lg text-center"
                    >
                      Ir al panel
                    </Link>
                  ) : isStripeEnabled ? (
                    <>
                      <Link
                        href="/registro"
                        className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-colors shadow-lg text-center"
                      >
                        Empieza gratis
                      </Link>
                      <Link
                        href="/login"
                        className="border-2 border-secondary text-secondary px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary hover:text-white transition-colors text-center"
                      >
                        Iniciar sesion
                      </Link>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-colors shadow-lg text-center"
                    >
                      Iniciar sesion
                    </Link>
                  )}
                </div>
              </div>
            </ScrollReveal>
          </section>
        </main>

        {/* WhatsApp */}
        <a
          href="https://wa.me/34610755079"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contactar por WhatsApp"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-110"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-7 w-7" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>

        {/* Footer — grid background + accent border */}
        <footer
          id="contacto"
          className="relative py-12 overflow-hidden"
          style={{
            backgroundColor: 'var(--l-bg)',
            color: 'var(--l-text)',
            borderTop: '1px solid var(--primary)',
          }}
        >
          <ScrollReveal>
            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Top row: logo + inline links */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
                <div className="md:max-w-sm">
                  <div className="flex items-center space-x-3 mb-4">
                    <Image src="/img/logo.png" alt="KontaScan" width={100} height={100} className="h-10 w-auto" />
                    <span className="text-xl font-semibold">KontaScan</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--l-text-secondary)' }}>
                    Automatiza la extraccion de datos de facturas y entrega Excel listos para importar. Precision, seguridad y soporte cercano.
                  </p>
                </div>
                <div className="flex gap-16">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">Contacto</h4>
                    <div className="space-y-2">
                      <a href="mailto:ocrasesorias@gmail.com" className="block text-sm hover:text-primary transition-colors" style={{ color: 'var(--l-text-secondary)' }}>
                        ocrasesorias@gmail.com
                      </a>
                      <a href="https://wa.me/34610755079" target="_blank" rel="noopener noreferrer" className="block text-sm hover:text-primary transition-colors" style={{ color: 'var(--l-text-secondary)' }}>
                        +34 610 75 50 79
                      </a>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">Legal</h4>
                    <div className="flex flex-col space-y-2">
                      {[
                        { href: '/privacidad', label: 'Privacidad' },
                        { href: '/terminos', label: 'Terminos' },
                        { href: '/aviso-legal', label: 'Aviso Legal' },
                        { href: '/cookies', label: 'Cookies' },
                      ].map((link) => (
                        <Link key={link.href} href={link.href} className="text-sm hover:text-primary transition-colors" style={{ color: 'var(--l-text-secondary)' }}>
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Bottom bar */}
              <div className="mt-10 pt-6 text-center text-xs" style={{ borderTop: '1px solid var(--l-divider)', color: 'var(--l-footer-text)' }}>
                <p>&copy; {new Date().getFullYear()} KontaScan. Todos los derechos reservados.</p>
              </div>
            </div>
          </ScrollReveal>
        </footer>
      </div>
    </LandingThemeProvider>
  );
}
