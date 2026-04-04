import { useLayoutEffect, useState } from "react";

export type VisualViewportRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * While `active`, tracks `window.visualViewport` so fixed overlays match the
 * visible region on iOS Safari (collapsing URL bar, bottom UI, virtual keyboard).
 */
export function useVisualViewportRect(active: boolean): VisualViewportRect | null {
  const [rect, setRect] = useState<VisualViewportRect | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) {
      setRect(null);
      return;
    }
    const sync = () => {
      setRect({
        top: vv.offsetTop,
        left: vv.offsetLeft,
        width: vv.width,
        height: vv.height,
      });
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [active]);

  return rect;
}
