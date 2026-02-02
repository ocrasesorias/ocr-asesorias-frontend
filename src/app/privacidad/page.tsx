'use client';

import { useRouter } from 'next/navigation';

export default function PrivacidadPage() {
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
            Política de Privacidad – KontaScan
          </h1>

          <div className="prose prose-lg max-w-none text-foreground">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                1. Responsable del tratamiento
              </h2>
              <p className="text-foreground-secondary leading-relaxed">
                El responsable del tratamiento de los datos es [Nombre legal / razón social], con domicilio en [dirección] y correo electrónico [email de contacto] (en adelante, &quot;KontaScan&quot;).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                2. Datos personales que tratamos
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                KontaScan puede tratar los siguientes datos:
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    a) Datos de usuario
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-foreground-secondary leading-relaxed ml-4">
                    <li>Nombre y apellidos</li>
                    <li>Dirección de correo electrónico</li>
                    <li>Datos de acceso y autenticación</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    b) Datos de uso del servicio
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-foreground-secondary leading-relaxed ml-4">
                    <li>Información sobre el uso de la plataforma</li>
                    <li>Historial de facturas procesadas</li>
                    <li>Configuraciones y preferencias</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    c) Documentos subidos
                  </h3>
                  <p className="text-foreground-secondary leading-relaxed ml-4">
                    Facturas y documentos contables subidos por el usuario, que pueden contener datos personales o fiscales de terceros.
                  </p>
                </div>
              </div>

              <p className="text-foreground-secondary leading-relaxed mt-4">
                KontaScan no solicita ni trata datos especialmente protegidos de forma intencionada.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                3. Finalidad del tratamiento
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                Tratamos los datos con las siguientes finalidades:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>Prestar el servicio de subida, procesamiento y exportación de facturas.</li>
                <li>Gestionar cuentas de usuario y organizaciones.</li>
                <li>Generar archivos Excel listos para su uso contable.</li>
                <li>Atender consultas, soporte y comunicaciones relacionadas con el servicio.</li>
                <li>Garantizar la seguridad, estabilidad y mejora de la plataforma.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                4. Base legal del tratamiento
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                La base legal para el tratamiento de los datos es:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>La ejecución del contrato al utilizar KontaScan.</li>
                <li>El consentimiento del usuario en determinados casos.</li>
                <li>El cumplimiento de obligaciones legales aplicables.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                5. Tratamiento de documentos y confidencialidad
              </h2>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>Los documentos subidos se utilizan únicamente para prestar el servicio.</li>
                <li>KontaScan no analiza ni explota los datos con fines comerciales, publicitarios o estadísticos ajenos al servicio.</li>
                <li>Los documentos se procesan de forma automatizada y segura.</li>
                <li>El acceso a los datos está limitado estrictamente al usuario y su organización.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                6. Uso de inteligencia artificial
              </h2>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>KontaScan utiliza tecnologías de OCR e inteligencia artificial para extraer información de los documentos.</li>
                <li>Estos sistemas se emplean exclusivamente para la prestación del servicio.</li>
                <li>Los datos no se utilizan para entrenar modelos de terceros fuera del ámbito del servicio.</li>
                <li>Los resultados deben ser revisados y validados por el usuario antes de su uso contable o fiscal.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                7. Conservación de los datos
              </h2>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>Los datos se conservarán mientras la cuenta esté activa.</li>
                <li>Tras la baja del servicio, los datos podrán eliminarse en un plazo razonable, salvo obligación legal de conservación.</li>
                <li>El usuario puede solicitar la eliminación anticipada de sus datos.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                8. Cesión de datos a terceros
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                KontaScan no cede datos personales a terceros, salvo:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>Proveedores tecnológicos necesarios para el funcionamiento del servicio (hosting, almacenamiento, servicios técnicos).</li>
                <li>Obligación legal.</li>
              </ul>
              <p className="text-foreground-secondary leading-relaxed mt-4">
                Todos los proveedores cumplen con la normativa de protección de datos y ofrecen garantías adecuadas.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                9. Seguridad de los datos
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                KontaScan aplica medidas técnicas y organizativas adecuadas para proteger los datos, incluyendo:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>Control de accesos</li>
                <li>Cifrado en tránsito y en reposo</li>
                <li>Aislamiento por organización</li>
                <li>Monitorización de seguridad</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                10. Derechos del usuario
              </h2>
              <p className="text-foreground-secondary leading-relaxed mb-4">
                El usuario puede ejercer en cualquier momento los siguientes derechos:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>Acceso a sus datos</li>
                <li>Rectificación</li>
                <li>Supresión</li>
                <li>Limitación del tratamiento</li>
                <li>Oposición</li>
                <li>Portabilidad</li>
              </ul>
              <p className="text-foreground-secondary leading-relaxed mt-4">
                Para ejercerlos, puede escribir a [email de contacto].
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                11. Reclamaciones
              </h2>
              <p className="text-foreground-secondary leading-relaxed">
                Si el usuario considera que sus derechos no han sido respetados, puede presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                12. Cambios en la política de privacidad
              </h2>
              <ul className="list-disc list-inside space-y-2 text-foreground-secondary leading-relaxed">
                <li>KontaScan se reserva el derecho a modificar esta política.</li>
                <li>Las modificaciones se comunicarán de forma clara y con antelación razonable.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                13. Legislación aplicable
              </h2>
              <p className="text-foreground-secondary leading-relaxed">
                Esta política se rige por la normativa vigente en materia de protección de datos, en particular el Reglamento (UE) 2016/679 (RGPD).
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

