import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Moving to another page moves the focus to its heading, so a screen reader says where you are and the next
 * Tab goes into the new page rather than on along the menu. Not on the first page: nothing has moved yet.
 */
function FocusOnNavigate() {
  const { pathname } = useLocation();
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    const heading = document.querySelector<HTMLElement>(".routes-container h1");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}

export default FocusOnNavigate;
