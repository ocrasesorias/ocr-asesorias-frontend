import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/BlogPostLayout";
import { getPostBySlug, getRelatedPosts } from "@/lib/blog/posts";

const SLUG = "validacion-nif-cif-facturas";
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
        Un NIF mal escrito en una factura no parece grave. <strong>Hasta que
        descuadra el modelo 347, genera un proveedor duplicado en
        contabilidad o pasa una inspección como dato inconsistente.</strong> En
        gestorías que procesan cientos de facturas al mes, los errores de NIF y
        CIF son uno de los puntos de fricción más caros — porque consumen
        tiempo en revisar y rehacer trabajo que parecía cerrado.
      </p>

      <p>
        La buena noticia: los identificadores fiscales españoles tienen{" "}
        <strong>algoritmos públicos de validación</strong>, así que detectar el
        99% de los errores de tipeo es trivial — si tu herramienta los aplica.
        Aquí vemos exactamente cómo funcionan y por qué el OCR tradicional los
        ignora.
      </p>

      <h2>La cadena del error: cómo un NIF erróneo arruina cinco procesos</h2>

      <p>
        Imagina que el OCR lee <code>B12345677</code> en lugar del{" "}
        <code>B12345678</code> real de un proveedor. ¿Qué pasa a partir de ahí?
      </p>

      <ol>
        <li>El asiento se contabiliza contra un <strong>proveedor nuevo</strong>
          (no existe ese NIF en la base de datos de clientes/proveedores).</li>
        <li>El cuadre con el saldo del proveedor real falla.</li>
        <li>En el modelo 347, el total imputado al proveedor real está mal.</li>
        <li>Si el error se repite con varios proveedores, el cuadre del
          ejercicio se vuelve <em>opaco</em> y exige una conciliación
          manual.</li>
        <li>Si Hacienda cruza datos, salta la incidencia.</li>
      </ol>

      <p>
        El coste real de un NIF mal extraído no son los 30 segundos de
        rectificación — es la <strong>hora que se pierde encontrándolo
        semanas después</strong>.
      </p>

      <h2>Anatomía del NIF: el algoritmo módulo 23</h2>

      <p>
        El NIF español tiene 8 dígitos numéricos seguidos de una letra. La
        letra es un <strong>dígito de control</strong> que se calcula con la
        siguiente operación:
      </p>

      <ol>
        <li>Tomas los 8 dígitos como un número entero.</li>
        <li>Calculas el resto de dividirlo entre 23 (operación módulo).</li>
        <li>El resto es un número entre 0 y 22 y selecciona una letra de la
          tabla oficial:</li>
      </ol>

      <pre><code>0→T  1→R  2→W  3→A  4→G  5→M
