import { Component, type ReactNode } from "react";

interface XnenBoundaryProps {
  children: ReactNode;
  /** The backrooms couldn't load or crashed: back to the desktop. */
  onFail: () => void;
}

/**
 * Around XN's backrooms, whose code loads only when the door opens. If that fails (offline, or a deploy swapped the
 * files out) or the place itself crashes, the visitor lands back on Kara's desktop instead of a blank screen.
 */
class XnenBoundary extends Component<XnenBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.props.onFail();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default XnenBoundary;
