'use client'

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }
  reset = () => this.setState({ hasError: false, error: null })
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-4 text-sm">
          <div className="font-semibold text-red-500 mb-1">Something went wrong displaying this section.</div>
          <div className="text-xs text-muted-foreground break-all">
            {String(this.state.error?.message || this.state.error || 'Unknown error')}
          </div>
          <button
            onClick={this.reset}
            className="mt-2 text-xs underline text-primary hover:opacity-80"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
