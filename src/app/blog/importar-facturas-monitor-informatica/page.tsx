import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/BlogPostLayout";
import { getPostBySlug, getRelatedPosts } from "@/lib/blog/posts";

const SLUG = "importar-facturas-monitor-informatica";
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
        Si gestionas las facturas de tus clientes con <strong>miConta de
        Monitor Informática</strong>, ya sabes que la entrada manual es lo que
        más tiempo te come cada mes. Monitor Informática ofrece varias rutas
        para meter facturas en miConta — desde el tecleo directo hasta su
        propia utilidad <em>miConversor</em>, pasando por integraciones de
        terceros con IA. La pregunta no es <em>si</em> se puede automatizar,
        sino <strong>cuál es la ruta menos frágil para el volumen real de tu
        gestoría</strong>.
      </p>

      <p>
        En esta guía repasamos los tres caminos posibles para importar facturas
        en miConta desde Excel, sus límites prácticos y cuándo merece la pena
        cada uno.
      </p>

      <h2>El punto de partida: cómo importa miConta desde Excel</h2>

      <p>
        miConta acepta facturas a través de su sistema de importación desde
        hoja de cálculo. La utilidad oficial se llama <strong>miConversor</strong>
        y su flujo en grandes pinceladas es:
      </p>

      <ol>
        <li>Preparas (o recibes) un fichero <code>.xls</code> con una columna
          por campo: fecha, NIF, base, IVA, total, concepto, etc.</li>
        <li>Cargas el Excel en miConversor.</li>
        <li>La primera vez creas una <strong>plantilla</strong> que mapea las
          columnas a los campos de miConta y vincula subcuentas a NIF
          conocidos.</li>
        <li>Generas el fichero de importación y miConta crea los asientos
          contables automáticamente.</li>
      </ol>

      <div className="callout">
        <strong>Clave del flujo</strong>
        El paso 3 (mapeo + vinculación de subcuentas por NIF) sólo se hace una
        vez por cliente/proveedor. Eso convierte miConversor en una buena
        herramienta para empresas con proveedores estables y recurrentes.
      </div>

      <h2>Las tres rutas reales para automatizar la entrada</h2>

      <h3>1. Tecleo directo en miConta</h3>

      <p>
        Sigue siendo la ruta más extendida en gestorías pequeñas. La curva de
        error es baja porque el contable ve cada factura mientras la introduce,
        pero el coste por factura es muy alto en tiempo. A volúmenes superiores
        a 200-300 facturas/mes empieza a ser inviable.
      </p>

      <h3>2. Excel manual + miConversor</h3>

      <p>
        Una persona del equipo (o el propio cliente) prepara un Excel con
        todas las facturas del periodo. Después, tú lo importas con
        miConversor. Funciona, pero traslada el problema:
      </p>

      <ul>
        <li>Alguien tiene que <strong>leer la factura y teclear</strong> los
          datos en Excel.</li>
        <li>Los errores de tipeo (NIF mal escrito, importe con coma/punto
          intercambiado) pasan a miConta sin filtro.</li>
        <li>Las plantillas son frágiles: un cambio de columnas en el Excel del
          cliente rompe la importación.</li>
      </ul>

      <h3>3. Extracción con IA → Excel compatible miConta → miConversor</h3>

      <p>
        El tercer camino es el que más ha crecido en los últimos dos años.
        Subes el PDF (o la foto) de la factura, una IA híbrida lee el documento,
        valida campos críticos como NIF/CIF e IVA y genera el Excel ya en el
        formato que miConversor espera. Es el modelo que sigue{" "}
        <Link href="/">KontaScan</Link> y otras herramientas similares del
        mercado español.
      </p>

      <h2>Comparativa práctica</h2>

      <table>
        <thead>
          <tr>
            <th>Aspecto</th>
            <th>Tecleo directo</th>
            <th>Excel manual + miConversor</th>
            <th>IA + miConversor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tiempo por factura</td>
            <td>2-4 min</td>
            <td>1-2 min</td>
            <td>~10 seg de validación</td>
          </tr>
          <tr>
            <td>Validación NIF/CIF</td>
            <td>Manual (ojo humano)</td>
            <td>Manual</td>
            <td>Automática con algoritmo</td>
          </tr>
          <tr>
            <td>Tolerancia a facturas escaneadas</td>
            <td>—</td>
            <td>Difícil (hay que leer)</td>
            <td>Sí (vision + OCR)</td>
          </tr>
          <tr>
            <td>Compatibilidad con miConta</td>
            <td>Total</td>
            <td>Total</td>
            <td>Total (genera Excel compatible)</td>
          </tr>
          <tr>
            <td>Coste mensual extra</td>
            <td>0 € (sólo tiempo)</td>
            <td>0 € (sólo tiempo)</td>
            <td>Suscripción según volumen</td>
          </tr>
        </tbody>
      </table>

      <h2>Flujo recomendado paso a paso (con IA)</h2>

      <p>
        Este es el flujo concreto que mejor funciona en una gestoría que ya
        usa miConta y quiere meter automatización con el mínimo cambio:
      </p>

      <ol>
        <li><strong>Recopilación</strong>: el cliente envía las facturas a un
          buzón compartido (Drive, email dedicado, carpeta cifrada).</li>
        <li><strong>Subida masiva</strong>: arrastras los PDFs e imágenes a la
          herramienta de extracción. No hace falta clasificar — la IA distingue
          ingreso/gasto si le indicas el CIF de la empresa.</li>
        <li><strong>Validación</strong>: revisas los campos que la IA ha
          marcado con baja confianza. Para los que pasan validación
          automática (matemática del IVA, NIF correcto, totales cuadran), un
          vistazo de control es suficiente.</li>
        <li><strong>Exportación</strong>: descargas el Excel con la plantilla
          miConta del cliente ya aplicada.</li>
        <li><strong>Importación en miConta</strong>: abres miConversor, cargas
          el Excel, generas el fichero de asientos y miConta los registra.</li>
      </ol>

      <p>
        Con este flujo, el cuello de botella deja de ser el tecleo y pasa a ser
        la <strong>recopilación de las facturas del cliente</strong> — que es
        exactamente donde debería estar el cuello de botella en una gestoría
        moderna.
      </p>

      <h2>Errores frecuentes al automatizar miConta</h2>

      <h3>Confiar al 100% en la IA sin validación humana</h3>
      <p>
        Ninguna herramienta de extracción alcanza el 100% de precisión.
        Trabajar con cifras realistas — del orden del 95% de campos correctos
        en facturas limpias — implica que un humano revisa el output antes de
        meterlo en contabilidad. La automatización acelera el trabajo, no
        sustituye el criterio del contable.
      </p>

      <h3>No fijar bien las subcuentas en miConversor</h3>
      <p>
        miConversor sólo asigna subcuenta automática si encuentra el NIF en la
        tabla de vinculaciones del cliente. La primera importación de un
        proveedor nuevo siempre exige mapeo manual. Es un coste de arranque que
        se paga una sola vez por proveedor recurrente.
      </p>

      <h3>Excel con columnas en orden distinto al de la plantilla</h3>
      <p>
        Si vas a usar miConversor con varios clientes a la vez, fija un
        <strong> formato Excel único</strong> y obliga a tu herramienta de
        extracción a generarlo siempre igual. Cambiar columnas entre lotes
        rompe la importación silenciosamente.
      </p>

      <h3>No validar NIF/CIF antes de importar</h3>
      <p>
        Un NIF mal extraído (con un dígito erróneo en la cabeza) entra en
        miConta como un proveedor nuevo y rompe el cuadre. Validar el dígito de
        control con el <Link href="/blog/validacion-nif-cif-facturas">
        algoritmo módulo 23 (NIF) y los pares/impares (CIF)</Link> en la fase
        de extracción evita el problema antes de que llegue a contabilidad.
      </p>

      <h2>Cuándo merece la pena dar el salto a IA</h2>

      <p>
        Si tu gestoría procesa <strong>menos de 100 facturas al mes</strong>,
        el ahorro real es modesto y miConversor con Excel manual te llega. A
        partir de <strong>200-300 facturas/mes</strong>, cada hora ahorrada
        compensa la suscripción con holgura — y por encima de 500
        facturas/mes, la IA deja de ser opcional y pasa a ser la única forma
        razonable de no contratar más personal sólo para teclear.
      </p>

      <p>
        La buena noticia: <strong>no tienes que cambiar de software contable
        para automatizar</strong>. miConta sigue siendo el sistema de registro,
        sólo cambias <em>cómo se alimentan los datos</em>.
      </p>

      <h2>Preguntas frecuentes sobre miConta y la importación de facturas</h2>

      <h3>¿Necesito una versión concreta de miConta para importar desde Excel?</h3>
      <p>
        miConversor y la importación desde hoja de cálculo están disponibles en
        las versiones actuales de miConta. Conviene confirmar con Monitor
        Informática que tu licencia incluye la utilidad antes de cambiar el
        flujo.
      </p>

      <h3>¿La IA puede leer facturas escaneadas con baja calidad?</h3>
      <p>
        Sí, pero la precisión baja en proporción a la calidad del documento. En
        facturas escaneadas o fotografiadas con ángulos forzados, conviene
        avisar al cliente para que escanee cenital y con luz directa. El paso
        de validación humana absorbe el resto.
      </p>

      <h3>¿Cómo se mantienen vinculadas las subcuentas?</h3>
      <p>
        miConversor guarda el mapeo NIF → subcuenta en la plantilla del
        cliente. Si tu herramienta de extracción exporta el NIF correctamente,
        miConversor lo reconoce y asigna la subcuenta automáticamente en
        importaciones futuras.
      </p>

      <h3>¿KontaScan reemplaza a miConta?</h3>
      <p>
        No. KontaScan automatiza la fase de <strong>extracción y preparación
        del Excel</strong>. miConta sigue siendo el programa contable donde se
        registran los asientos. Son piezas complementarias: una alimenta a la
        otra.
      </p>
    </BlogPostLayout>
  );
}
