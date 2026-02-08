'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Error logging could be added here in the future
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-table-950 text-white px-4">
          <div className="text-4xl mb-4">&#9824;</div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-white/60 text-center mb-6 max-w-md">
            An unexpected error occurred. Please reload the page to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-lg transition-colors"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
