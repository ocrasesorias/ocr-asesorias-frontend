'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CookiesPage() {
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
          <h1 className="text-4xl font-bold text-foreground mb-8">
            Política de Cookies – KontaScan
          </h1>

          <div className="prose prose-lg max-w-none text-foreground">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                1. ¿Qué son las cookies?
              </h2>
              <p className="text-foreground-secondary leading-relaxed">
                Las cookies son pequeños archivos que se almacenan en el dispositivo del usuario al acceder a determinadas páginas web, y que permiten el correcto funcionamiento de la plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                2. Cookies utilizadas en KontaScan
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                KontaScan utiliza exclusivamente cookies técnicas y necesarias para el funcionamiento del sitio web y la autenticación de usuarios.
              </p>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                Estas cookies permiten, entre otras funciones:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>Mantener la sesión del usuario iniciada.</li>
                <li>Garantizar la seguridad durante el acceso a la plataforma.</li>
                <li>Recordar preferencias básicas necesarias para el uso del servicio.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                3. Cookies de terceros
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                KontaScan utiliza servicios de terceros que pueden instalar cookies técnicas necesarias para la prestación del servicio, en particular:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li><strong className="text-foreground">Supabase:</strong> gestión de autenticación y sesiones de usuario.</li>
              </ul>
              <p className="text-foreground-secondary leading-relaxed mt-4">
                Estas cookies son estrictamente necesarias para el funcionamiento del servicio y no requieren consentimiento del usuario.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                4. Cookies no utilizadas
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                KontaScan no utiliza:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>Cookies analíticas.</li>
                <li>Cookies publicitarias.</li>
                <li>Cookies de perfilado o seguimiento con fines comerciales.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                5. Gestión de cookies
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                Dado que KontaScan solo utiliza cookies técnicas necesarias, no es necesario mostrar un banner de consentimiento.
              </p>
              <p className="text-foreground-secondary leading-relaxed">
                No obstante, el usuario puede eliminar o bloquear las cookies desde la configuración de su navegador, lo que podría afectar al correcto funcionamiento del servicio.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                6. Más información
              </h2>
              <p className="text-foreground-secondary leading-relaxed">
                Para más información sobre el tratamiento de datos personales, puede consultar la <Link href="/privacidad" className="text-primary hover:text-primary-hover underline">Política de Privacidad</Link>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                7. Actualizaciones
              </h2>
              <p className="text-foreground-secondary leading-relaxed">
                KontaScan se reserva el derecho a modificar la presente Política de Cookies en caso de incorporar nuevas herramientas o servicios que requieran el uso de cookies adicionales.
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

