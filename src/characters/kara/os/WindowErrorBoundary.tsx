import { Component, type ReactNode } from "react";
import { ErrorIcon } from "../icons";

interface WindowErrorBoundaryProps {
  children: ReactNode;
}

interface WindowErrorBoundaryState {
  crashed: boolean;
}

/** Keeps one broken app inside its own window, including an app whose code failed to download. */
class WindowErrorBoundary extends Component<WindowErrorBoundaryProps, WindowErrorBoundaryState> {
  state: WindowErrorBoundaryState = { crashed: false };

  static getDerivedStateFromError(): WindowErrorBoundaryState {
    return { crashed: true };
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <div className="kara-window__crash" role="alert">
        <ErrorIcon size={32} />
        <div>
          <p>This program has performed an illegal operation.</p>
          <p>Close this window to continue.</p>
        </div>
      </div>
    );
  }
}

export default WindowErrorBoundary;
