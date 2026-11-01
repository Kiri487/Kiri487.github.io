import { useEffect, useMemo, useReducer, type ReactNode } from "react";
import { APPS } from "../apps/registry";
import { OsActionsContext, OsStateContext, type OsActions } from "./context";
import { INITIAL_OS_STATE, osReducer, readViewport } from "./windowManager";

function OsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(osReducer, INITIAL_OS_STATE);

  const actions = useMemo<OsActions>(
    () => ({
      openApp: (appId, options) => {
        const { title, windowTitle, size } = APPS[appId];
        dispatch({
          type: "open",
          appId,
          title: options?.title ?? windowTitle ?? title,
          args: options?.args,
          size,
          viewport: readViewport(),
        });
      },
      closeWindow: (id) => dispatch({ type: "close", id }),
      focusWindow: (id) => dispatch({ type: "focus", id }),
      blurWindows: () => dispatch({ type: "blur" }),
      minimizeWindow: (id) => dispatch({ type: "minimize", id }),
      toggleMaximizeWindow: (id) => dispatch({ type: "toggleMaximize", id }),
      moveWindow: (id, x, y) => dispatch({ type: "move", id, x, y, viewport: readViewport() }),
      setWindowTitle: (id, title) => dispatch({ type: "setTitle", id, title }),
      reset: () => dispatch({ type: "reset" }),
    }),
    [],
  );

  // Pull windows back when the browser shrinks, so no title bar ends up out of reach.
  useEffect(() => {
    const fit = () => dispatch({ type: "fitViewport", viewport: readViewport() });
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <OsActionsContext.Provider value={actions}>
      <OsStateContext.Provider value={state}>{children}</OsStateContext.Provider>
    </OsActionsContext.Provider>
  );
}

export default OsProvider;
