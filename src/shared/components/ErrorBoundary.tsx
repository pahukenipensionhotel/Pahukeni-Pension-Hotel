import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: unknown }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let displayError = this.state.error as any;
      let isFirestoreError = false;

      try {
        const parsed = JSON.parse(displayError.message);
        if (parsed.operationType) {
          displayError = parsed;
          isFirestoreError = true;
        }
      } catch {}

      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-red-100">
            <h2 className="text-2xl font-serif text-red-600 mb-4">
              System Error
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              {isFirestoreError
                ? `A database error occurred during ${displayError.operationType} on ${displayError.path}.`
                : "An unexpected error occurred. Please try refreshing the page."}
            </p>
            <pre className="bg-gray-50 p-4 rounded-xl text-[10px] font-mono overflow-auto mb-6 max-h-40">
              {JSON.stringify(displayError, null, 2)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-medium"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
