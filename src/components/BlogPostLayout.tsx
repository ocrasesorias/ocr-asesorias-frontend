import Link from "next/link";
import type { ReactNode } from "react";
import { ThemedPage } from "@/components/ThemedPage";
import type { BlogPostMeta } from "@/lib/blog/posts";

const SITE_URL = "https://kontascan.com";

interface BlogPostLayoutProps {
  meta: BlogPostMeta;
  children: ReactNode;
  related?: BlogPostMeta[];
}

export function BlogPostLayout({
  meta,
  children,
  related = [],
}: BlogPostLayoutProps) {
  const postUrl = `${SITE_URL}/blog/${meta.slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.datePublished,
    dateModified: meta.dateModified,
    inLanguage: "es-ES",
    author: { "@type": "Organization", name: "KontaScan", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "KontaScan",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/img/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    image: `${SITE_URL}/opengraph-image`,
    keywords: meta.keywords.join(", "),
    articleSection: meta.category,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${SITE_URL}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: meta.title,
        item: postUrl,
      },
    ],
  };

  const formattedDate = new Date(meta.datePublished).toLocaleDateString(
    "es-ES",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <ThemedPage
      className="min-h-screen relative"
      style={{ backgroundColor: "var(--l-bg)" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumbs */}
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
            <li>
              <Link href="/blog" className="hover:text-primary transition-colors">
                Blog
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li style={{ color: "var(--l-text-secondary)" }}>{meta.category}</li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 mb-5 text-xs font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--l-badge-bg)",
              border: "1px solid var(--l-badge-border)",
              color: "var(--primary)",
            }}
          >
            {meta.category}
          </div>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-5"
            style={{ color: "var(--l-text)" }}
          >
            {meta.title}
          </h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: "var(--l-text-secondary)" }}
          >
            {meta.description}
          </p>
          <div
            className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
            style={{ color: "var(--l-text-muted)" }}
          >
            <time dateTime={meta.datePublished}>{formattedDate}</time>
            <span aria-hidden="true">·</span>
            <span>{meta.readingTimeMin} min de lectura</span>
            <span aria-hidden="true">·</span>
            <span>KontaScan</span>
          </div>
        </header>

        {/* Article body */}
        <article className="blog-prose">{children}</article>

        {/* CTA box */}
        <aside
          className="mt-16 p-6 sm:p-8"
          style={{
            backgroundColor: "var(--l-card)",
            border: "1px solid var(--l-card-border)",
          }}
        >
          <h2
            className="text-xl sm:text-2xl font-bold mb-3"
            style={{ color: "var(--l-text)" }}
          >
            Prueba KontaScan gratis
          </h2>
          <p
            className="mb-5 leading-relaxed"
            style={{ color: "var(--l-text-secondary)" }}
          >
            Procesa tus primeras 25 facturas sin tarjeta y comprueba la
            extracción con tus propios documentos. Compatible con Monitor
            Informática.
          </p>
          <Link
            href="/login"
            className="inline-block bg-secondary text-white px-6 py-3 font-semibold hover:bg-secondary-hover transition-colors"
          >
            Empezar gratis →
          </Link>
        </aside>

        {/* Related posts */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2
              className="text-xl font-bold mb-6"
              style={{ color: "var(--l-text)" }}
            >
              Sigue leyendo
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="bento-card p-5 group transition-colors"
                  style={{ borderColor: "var(--l-card-border)" }}
                >
                  <span
                    className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-2"
                  >
                    {post.category}
                  </span>
                  <h3
                    className="font-semibold mb-2 group-hover:text-primary transition-colors"
                    style={{ color: "var(--l-text)" }}
                  >
                    {post.title}
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: "var(--l-text-secondary)" }}
                  >
                    {post.description.slice(0, 110)}…
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div
          className="mt-12 pt-6 text-sm text-center"
          style={{
            borderTop: "1px solid var(--l-divider)",
            color: "var(--l-text-muted)",
          }}
        >
          <Link href="/blog" className="hover:text-primary transition-colors">
            ← Volver al blog
          </Link>
        </div>
      </main>
    </ThemedPage>
  );
}
