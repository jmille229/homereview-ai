'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

/**
 * Catches JavaScript errors in child components and renders a fallback UI
 * instead of crashing the entire app.
 *
 * Must be a class component — React does not support error boundaries as
 * function components.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.'
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    // In production, send to your error tracking service (e.g., Sentry)
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
          <div className="max-w-sm w-full bg-white border border-brand-border rounded-xl p-7 text-center">
            <p className="text-lg font-semibold text-brand-navy mb-2">
              Something went wrong
            </p>
            <p className="text-sm text-brand-muted mb-6 leading-relaxed">
              {this.state.message}
            </p>
            <button
              onClick={this.handleReset}
              className="btn-primary"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
