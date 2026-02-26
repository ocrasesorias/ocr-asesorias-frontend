'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function RegistroPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-white to-background py-12 px-4 sm:px-6 lg:px-8 relative">
      <button
        onClick={() => router.back()}
        aria-label="Volver a la página anterior"
        className="fixed top-6 left-6 z-50 flex items-center text-foreground-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg p-1"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
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
      <div className="max-w-md w-full text-center">
        <Link href="/" className="inline-block mb-6">
          <Image
            src="/img/logo.png"
            alt="KontaScan"
            width={80}
            height={80}
            className="mx-auto h-16 w-auto"
            priority
          />
        </Link>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Registros temporalmente cerrados
        </h2>
        <p className="text-foreground-secondary mb-8">
          De momento no aceptamos nuevos registros desde la web. Si estás interesado en
          KontaScan, contáctanos para una propuesta personalizada.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/#contacto"
            className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors"
          >
            Contactar
          </Link>
          <Link
            href="/login"
            className="border-2 border-primary text-primary px-6 py-3 rounded-lg font-semibold hover:bg-primary hover:text-white transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
