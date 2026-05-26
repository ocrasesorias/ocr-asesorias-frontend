import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/BlogPostLayout";
import { getPostBySlug, getRelatedPosts } from "@/lib/blog/posts";

const SLUG = "elegir-software-ocr-gestoria";
const meta = getPostBySlug(SLUG)!;

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: { canonical: `/blog/${SLUG}` },
  openGraph: {
    title: meta.title,
    description: meta.description,
    url: `/blog/${SLUG}`,
    type: "article",
    publishedTime: meta.datePublished,
    modifiedTime: meta.dateModified,
    authors: ["KontaScan"],
  },
};

export default function Post() {
  return (
    <BlogPostLayout meta={meta} related={getRelatedPosts(SLUG)}>
      <p>
        Cualquier comparativa de software OCR de facturas que empiece con
        "el mejor es X" está vendiendo algo. En una gestoría española real, la
        herramienta correcta depende del volumen, del programa contable que ya
        usas y de cuánto valoras integraciones específicas para España (NIF/CIF,
        IVA por tipos, modelos AEAT). Esta guía es la inversa:{" "}
        <strong>los 7 criterios que importan</strong> y cómo evaluarlos para tu
        caso, no un ranking que mañana cambia.
      </p>

      <h2>Lo que está en juego (más allá de "ahorrar tiempo")</h2>

      <p>
        El ahorro de horas es la promesa visible, pero no es lo único en
        juego cuando eliges un OCR de facturas:
      </p>

      <ul>
        <li><strong>Riesgo fiscal</strong>: un campo mal extraído llega a tu
          contabilidad y, si no lo detectas, al modelo 347 o al IVA.</li>
        <li><strong>Datos sensibles</strong>: estás procesando información
          fiscal de terceros — el cumplimiento RGPD/LOPD no es opcional.</li>
        <li><strong>Dependencia tecnológica</strong>: una vez metes una
          herramienta en tu flujo, sacarla cuesta. Elegir mal es caro.</li>
        <li><strong>Capacidad de escalar</strong>: lo que funciona con 100
          facturas/mes puede ahogarte con 1.000.</li>
      </ul>

      <p>
        Con eso en mente, los criterios:
      </p>

      <h2>1. Precisión real (no la del folleto)</h2>

      <p>
        Cualquier proveedor te dirá que su precisión es del 95-99%. La pregunta
        útil no es <em>cuánto</em> sino <strong>en qué condiciones</strong>:
      </p>

      <ul>
        <li>¿La cifra es para PDFs nativos limpios o incluye escaneados y
          fotos?</li>
        <li>¿Mide campos clave (NIF, importes, fechas) o cuenta también
          campos triviales?</li>
        <li>¿Aplica validación posterior o sólo extracción bruta?</li>
      </ul>

      <p>
        El test honesto: pide una <strong>prueba con tus propias 25-50
        facturas</strong> (de proveedores reales, en los formatos que recibes
        habitualmente) y mide tú la precisión sobre ese set. Es lo que más se
        parece a tu uso real.
      </p>

      <h2>2. Validación específica para España (NIF/CIF/NIE)</h2>

      <p>
        Una herramienta genérica internacional no sabe que el NIF español
        valida con módulo 23 o que el CIF tiene un algoritmo distinto. El
        resultado: deja pasar errores que un software hecho para España
        detectaría al instante.
      </p>

      <div className="callout">
        <strong>Test directo</strong>
        Pídele a la herramienta que extraiga un NIF deliberadamente mal escrito
        (cambia el último carácter). Si lo acepta sin avisar, no está
        validando. Más detalle en{" "}
        <Link href="/blog/validacion-nif-cif-facturas">cómo funciona la
        validación NIF/CIF</Link>.
      </div>

      <h2>3. Integraciones reales con software contable español</h2>

      <p>
        Aquí es donde más se hincha el discurso comercial. "Compatible con
        Sage, A3, Contasol, Holded…" puede significar dos cosas muy distintas:
      </p>

      <ul>
        <li><strong>Integración real</strong>: el software genera un fichero
          en el formato exacto que el programa contable importa, con las
          columnas en el orden correcto y los códigos de subcuenta vinculados.</li>
        <li><strong>"Excel genérico"</strong>: te dan un CSV/Excel que tú
          tienes que mapear cada vez en el destino.</li>
      </ul>

      <p>
        La pregunta correcta: <strong>"¿Me das un fichero que importo en mi
        software contable sin tocar columnas?"</strong> Si la respuesta es "te
        damos Excel y tú lo adaptas", la integración no está hecha. Esto es
        especialmente crítico si usas software contable menos generalista, como{" "}
        <Link href="/blog/importar-facturas-monitor-informatica">Monitor
        Informática (miConta)</Link>.
      </p>

      <h2>4. Cumplimiento RGPD / LOPD y soberanía del dato</h2>

      <p>
        Estás procesando facturas con datos de personas físicas y jurídicas
        terceras. Lo que tienes que confirmar:
      </p>

      <ul>
        <li><strong>Cifrado en tránsito</strong> (SSL/TLS) y en reposo.</li>
        <li><strong>Servidores en la UE</strong> — preferiblemente con
          residencia confirmada.</li>
        <li><strong>Contrato de encargado de tratamiento</strong> firmado
          según el RGPD (no un PDF con "aceptado", uno real).</li>
        <li><strong>Política de retención y borrado</strong>: ¿cuánto tiempo
          guardan los documentos? ¿Borran al finalizar el contrato?</li>
        <li><strong>Subprocessors</strong>: ¿con quién subcontratan?
          (proveedores cloud, modelos de IA, etc.)</li>
      </ul>

      <p>
        Una respuesta vaga aquí es razón suficiente para descartar a un
        proveedor.
      </p>

      <h2>5. Tolerancia a la variedad real de facturas</h2>

      <p>
        El benchmark "facturas limpias en PDF nativo" no se parece a lo que
        recibes de verdad. Una gestoría española real procesa:
      </p>

      <ul>
        <li>PDFs nativos generados por software de facturación (los fáciles).</li>
        <li>PDFs escaneados de facturas en papel.</li>
        <li>Fotos hechas con el móvil del cliente, a veces con sombras y
          ángulos forzados.</li>
        <li>Tickets en papel térmico.</li>
        <li>Facturas en idiomas extranjeros (proveedores europeos).</li>
        <li>Documentos con tablas anidadas y múltiples líneas de IVA.</li>
      </ul>

      <p>
        Una herramienta que sólo brilla con PDFs nativos es la mitad de la
        herramienta que necesitas.
      </p>

      <h2>6. Soporte en español y proximidad cultural</h2>

      <p>
        Las soluciones internacionales muy buenas en lo técnico fallan en lo
        operativo cuando tienes una duda urgente y el soporte está en otra
        zona horaria, en inglés y con tickets que tardan 48 horas. En una
        gestoría con cierre mensual, eso no es viable.
      </p>

      <p>
        Pregunta concreta: <em>"¿Quién atiende el soporte un lunes a las 9:30
        en plena campaña de IVA, y en qué plazo me responde?"</em>
      </p>

      <h2>7. Escalabilidad y modelo de precios</h2>

      <p>
        Los modelos típicos en el mercado:
      </p>

      <table>
        <thead>
          <tr>
            <th>Modelo</th>
            <th>Cuándo funciona</th>
            <th>Riesgo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Por factura procesada</td>
            <td>Volumen muy variable</td>
            <td>Coste imprevisible en picos</td>
          </tr>
          <tr>
            <td>Por plan mensual con cuota incluida</td>
            <td>Volumen estable</td>
            <td>Pagas cuota mínima en meses flojos</td>
          </tr>
          <tr>
            <td>Por usuario + facturas ilimitadas</td>
            <td>Equipos grandes con mucho volumen por persona</td>
            <td>Caro si tienes pocos usuarios</td>
          </tr>
        </tbody>
      </table>

      <p>
        Calcula <strong>tu coste por factura real</strong> en el plan que más
        encaje, no el precio de cabecera. A 200 facturas/mes el precio por
        factura se ve completamente distinto al de 1.000/mes.
      </p>

      <h2>Panorama del mercado español</h2>

      <p>
        Sin entrar en rankings — que envejecen mal —, los grupos que existen
        hoy:
      </p>

      <ul>
        <li><strong>Plataformas todo-en-uno</strong> con OCR como una pieza
          más (gestión, facturación, contabilidad básica). Útiles si quieres
          una herramienta para todo, pero el OCR no es su foco.</li>
        <li><strong>OCR puro con integraciones contables</strong>: hacen una
          cosa (extracción) y la hacen bien, generando ficheros listos para
          importar en software contable de gestoría. Es el segmento donde
          encaja KontaScan.</li>
        <li><strong>Soluciones internacionales adaptadas</strong> (Klippa,
          Rossum, etc.): muy potentes técnicamente, menos centradas en las
          particularidades fiscales españolas.</li>
        <li><strong>Power Automate / RPA</strong>: si tu organización ya está
          en Microsoft 365 y tienes a alguien que sepa montar flujos, es una
          alternativa válida — pero exige mantenimiento técnico.</li>
      </ul>

      <h2>Errores comunes al elegir</h2>

      <h3>Fijarse sólo en el precio de cabecera</h3>
      <p>
        El plan más barato suele esconder límites de volumen o falta de
        validaciones específicas. Sumar las horas que tu equipo perderá
        corrigiendo errores hace que "lo barato" salga caro.
      </p>

      <h3>No probar con tus propias facturas</h3>
      <p>
        Las demos están preparadas con facturas que el sistema lee bien.
        Probar con tu set real es la única forma de saber qué precisión vas a
        tener tú. Pide siempre un trial con tus documentos.
      </p>

      <h3>Confundir "compatible con X" con "integración real con X"</h3>
      <p>
        Como mencionamos arriba, la diferencia es enorme en el día a día. Pide
        ver el fichero exacto que generan y cómo lo importas en tu programa
        contable.
      </p>

      <h3>Subestimar la curva de cambio</h3>
      <p>
        Cambiar a un nuevo OCR no es sólo cuestión de comprar la suscripción.
        Hay que reconfigurar plantillas, formar al equipo, ajustar el flujo
        con clientes. Calcula 2-4 semanas hasta estar en velocidad de crucero.
      </p>

      <h2>Checklist final para evaluar (10 preguntas)</h2>

      <p>Imprime esto y úsalo en cada demo:</p>

      <ol>
        <li>¿Qué precisión declaran y sobre qué tipo de documentos?</li>
        <li>¿Validan NIF, NIE y CIF con los algoritmos oficiales?</li>
        <li>¿Generan fichero listo para importar en mi software contable
          actual?</li>
        <li>¿Aceptan PDF, imagen y facturas escaneadas?</li>
        <li>¿Dónde se almacenan los datos y por cuánto tiempo?</li>
        <li>¿Tienen contrato de encargado RGPD?</li>
        <li>¿Distinguen automáticamente facturas de ingreso y gasto?</li>
        <li>¿En qué idioma y horario está el soporte?</li>
        <li>¿Puedo probar con mis facturas antes de pagar?</li>
        <li>¿Cuál es el coste mensual a mi volumen real?</li>
      </ol>

      <p>
        Si una herramienta falla en más de tres de estas, casi seguro que no
        es para una gestoría española seria.
      </p>

      <h2>Preguntas frecuentes</h2>

      <h3>¿Vale la pena el OCR si tengo menos de 100 facturas al mes?</h3>
      <p>
        Depende del modelo de precios. Si encuentras un plan de entrada con
        cuota razonable (o trial generoso), incluso a 50-80 facturas/mes
        recuperas el coste en tiempo. Por debajo de 30, normalmente no
        compensa.
      </p>

      <h3>¿Es mejor un OCR especializado o el módulo de mi programa contable?</h3>
      <p>
        Los módulos integrados son cómodos pero suelen quedarse atrás en
        precisión y en formatos soportados. Un OCR especializado que exporta
        en el formato de tu programa contable suele dar mejor relación
        precisión/coste, especialmente con escaneados.
      </p>

      <h3>¿La IA va a sustituir al contable?</h3>
      <p>
        No a corto plazo. El OCR + IA automatiza la <em>extracción y
        clasificación inicial</em>, no el juicio profesional sobre cómo
        contabilizar operaciones complejas o tratar excepciones fiscales. El
        cambio real: el contable deja de teclear y dedica tiempo a lo que
        aporta valor — asesorar al cliente.
      </p>

      <h3>¿Cómo migro datos antiguos al cambiar de herramienta?</h3>
      <p>
        Las facturas históricas ya están contabilizadas en tu programa, no
        hace falta reprocesarlas. La migración real es del <em>flujo</em>:
        configurar plantillas, formar al equipo, ajustar la recogida de
        documentos con clientes. Calcula 2-4 semanas de transición real.
      </p>
    </BlogPostLayout>
  );
}
