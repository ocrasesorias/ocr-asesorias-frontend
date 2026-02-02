'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AvisoLegalPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background relative">
      {/* Botón volver - superpuesto en esquina superior izquierda */}
      <button
        onClick={() => router.back()}
        className="fixed top-6 left-6 z-50 flex items-center text-foreground-secondary hover:text-foreground transition-colors"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Volver
      </button>

      {/* Contenido */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-20">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Aviso Legal – KontaScan
          </h1>
          
          <p className="text-foreground-secondary leading-relaxed mb-8">
            En cumplimiento con lo dispuesto en la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa a los usuarios de los siguientes datos:
          </p>

          <div className="prose prose-lg max-w-none text-foreground">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                1. Datos del titular
              </h2>
              <ul className="list-none space-y-2 text-foreground-secondary leading-relaxed">
                <li><strong className="text-foreground">Titular:</strong> [Nombre y apellidos / Razón social]</li>
                <li><strong className="text-foreground">NIF/CIF:</strong> [NIF o CIF]</li>
                <li><strong className="text-foreground">Domicilio:</strong> [Dirección completa]</li>
                <li><strong className="text-foreground">Correo electrónico:</strong> [Email de contacto]</li>
              </ul>
              <p className="text-foreground-secondary leading-relaxed mt-4">
                En adelante, KontaScan.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                2. Objeto
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                El presente Aviso Legal regula el acceso, navegación y uso del sitio web [dominio], así como los servicios ofrecidos a través de la plataforma KontaScan.
              </p>
              <p className="text-foreground-secondary leading-relaxed">
                KontaScan es una solución tecnológica que permite automatizar la entrada de facturas, extraer información mediante OCR e inteligencia artificial y generar archivos Excel listos para su uso contable.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                3. Condiciones de uso
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                El acceso y uso del sitio web atribuye la condición de usuario e implica la aceptación plena y sin reservas del presente Aviso Legal, así como de los Términos y Condiciones y la Política de Privacidad.
              </p>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                El usuario se compromete a:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>Hacer un uso adecuado y lícito del sitio web.</li>
                <li>No realizar acciones que puedan dañar, inutilizar o sobrecargar la plataforma.</li>
                <li>No utilizar el servicio con fines ilícitos o contrarios a la normativa vigente.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                4. Responsabilidad
              </h2>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>KontaScan no garantiza la disponibilidad permanente del sitio web ni la ausencia de errores técnicos, aunque realizará esfuerzos razonables para asegurar su correcto funcionamiento.</li>
                <li>KontaScan no se responsabiliza del uso que los usuarios hagan de la información obtenida a través del servicio, ni de las decisiones contables, fiscales o legales tomadas a partir de los datos generados sin la debida verificación humana.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                5. Propiedad intelectual e industrial
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                Todos los contenidos del sitio web (textos, diseños, software, logotipos, marcas, código fuente, etc.) son titularidad de KontaScan o de terceros autorizados, y están protegidos por la normativa de propiedad intelectual e industrial.
              </p>
              <p className="text-foreground-secondary leading-relaxed">
                Queda prohibida su reproducción, distribución o modificación sin autorización expresa del titular.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                6. Enlaces a terceros
              </h2>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>El sitio web puede incluir enlaces a páginas de terceros.</li>
                <li>KontaScan no se responsabiliza del contenido, políticas o prácticas de dichos sitios externos.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                7. Protección de datos
              </h2>
              <p className="text-foreground-secondary leading-relaxed">
                El tratamiento de los datos personales se rige por lo dispuesto en la <Link href="/privacidad" className="text-primary hover:text-primary-hover underline">Política de Privacidad</Link>, disponible en este sitio web.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                8. Legislación aplicable y jurisdicción
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                El presente Aviso Legal se rige por la legislación española.
              </p>
              <p className="text-foreground-secondary leading-relaxed">
                Para la resolución de cualquier conflicto que pudiera derivarse del acceso o uso del sitio web, las partes se someten a los juzgados y tribunales competentes, salvo que la normativa de protección de consumidores disponga lo contrario.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                9. Contacto
              </h2>
              <p className="text-foreground-secondary leading-relaxed">
                Para cualquier duda relacionada con este Aviso Legal, puede contactar con KontaScan a través del correo electrónico [email de contacto].
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-foreground-secondary">
              Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </main>

      {/* Footer simple */}
      <footer className="bg-foreground text-white py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-foreground-secondary">
            &copy; {new Date().getFullYear()} KontaScan. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

