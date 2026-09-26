import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Field, Modal, StatusSelect, TypeBadge, TypeSelect } from "./ui.jsx";
import { formatDateTime, isMac, itemKey, safeHref } from "./format.js";
import {
  IconCheck,
  IconDoc,
  IconExternal,
  IconKeyboard,
  IconLink,
  IconMore,
  IconPencil,
  IconTrash,
  IconX,
} from "./icons.jsx";

export default function DetailModal({ item, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(() => ({
    title: item.title,
    description: item.description ?? "",
    status: item.status ?? "TODO",
    contentType: item.contentType ?? "TASK",
    dueDate: item.dueDate ?? "",
    url: item.url ?? "",
  }));
  const [editingUrl, setEditingUrl] = useState(!item.url);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef(null);
  const menuRef = useRef(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const titleMissing = !form.title.trim();
  const href = safeHref(form.url);
  const created = formatDateTime(item.dateCreated);
  const updated = formatDateTime(item.dateUpdated);

  // The title is a textarea so long titles wrap; grow it to fit its text.
  useLayoutEffect(() => {
    const el = titleRef.current;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [form.title]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  async function save(e) {
    e?.preventDefault();
    setTouched(true);
    if (titleMissing || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...item,
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        contentType: form.contentType,
        dueDate: form.dueDate || null,
        url: form.url.trim() || null,
      });
    } catch {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} className="dialog--detail" labelledBy="detail-title">
      <form
        className="dialog__form"
        onSubmit={save}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(e);
        }}
        noValidate
      >
        <header className="dialog__header">
          <p className="crumb">
            <IconDoc size={16} />
            WorkMesh
            <span className="crumb__muted">/</span>
            <span className="crumb__muted">{itemKey(item.id)}</span>
          </p>
          <div className="dialog__tools">
            <div className="menu-anchor" ref={menuRef}>
              <button
                type="button"
                className="icon-btn"
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <IconMore size={18} />
              </button>
              {menuOpen && (
                <div className="menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="menu__item menu__item--danger"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(item);
                    }}
                  >
                    <IconTrash size={16} />
                    Delete
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <IconX size={18} />
            </button>
          </div>
        </header>

        <div className="detail">
          <div className="detail__main">
            <div>
              <textarea
                ref={titleRef}
                id="detail-title"
                className={`title-edit${touched && titleMissing ? " title-edit--invalid" : ""}`}
                rows={1}
                value={form.title}
                onChange={set("title")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) e.preventDefault();
                }}
                maxLength={255}
                aria-label="Title"
                data-autofocus
              />
              {touched && titleMissing && <p className="field-error">Title is required</p>}
            </div>

            <div className="field">
              <div className="field__label">
                <label htmlFor="detail-description">Description</label>
              </div>
              <textarea
                id="detail-description"
                className="textarea textarea--desc"
                value={form.description}
                onChange={set("description")}
                placeholder="Add details, outline, or talking points…"
              />
            </div>
          </div>

          <aside className="detail__side">
            <h3 className="section-label">Details</h3>

            <Field label="Status" htmlFor="detail-status">
              <StatusSelect id="detail-status" value={form.status} onChange={set("status")} />
            </Field>

            <Field label="Type" htmlFor="detail-type">
              <TypeSelect id="detail-type" value={form.contentType} onChange={set("contentType")} />
              <div>
                <TypeBadge type={form.contentType} />
              </div>
            </Field>

            <Field label="Due date" htmlFor="detail-due">
              <input id="detail-due" type="date" className="input" value={form.dueDate} onChange={set("dueDate")} />
            </Field>

            <Field
              label="URL"
              htmlFor="detail-url"
              action={
                !editingUrl && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => setEditingUrl(true)}
                    aria-label="Edit URL"
                    title="Edit URL"
                  >
                    <IconPencil size={14} />
                  </button>
                )
              }
            >
              {editingUrl ? (
                <div className="input-wrap input-wrap--lead">
                  <IconLink className="input-wrap__lead" size={16} />
                  <input
                    id="detail-url"
                    type="url"
                    className="input"
                    value={form.url}
                    onChange={set("url")}
                    maxLength={500}
                    placeholder="https://"
                  />
                </div>
              ) : (
                <div className="url-view">
                  <IconLink size={14} />
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" title={form.url}>
                      {form.url}
                    </a>
                  ) : (
                    <span className="url-view__text">{form.url}</span>
                  )}
                  {href && <IconExternal size={14} />}
                </div>
              )}
            </Field>

            <dl className="meta">
              <div>
                <dt>Created</dt>
                <dd>{created ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{updated ?? "Not yet"}</dd>
              </div>
            </dl>
          </aside>
        </div>

        <footer className="dialog__footer dialog__footer--tinted">
          <span className="hint">
            <IconKeyboard size={16} />
            Press <kbd>{isMac ? "⌘" : "Ctrl"}</kbd> + <kbd>Enter</kbd> to save
          </span>
          <div className="dialog__actions">
            <button type="button" className="btn btn--subtle" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              <IconCheck size={16} />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
