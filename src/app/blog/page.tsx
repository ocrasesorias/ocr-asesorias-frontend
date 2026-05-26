import type { Metadata } from "next";
import Link from "next/link";
import { ThemedPage } from "@/components/ThemedPage";
import { BLOG_POSTS } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog de KontaScan — automatización de facturas para gestorías",
  description:
    "Artículos prácticos sobre OCR de facturas, validación de NIF/CIF, integración con Monitor Informática y elección de software para gestorías españolas.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog de KontaScan",
    description:
      "Artículos prácticos sobre OCR de facturas, NIF/CIF, Monitor Informática y software para gestorías.",
    url: "/blog",
    type: "website",
  },
};

export default function BlogIndexPage() {
  return (
    <ThemedPage
      className="min-h-screen relative"
      style={{ backgroundColor: "var(--l-bg)" }}
    >
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <nav
          aria-label="Migas de pan"
          className="text-sm mb-8"
          style={{ color: "var(--l-text-muted)" }}
        >
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-primary transition-colors">
                Inicio
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li style={{ color: "var(--l-text-secondary)" }}>Blog</li>
          </ol>
        </nav>

        <header className="mb-12">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ color: "var(--l-text)" }}
          >
            Blog
          </h1>
          <p
            className="text-lg max-w-2xl"
            style={{ color: "var(--l-text-secondary)" }}
          >
            Cómo automatizar el trabajo manual en una gestoría española:
            integraciones, validación de datos fiscales y criterios para elegir
            herramientas que realmente ahorran tiempo.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-5">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="bento-card p-6 sm:p-7 group transition-colors flex flex-col"
              style={{ borderColor: "var(--l-card-border)" }}
            >
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                {post.category}
              </span>
              <h2
                className="text-xl sm:text-2xl font-bold mb-3 group-hover:text-primary transition-colors leading-tight"
                style={{ color: "var(--l-text)" }}
              >
                {post.title}
              </h2>
              <p
                className="text-sm sm:text-base mb-5 leading-relaxed"
                style={{ color: "var(--l-text-secondary)" }}
              >
                {post.description}
              </p>
              <div
                className="mt-auto pt-4 text-xs flex items-center gap-3"
                style={{
                  color: "var(--l-text-muted)",
                  borderTop: "1px solid var(--l-card-border)",
                }}
              >
                <time dateTime={post.datePublished}>
                  {new Date(post.datePublished).toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                <span aria-hidden="true">·</span>
                <span>{post.readingTimeMin} min</span>
              </div>
            </Link>
          ))}
        </div>

        <div
          className="mt-12 pt-6 text-sm text-center"
          style={{
            borderTop: "1px solid var(--l-divider)",
            color: "var(--l-text-muted)",
          }}
        >
          <Link href="/" className="hover:text-primary transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </main>
    </ThemedPage>
  );
}
