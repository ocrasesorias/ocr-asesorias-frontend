'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-6 max-w-md">
            <h2 className="text-lg font-semibold text-danger-700 mb-2">
              Ha ocurrido un error inesperado
            </h2>
            <p className="text-sm text-danger-600 mb-4">
              {this.state.error?.message || 'Error desconocido'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors text-sm"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
