"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * CertificateSheet — makes the fixed A4-landscape certificate fit the screen.
 *
 * The sheet itself is designed in millimetres (297×210mm) so the paper output
 * is exact. On screens narrower than the sheet (i.e. any phone), it is scaled
 * down to fit the container width using a CSS transform (origin top-centre,
 * so the scaled sheet stays centred), while the wrapper reserves the scaled
 * height so the content below the sheet does not jump. On print the scale is
 * removed (see `@media print` in globals.css) and the sheet prints at full
 * A4 landscape, exactly as before.
 */
export default function CertificateSheet({
  children,
}: {
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const wrap = wrapRef.current;
      const sheet = sheetRef.current;
      if (!wrap || !sheet) return;
      // Measure the sheet's real rendered width (the browser's mm→px
      // conversion), then shrink it only when the container is narrower.
      setScale(Math.min(1, wrap.clientWidth / sheet.offsetWidth));
    };
    update();
    window.addEventListener("resize", update);
    // Re-measure once layout settles (fonts can shift sizes slightly).
    const id = window.setTimeout(update, 200);
    return () => {
      window.removeEventListener("resize", update);
      window.clearTimeout(id);
    };
  }, []);

  const s = scale ?? 1;

  return (
    <div ref={wrapRef} className="w-full">
      <div
        className="certificate-scale-height"
        style={{ height: scale !== null ? `calc(${s} * 210mm)` : undefined }}
      >
        <div
          ref={sheetRef}
          className="certificate-sheet certificate-scale-target shadow-xl"
          style={{
            // translateX(-50%) centres the (overflowing) sheet, then scale
            // shrinks it around its own centre so it stays centred.
            transform: `translateX(-50%) scale(${s})`,
            transformOrigin: "top center",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
