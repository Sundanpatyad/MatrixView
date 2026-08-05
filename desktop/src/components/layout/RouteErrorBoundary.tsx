import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Keeps the shell/sidebar usable if a page throws while rendering. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DockX] route render failed', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.children !== this.props.children && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-semibold text-ink-50">This page hit an error</p>
        <p className="max-w-sm text-xs text-ink-400">
          Use the sidebar to open Dashboard or Chat. You can keep using DockX.
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </Button>
      </div>
    );
  }
}
