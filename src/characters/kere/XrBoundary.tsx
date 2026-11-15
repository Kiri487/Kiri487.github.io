import { Component, type ReactNode } from "react";
import { removeCover } from "./xrer/transition";

interface XrBoundaryProps {
  children: ReactNode;
  /** XR couldn't be shown: back to Kere. */
  onFail: () => void;
}

/**
 * Around XR's review, whose code loads only when it's called up. If that fails (offline, or a deploy swapped the files
 * out), the page has already been scanned black and nobody is coming to take the cover off: do it here, put the
 * colours back, and return the visitor to Kere instead of leaving a dark, empty page.
 */
class XrBoundary extends Component<XrBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    removeCover();
    document.documentElement.removeAttribute("data-xr");
    this.props.onFail();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default XrBoundary;
