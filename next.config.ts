import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // En desarrollo, deshabilitar caché de imágenes para evitar problemas al cambiar imágenes
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
};

export default nextConfig;
