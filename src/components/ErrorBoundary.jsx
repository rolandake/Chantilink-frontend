// src/component/ErrorBoundary.jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Interface de secours
      return (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-600 dark:text-red-400 text-sm">
            ⚠️ Une erreur s'est produite lors du chargement de ce contenu.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
