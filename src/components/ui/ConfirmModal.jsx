import { useEffect, useRef } from "react";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function ConfirmModal({ title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", onConfirm, onCancel }) {
  const confirmRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    // Acessibilidade: foca o botão de confirmar ao abrir e devolve o foco
    // para onde estava ao fechar — sem isso, quem navega por teclado perde
    // a posição toda vez que um modal aparece e some.
    const previouslyFocused = document.activeElement;
    confirmRef.current?.focus();

    function onKey(e) {
      if (e.key === "Escape") { onCancel(); return; }
      if (e.key !== "Tab" || !boxRef.current) return;
      const focusable = boxRef.current.querySelectorAll(FOCUSABLE);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Prende o Tab dentro do modal — sem isso, Tab escapa para o resto
      // da página por trás do overlay.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div ref={boxRef} className="modal-box" role="dialog" aria-modal="true" aria-label={title} aria-describedby="confirm-modal-message">
        <h3>{title}</h3>
        <p id="confirm-modal-message">{message}</p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} className="btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