6→Y  7→F  8→P  9→D 10→X 11→B
12→N 13→J 14→Z 15→S 16→Q 17→V
18→H 19→L 20→C 21→K 22→E</code></pre>

      <p>
        Las letras <code>I</code>, <code>Ñ</code>, <code>O</code> y{" "}
        <code>U</code> no aparecen en la tabla a propósito — se excluyen para
        evitar confusiones visuales con números (1, N, 0, V).
      </p>

      <div className="callout">
        <strong>Ejemplo concreto</strong>
        Para el NIF <code>12345678Z</code>: 12345678 ÷ 23 deja resto 14, que
        corresponde a Z. Si el OCR hubiera leído <code>12345677</code>, el
        resto sería 13 (J), no Z → la letra no cuadra → error detectable.
      </div>

      <h3>NIE (extranjeros): la misma idea con un truco</h3>
      <p>
        El NIE empieza por <code>X</code>, <code>Y</code> o <code>Z</code>. Para
        validarlo se sustituye la letra inicial por <code>0</code>,{" "}
        <code>1</code> o <code>2</code> respectivamente y se aplica el mismo
        algoritmo módulo 23.
      </p>

      <h2>Anatomía del CIF: otro algoritmo, otra lógica</h2>

      <p>
        El CIF (identificador de personas jurídicas) <strong>no usa el módulo
        23</strong>. Su estructura es:
      </p>

      <ul>
        <li>1 letra inicial que identifica el tipo de entidad
          (<code>A</code> sociedades anónimas, <code>B</code> limitadas,
          <code>G</code> asociaciones, etc.).</li>
        <li>7 dígitos numéricos.</li>
        <li>1 carácter final de control, que puede ser letra <em>o</em> número
          dependiendo del tipo de entidad.</li>
      </ul>

      <p>El algoritmo de control suma por separado:</p>

      <ul>
        <li><strong>Dígitos en posición par</strong> (2, 4, 6): se suman tal
          cual.</li>
        <li><strong>Dígitos en posición impar</strong> (1, 3, 5, 7): se
          multiplican por 2 y, si el resultado tiene dos cifras, se suman entre
          sí (ejemplo: 7×2=14 → 1+4=5).</li>
      </ul>

      <p>
        La suma total se le calcula la cifra de las unidades; si es 0, queda
        0; si no, se resta de 10. Ese número es el dígito de control. Para
        entidades cuyo carácter de control debe ser letra (A, P, Q, R, N, W, S,
        K), se traduce con una tabla específica.
      </p>

      <div className="callout">
        <strong>¿Por qué importa la distinción?</strong>
        Una herramienta que valide NIF con módulo 23 pero aplique el mismo
        algoritmo al CIF dará falsos errores. Cualquier solución decente trata
        los dos casos por separado, detectando primero si el primer carácter
        es letra (CIF) o dígito (NIF/DNI).
      </div>

      <h2>Por qué el OCR tradicional falla en NIF y CIF</h2>

      <p>
        El OCR clásico extrae texto carácter a carácter sin entender el
        contexto. Los errores típicos son:
      </p>

      <ul>
        <li><strong>O confundida con 0</strong> en CIF que empiezan por letra.</li>
        <li><strong>1 confundido con I o l</strong> en números.</li>
        <li><strong>B confundida con 8</strong> en facturas escaneadas en baja
          resolución.</li>
        <li><strong>S confundida con 5</strong> en letras de control.</li>
      </ul>

      <p>
        El OCR <strong>no comprueba si el resultado tiene sentido</strong>.
        Devuelve la cadena y se acabó.
      </p>

      <h2>Validación post-extracción con IA: cómo se hace bien</h2>

      <p>
        La diferencia entre un sistema robusto y uno frágil está en lo que
        ocurre <em>después</em> de la extracción:
      </p>

      <ol>
        <li><strong>Normalización</strong>: se quitan espacios, guiones y
          puntos. La cadena se pone en mayúsculas.</li>
        <li><strong>Clasificación</strong>: ¿empieza por letra o por dígito?
          ¿Empieza por X/Y/Z? Eso decide qué algoritmo aplicar.</li>
        <li><strong>Validación matemática</strong>: se ejecuta el módulo 23
          (NIF/NIE) o el algoritmo de pares/impares (CIF).</li>
        <li><strong>Reintentos con contexto</strong>: si la validación falla,
          se intenta corregir caracteres ambiguos (<code>O</code>↔
          <code>0</code>, <code>I</code>↔<code>1</code>) y se prueba de nuevo
          la validación.</li>
        <li><strong>Marcado para revisión humana</strong>: si después de los
          intentos la cadena sigue sin validar, el campo se marca como{" "}
          <em>baja confianza</em> en lugar de meterse en contabilidad.</li>
      </ol>

      <p>
        Este flujo es lo que aplica <Link href="/">KontaScan</Link> antes de
        generar el Excel de exportación: cualquier NIF o CIF que no pase el
        dígito de control llega a la pantalla de validación marcado, en lugar
        de pasar a ciegas a tu programa contable.
      </p>

      <h2>Checklist para tu software de facturas</h2>

      <p>
        Si vas a evaluar una herramienta de OCR/IA para facturas, pregúntale
        explícitamente:
      </p>

      <ul>
        <li>¿Validáis NIF, NIE y CIF con sus respectivos algoritmos?</li>
        <li>¿Diferenciáis entre cada tipo antes de validar?</li>
        <li>¿Reintentáis corregir caracteres ambiguos cuando la validación
          falla?</li>
        <li>¿Marcáis los campos no validados o se exportan tal cual?</li>
        <li>¿Vinculáis el NIF a la subcuenta del proveedor para no crear
          duplicados?</li>
      </ul>

      <p>
        Si la respuesta a alguna de las dos primeras es "no", el coste real
        del error termina pagándolo tu equipo en horas de revisión.
      </p>

      <h2>Preguntas frecuentes</h2>

      <h3>¿Qué pasa con identificadores extranjeros (VAT europeo)?</h3>
      <p>
        Cada país tiene su propio formato de IVA intracomunitario y sus reglas.
        Una herramienta orientada a gestorías españolas debería al menos
        detectar que el identificador no es español (por el prefijo de país,
        ej. <code>FR</code>, <code>DE</code>, <code>PT</code>) y aplicar la
        validación correspondiente o, como mínimo, marcarlo para revisión.
      </p>

      <h3>¿Y si el NIF está mal en la propia factura emitida?</h3>
      <p>
        Pasa más de lo que parece. La validación matemática te indica que el
        carácter de control no cuadra, lo que normalmente significa que la
        factura está mal emitida o el escaneo tiene un carácter mal leído. En
        cualquier caso, lo correcto es <strong>parar y verificar</strong>
        antes de contabilizar.
      </p>

      <h3>¿La validación local sustituye al cruce con AEAT?</h3>
      <p>
        No. El algoritmo sólo comprueba la <em>consistencia matemática</em>
        del identificador. Un NIF formalmente correcto puede no existir, o
        existir y no corresponder al titular indicado. El cruce real con AEAT
        (modelo 347, censo de empresarios) es el que confirma la identidad.
        La validación matemática es el <strong>primer filtro barato</strong>
        que evita el 99% de los errores de tipeo.
      </p>

      <h3>¿Las letras I, Ñ, O y U realmente nunca salen en NIF?</h3>
      <p>
        Correcto. La tabla oficial publicada por el Ministerio del Interior
        las excluye precisamente para evitar confusiones con 1, N, 0 y V. Si
        ves un NIF con cualquiera de esas letras, hay un error.
      </p>
    </BlogPostLayout>
  );
}
