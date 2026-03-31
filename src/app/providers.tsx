'use client'

import { HeroUIProvider } from '@heroui/react'
import { ToastProvider } from '@/contexts/ToastContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <HeroUIProvider>
        <ToastProvider>{children}</ToastProvider>
      </HeroUIProvider>
    </ThemeProvider>
  )
}
