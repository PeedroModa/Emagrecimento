import { useState, useEffect, useCallback, useRef } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((text, kind = "ok") => {
    clearTimeout(timer.current);
    setToast({ text, kind });
    timer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, show };
}

export function Toast({ toast }) {
  if (!toast) return null;
  const color = toast.kind === "error" ? "var(--accent)" : toast.kind === "warn" ? "var(--warn)" : "var(--good)";
  return (
    <div className="toast" role="status" aria-live="polite" style={{ borderColor: color }}>
      {toast.text}
    </div>
  );
}
