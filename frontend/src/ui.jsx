import { useEffect, useRef, useState } from "react";
import { STATUSES, TYPES, statusOf, typeLabel } from "./format.js";
import { IconAlertTriangle, IconCheck, IconTrash } from "./icons.jsx";

// Open modals, newest last. Escape only closes the top one, so a delete
// confirmation on top of the detail view closes on its own.
const openModals = [];

export function Modal({ onClose, className = "", labelledBy, children }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const token = {};
    openModals.push(token);
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    (dialog.querySelector("[data-autofocus]") ?? dialog).focus();

    const onKey = (e) => {
      if (e.key === "Escape" && openModals.at(-1) === token) {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openModals.splice(openModals.indexOf(token), 1);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

export function Field({ label, htmlFor, required, hint, action, error, children }) {
  return (
    <div className="field">
      <div className="field__label">
        <label htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="field__req" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {hint && <span className="field__hint">{hint}</span>}
        {action}
      </div>
      {children}
      {error && (
        <p className="field-error" id={`${htmlFor}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function TypeBadge({ type }) {
  return <span className={`badge badge--${type}`}>{typeLabel(type)}</span>;
}

export function StatusPill({ status }) {
  return (
    <span className={`pill pill--${status}`}>
      {status === "COMPLETED" && <IconCheck size={12} strokeWidth="3" />}
      {statusOf(status).label}
    </span>
  );
}

export function TypeSelect({ id, value, onChange }) {
  return (
    <div className="select-wrap">
      <span className={`dot dot--${value}`} />
      <select id={id} className="select" value={value} onChange={onChange}>
        {TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function StatusSelect({ id, value, onChange }) {
  return (
    <div className="select-wrap">
      <span className={`dot dot--${value}`} />
      <select id={id} className="select" value={value} onChange={onChange}>
        {STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.column}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ConfirmDialog({ title, subtitle, children, confirmLabel, tone = "danger", icon, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      setBusy(false);
    }
  }

  const danger = tone === "danger";
  return (
    <Modal onClose={onClose} className="dialog--confirm" labelledBy="confirm-title">
      <div className="confirm">
        <div className={`confirm__icon${danger ? "" : " confirm__icon--neutral"}`}>
          {icon ?? <IconAlertTriangle size={20} />}
        </div>
        <div className="confirm__heading">
          <h2 id="confirm-title">{title}</h2>
          {subtitle && <p className="confirm__sub">{subtitle}</p>}
        </div>
      </div>
      <p className="confirm__text">{children}</p>
      <div className="confirm__actions">
        <button type="button" className="btn btn--subtle" onClick={onClose} data-autofocus>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${danger ? "btn--danger" : "btn--primary"}`}
          onClick={confirm}
          disabled={busy}
        >
          {danger && <IconTrash size={16} />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
