import { Component, type ReactNode } from "react";
import { useSkin } from "../../SkinContext";

interface KuruErrorBoundaryProps {
  children: ReactNode;
}

interface KuruErrorBoundaryState {
  error: Error | null;
}

/**
 * Keeps a broken street inside Kuru. Without it, an error here (most often a browser with WebGL turned off)
 * unmounts the whole site and leaves a blank page with no way back.
 */
class KuruErrorBoundary extends Component<KuruErrorBoundaryProps, KuruErrorBoundaryState> {
  state: KuruErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): KuruErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <KuruCrash noWebGL={this.state.error.message.includes("WebGL")} />;
  }
}

function KuruCrash({ noWebGL }: { noWebGL: boolean }) {
  const { setSkin } = useSkin();

  return (
    <div className="kuru kuru-loading" role="alert">
      <title>Kuru's Hideout</title>
      <div className="kuru-loading__box">
        <div className="kuru-loading__content">
          <div className="kuru-loading__line">
            {noWebGL ? "> CHECK gpu" : "> LOAD street"}
            <span className="kuru-loading__status"> ··· FAIL</span>
          </div>
          <p className="kuru-loading__line kuru-crash__message">
            {noWebGL
              ? "This browser can't do 3D. Catch you somewhere else"
              : "Something broke on the street. Not your fault"}
          </p>
          <button
            type="button"
            className="kuru-loading__line kuru-crash__exit"
            onClick={() => setSkin("kiri")}
            autoFocus
          >
            <span aria-hidden="true">▸ </span>Back to Kiri
          </button>
        </div>
      </div>
    </div>
  );
}

export default KuruErrorBoundary;
