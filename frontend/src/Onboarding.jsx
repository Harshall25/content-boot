import { useState } from "react";
import { api } from "./api.js";
import { formatKey } from "./format.js";
import { IconAlertTriangle, IconBoard, IconCheck, IconCopy, IconKey } from "./icons.jsx";

export default function Onboarding({ notice, onOpen }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(notice);
  const [busy, setBusy] = useState(null); // "open" | "create" | null
  const [createdKey, setCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  async function openBoard(e) {
    e.preventDefault();
    const key = formatKey(value);
    if (key.length !== 19) {
      setError("An access key has 16 characters, in the form XXXX-XXXX-XXXX-XXXX.");
      return;
    }
    setBusy("open");
    setError(null);
    try {
      await api.verify(key);
      onOpen(key);
    } catch (err) {
      setError(err.status === 401 ? "No board found for this key. Check it and try again." : err.message);
      setBusy(null);
    }
  }

  async function createKey() {
    setBusy("create");
    setError(null);
    try {
      const user = await api.createUser();
      setCreatedKey(user.accessKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const brand = (
    <div className="onboard__brand">
      <IconBoard size={20} />
      WorkMesh
    </div>
  );

  if (createdKey) {
    return (
      <main className="onboard">
        <section className="onboard__card" aria-labelledby="created-title">
          {brand}
          <div>
            <h1 id="created-title">Your access key</h1>
            <p className="onboard__lead">This key opens your board. It stays in the top-right corner while you work.</p>
          </div>
          <div className="keybox">
            <code>{createdKey}</code>
            <button type="button" className="btn btn--secondary" onClick={copyKey}>
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="callout" role="note">
            <IconAlertTriangle size={18} />
            <p>
              Save it somewhere safe. There is no password and no recovery: if you lose this key, you lose access to
              this board.
            </p>
          </div>
          <button type="button" className="btn btn--primary btn--block" onClick={() => onOpen(createdKey)}>
            I've saved it, open my board
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="onboard">
      <section className="onboard__card" aria-labelledby="onboard-title">
        {brand}
        <div>
          <h1 id="onboard-title">Open your board</h1>
          <p className="onboard__lead">Enter your access key, or create a new one to start an empty board.</p>
        </div>

        <form className="onboard__form" onSubmit={openBoard} noValidate>
          <div className="field">
            <div className="field__label">
              <label htmlFor="access-key">Access key</label>
            </div>
            <div className="input-wrap input-wrap--lead">
              <IconKey className="input-wrap__lead" size={16} />
              <input
                id="access-key"
                className={`input input--lg input--mono${error ? " input--invalid" : ""}`}
                value={value}
                onChange={(e) => setValue(formatKey(e.target.value))}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                spellCheck="false"
                autoFocus
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "access-key-error" : undefined}
              />
            </div>
            {error && (
              <p className="field-error" id="access-key-error">
                {error}
              </p>
            )}
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={busy !== null}>
            {busy === "open" ? "Opening…" : "Open board"}
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        <button type="button" className="btn btn--secondary btn--block" onClick={createKey} disabled={busy !== null}>
          {busy === "create" ? "Creating…" : "Create a new access key"}
        </button>
      </section>
    </main>
  );
}
