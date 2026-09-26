import { useCallback, useMemo, useState } from "react";
import { IconAlertCircle, IconCheck, IconX } from "./icons.jsx";

const SUCCESS_MS = 4500;
let nextId = 0;

// Success toasts dismiss themselves; errors stay until closed or retried.
export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (toast) => {
      const id = ++nextId;
      setToasts((list) => [...list.slice(-2), { ...toast, id }]);
      if (toast.kind === "success") setTimeout(() => dismiss(id), SUCCESS_MS);
    },
    [dismiss]
  );

  const actions = useMemo(
    () => ({
      success: (title, text, action) => push({ kind: "success", title, text, action }),
      error: (title, retry) => push({ kind: "error", title, action: retry && { label: "Retry", run: retry } }),
      dismiss,
    }),
    [push, dismiss]
  );

  return [toasts, actions];
}

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <span className="toast__icon">
            {t.kind === "success" ? <IconCheck size={14} strokeWidth="3" /> : <IconAlertCircle size={18} />}
          </span>
          <div className="toast__body">
            <p className="toast__title">
              {t.title}
              {t.action && (
                <button
                  type="button"
                  className="link-btn toast__action"
                  onClick={() => {
                    onDismiss(t.id);
                    t.action.run();
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </p>
            {t.text && <p className="toast__text">{t.text}</p>}
          </div>
          <button type="button" className="icon-btn icon-btn--sm" aria-label="Dismiss" onClick={() => onDismiss(t.id)}>
            <IconX size={14} />
          </button>
          {t.kind === "success" && <span className="toast__timer" />}
        </div>
      ))}
    </div>
  );
}
