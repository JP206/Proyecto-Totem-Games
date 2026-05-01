import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

interface LandingFloatingHelpProps {
  text: string;
}

const LandingFloatingHelp: React.FC<LandingFloatingHelpProps> = ({ text }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({
    top: 0,
    left: 0,
    placement: "above" as "above" | "below",
  });
  const btnRef = useRef<HTMLButtonElement>(null);

  const updatePos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 16);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceAbove > 96 || spaceAbove >= spaceBelow) {
      setPos({ top: rect.top - 8, left, placement: "above" });
    } else {
      setPos({ top: rect.bottom + 8, left, placement: "below" });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className="landing-help-trigger"
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
        <CircleHelp size={14} />
      </button>
      {open &&
        createPortal(
          <div
            className="landing-help-floating"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: Math.min(300, window.innerWidth - 16),
              zIndex: 10050,
              transform: pos.placement === "above" ? "translateY(-100%)" : "none",
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
};

export default LandingFloatingHelp;
