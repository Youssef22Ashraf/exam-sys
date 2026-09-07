import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches a render error instead of blanking the page.
 *
 * There was no boundary anywhere, so any throw during render left the
 * candidate staring at a white screen mid-exam with no way to recover and no
 * indication that anything had happened.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="page-container" role="alert">
        <div style={{ maxWidth: 520, margin: "80px auto", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.3rem" }}>Something went wrong</h1>
          <p style={{ lineHeight: 1.6 }}>
            The page could not be displayed. If you were part-way through an
            assessment, your answers are still saved on this device — reload
            and you will be returned to where you left off.
          </p>
          <button
            type="button"
            className="primary-button"
            style={{ marginTop: 16 }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}
