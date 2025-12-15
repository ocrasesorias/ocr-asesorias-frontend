import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // En desarrollo, deshabilitar caché de imágenes para evitar problemas al cambiar imágenes
    unoptimized: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;
