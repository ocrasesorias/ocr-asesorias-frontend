'use client';

import { useRouter } from 'next/navigation';
import { ThemedPage } from '@/components/ThemedPage';

export default function TerminosPage() {
  const router = useRouter();

  return (
    <ThemedPage className="min-h-screen relative" style={{ backgroundColor: "var(--l-bg)" }}>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button onClick={() => router.back()} className="flex items-center transition-colors p-1 mb-6" style={{ color: "var(--l-text-muted)" }}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          <span className="text-sm">Volver</span>
        </button>
        <div className="p-8 md:p-12" style={{ backgroundColor: "var(--l-card)", border: "1px solid var(--l-card-border)" }}>

          <h1 className="text-4xl font-bold text-[color:var(--l-text)] mb-8">
            Términos y Condiciones de Uso – KontaScan
          </h1>

          <div className="prose prose-lg prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                1. Identificación del titular
              </h2>
              <p className="text-[color:var(--l-text-muted)] leading-relaxed">
                KontaScan es un servicio operado por [Nombre legal / razón social], con domicilio en [dirección] y correo de contacto [email].
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                2. Objeto del servicio
              </h2>
              <p className="text-[color:var(--l-text-muted)] leading-relaxed">
                KontaScan es una plataforma que permite subir facturas en formato digital, extraer automáticamente sus datos mediante tecnología OCR e inteligencia artificial y generar archivos Excel listos para su importación en programas contables.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                3. Registro y cuenta
              </h2>
              <ul className="list-disc list-inside space-y-2 text-[color:var(--l-text-muted)] leading-relaxed">
                <li>El uso del servicio requiere registro de usuario.</li>
                <li>El usuario es responsable de mantener la confidencialidad de sus credenciales.</li>
                <li>Cada cuenta está asociada a una organización, responsable del uso del servicio.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                4. Uso permitido
              </h2>
              <p className="text-[color:var(--l-text-muted)] leading-relaxed mb-4">
                El usuario se compromete a:
              </p>
              <ul className="list-disc list-inside space-y-2 text-[color:var(--l-text-muted)] leading-relaxed">
                <li>Utilizar KontaScan únicamente con facturas y documentos de los que tenga derecho de uso.</li>
                <li>No subir contenidos ilícitos, fraudulentos o que vulneren derechos de terceros.</li>
                <li>No intentar acceder, alterar o dañar el sistema.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                5. Procesamiento de facturas y limitación de responsabilidad
              </h2>
              <ul className="list-disc list-inside space-y-2 text-[color:var(--l-text-muted)] leading-relaxed">
                <li>KontaScan automatiza la extracción de datos, pero no garantiza una precisión absoluta.</li>
                <li>El usuario debe revisar y validar los datos antes de su uso contable o fiscal.</li>
                <li>KontaScan no se hace responsable de errores contables, fiscales o legales derivados del uso de los datos sin verificación humana.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                6. Datos y confidencialidad
              </h2>
              <ul className="list-disc list-inside space-y-2 text-[color:var(--l-text-muted)] leading-relaxed">
                <li>Los documentos subidos se tratan de forma confidencial y segura.</li>
                <li>KontaScan no utiliza los documentos para otros fines distintos a la prestación del servicio.</li>
                <li>El tratamiento de datos personales se rige por la Política de Privacidad.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                7. Disponibilidad del servicio
              </h2>
              <ul className="list-disc list-inside space-y-2 text-[color:var(--l-text-muted)] leading-relaxed">
                <li>KontaScan se ofrece &quot;tal cual&quot;, pudiendo sufrir interrupciones por mantenimiento o causas técnicas.</li>
                <li>Se harán esfuerzos razonables para garantizar la continuidad del servicio, sin que ello suponga una obligación contractual de disponibilidad permanente.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                8. Propiedad intelectual
              </h2>
              <ul className="list-disc list-inside space-y-2 text-[color:var(--l-text-muted)] leading-relaxed">
                <li>KontaScan, su software, diseño y marca son propiedad exclusiva del titular.</li>
                <li>El usuario conserva todos los derechos sobre sus documentos y datos.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                9. Planes, pagos y cancelación (si aplica)
              </h2>
              <ul className="list-disc list-inside space-y-2 text-[color:var(--l-text-muted)] leading-relaxed">
                <li>Algunos servicios pueden estar sujetos a planes de pago.</li>
                <li>El usuario puede cancelar su suscripción en cualquier momento.</li>
                <li>No se realizarán devoluciones por periodos ya consumidos, salvo obligación legal.</li>
              </ul>
              <p className="text-[color:var(--l-text-muted)] leading-relaxed mt-4 italic">
                (Si aún no cobras, esta sección puede quedar muy corta o indicar &quot;actualmente gratuito&quot;)
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                10. Baja del servicio
              </h2>
              <ul className="list-disc list-inside space-y-2 text-[color:var(--l-text-muted)] leading-relaxed">
                <li>El usuario puede solicitar la eliminación de su cuenta.</li>
                <li>Al cancelar la cuenta, los datos podrán eliminarse tras un periodo razonable de seguridad.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                11. Modificaciones
              </h2>
              <ul className="list-disc list-inside space-y-2 text-[color:var(--l-text-muted)] leading-relaxed">
                <li>KontaScan se reserva el derecho a modificar estos términos.</li>
                <li>Las modificaciones se comunicarán con antelación razonable.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-[color:var(--l-text)] mb-4">
                12. Legislación aplicable
              </h2>
              <ul className="list-disc list-inside space-y-2 text-[color:var(--l-text-muted)] leading-relaxed">
                <li>Estos términos se rigen por la legislación española.</li>
                <li>Cualquier controversia se someterá a los juzgados y tribunales competentes.</li>
              </ul>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-[#1f2937]">
            <p className="text-sm text-[color:var(--l-text-muted)]">
              Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </main>

      {/* Footer simple */}
      <footer className="bg-transparent text-[color:var(--l-text)] py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[color:var(--l-text-muted)]">
            &copy; {new Date().getFullYear()} KontaScan. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </ThemedPage>
  );
}

