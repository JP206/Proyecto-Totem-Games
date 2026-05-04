import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

/** Help text in a fixed portal so it is not clipped by table overflow. */
export default function FloatingHelpIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const updatePos = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.top, left: r.left + r.width / 2 });
  }, []);
  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open, updatePos]);
  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className="translation-help-trigger"
        aria-label="Ayuda"
        onMouseEnter={() => {
          updatePos();
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          updatePos();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
      >
        <CircleHelp size={13} />
      </button>
      {open &&
        createPortal(
          <div
            className="translation-help-floating"
            style={{
              position: "fixed",
              top: pos.top - 8,
              left: pos.left,
              transform: "translate(-50%, -100%)",
              zIndex: 10050,
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
