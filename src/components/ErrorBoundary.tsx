import { Component, type ReactNode } from "react";
import { Button } from "./ui/Button";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-16 max-w-md rounded-3xl border border-ink-700 bg-ink-850 p-6 text-center">
        <h1 className="font-display text-lg font-semibold">This screen hit a problem</h1>
        <p className="mt-2 text-sm text-mist-400">Your data is safe. Reload the screen to try again.</p>
        <p className="mt-3 break-words font-mono text-xs text-mist-500">{this.state.error.message}</p>
        <Button className="mt-5" onClick={() => this.setState({ error: null })}>
          Reload screen
        </Button>
      </div>
    );
  }
}
