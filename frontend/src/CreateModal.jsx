import { useState } from "react";
import { Field, Modal, StatusSelect, TypeSelect } from "./ui.jsx";
import { IconAlertCircle, IconLink, IconX } from "./icons.jsx";

export default function CreateModal({ initialStatus, onCreate, onClose }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    contentType: "TASK",
    status: initialStatus,
    dueDate: "",
    url: "",
  });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const titleError = touched && !form.title.trim() ? "Title is required" : null;

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate({
        title: form.title.trim(),
        description: form.description.trim() || null,
        contentType: form.contentType,
        status: form.status,
        dueDate: form.dueDate || null,
        url: form.url.trim() || null,
      });
    } catch {
      setSaving(false); // the board already showed the error toast
    }
  }

  return (
    <Modal onClose={onClose} className="dialog--create" labelledBy="create-heading">
      <form
        className="dialog__form"
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        noValidate
      >
        <header className="dialog__header">
          <h2 id="create-heading" className="dialog__title">
            Create content
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </header>

        <div className="dialog__body">
          <Field label="Title" htmlFor="create-title" required error={titleError}>
            <div className={`input-wrap${titleError ? " input-wrap--trail" : ""}`}>
              <input
                id="create-title"
                className={`input${titleError ? " input--invalid" : ""}`}
                value={form.title}
                onChange={set("title")}
                maxLength={255}
                placeholder="What are you creating?"
                data-autofocus
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? "create-title-error" : undefined}
              />
              {titleError && <IconAlertCircle className="input-wrap__trail" size={16} />}
            </div>
          </Field>

          <Field label="Description" htmlFor="create-description">
            <textarea
              id="create-description"
              className="textarea"
              rows={4}
              value={form.description}
              onChange={set("description")}
              placeholder="Add details, outline, or talking points…"
            />
          </Field>

          <div className="grid-2">
            <Field label="Type" htmlFor="create-type">
              <TypeSelect id="create-type" value={form.contentType} onChange={set("contentType")} />
            </Field>
            <Field label="Status" htmlFor="create-status">
              <StatusSelect id="create-status" value={form.status} onChange={set("status")} />
            </Field>
          </div>

          <div className="grid-2">
            <Field label="Due date" htmlFor="create-due" hint="Optional">
              <input id="create-due" type="date" className="input" value={form.dueDate} onChange={set("dueDate")} />
            </Field>
            <Field label="URL" htmlFor="create-url" hint="Optional">
              <div className="input-wrap input-wrap--lead">
                <IconLink className="input-wrap__lead" size={16} />
                <input
                  id="create-url"
                  type="url"
                  className="input"
                  value={form.url}
                  onChange={set("url")}
                  maxLength={500}
                  placeholder="https://"
                />
              </div>
            </Field>
          </div>
        </div>

        <footer className="dialog__footer">
          <button type="button" className="btn btn--subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
