'use client'

import { HeroUIProvider } from '@heroui/react'
import { ToastProvider } from '@/contexts/ToastContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <ToastProvider>{children}</ToastProvider>
    </HeroUIProvider>
  )
}

