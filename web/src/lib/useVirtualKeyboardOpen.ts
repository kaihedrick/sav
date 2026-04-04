import { useLayoutEffect, useState } from "react";

/**
 * True when the visual viewport is much shorter than the layout viewport — typical
 * when the iOS/Android software keyboard (and input accessory) is open. Safari
 * updates `visualViewport` on keyboard show/hide; `window.innerHeight` is often
 * stable (layout viewport).
 *
 * Used to avoid `backdrop-filter` while the keyboard is up; WebKit often
 * mis-composites backdrop + shadows after viewport resizes (see Safari issues
 * with backdrop-filter + box-shadow).
 */
export function useVirtualKeyboardOpen(active: boolean): boolean {
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!active) {
      setOpen(false);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) {
      setOpen(false);
      return;
    }
    const sync = () => {
      const gap = window.innerHeight - vv.height;
      // URL bar show/hide is usually < ~80px; keyboard + accessory is typically larger
      setOpen(gap > 90);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [active]);

  return open;
}
