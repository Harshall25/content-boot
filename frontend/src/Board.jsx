import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { STATUSES, TYPES, formatDue, isOverdue, itemKey, nowLocalIso, statusOf } from "./format.js";
import { ConfirmDialog, StatusPill, TypeBadge } from "./ui.jsx";
import { Toasts, useToasts } from "./Toasts.jsx";
import CreateModal from "./CreateModal.jsx";
import DetailModal from "./DetailModal.jsx";
import {
  IconAlertCircle,
  IconBoard,
  IconCopy,
  IconKey,
  IconLink,
  IconLogout,
  IconPlus,
  IconSearch,
} from "./icons.jsx";

export default function Board({ accessKey, onSignOut, onUnauthorized }) {
  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [createStatus, setCreateStatus] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overLane, setOverLane] = useState(null);
  const [toasts, toast] = useToasts();

  // A 401 means the key was removed on the server: go back to the start screen.
  const fail = useCallback(
    (err, retry) => {
      if (err.status === 401) onUnauthorized();
      else toast.error(err.message, retry);
    },
    [onUnauthorized, toast]
  );

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      setItems(await api.list());
      setPhase("ready");
    } catch (err) {
      setPhase("error");
      fail(err, load);
    }
  }, [fail]);

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtering = q !== "" || typeFilter !== "";

  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (!typeFilter || i.contentType === typeFilter) &&
          (!q || i.title.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q))
      ),
    [items, q, typeFilter]
  );

  const lanes = useMemo(
    () => STATUSES.map((s) => ({ ...s, items: visible.filter((i) => (i.status ?? "TODO") === s.id) })),
    [visible]
  );

  const openItem = items.find((i) => i.id === openId) ?? null;

  const replaceItem = (id, patch) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // Optimistic: the card moves immediately and moves back if the save fails.
  async function moveItem(id, status) {
    const item = items.find((i) => i.id === id);
    if (!item || (item.status ?? "TODO") === status) return;
    replaceItem(id, { status });
    try {
      await api.update(id, { ...item, status });
      replaceItem(id, { dateUpdated: nowLocalIso() });
    } catch (err) {
      replaceItem(id, { status: item.status });
      fail(err, () => moveItem(id, status));
    }
  }

  async function createItem(draft) {
    try {
      const created = await api.create(draft);
      setItems((list) => [...list, created]);
      setCreateStatus(null);
      toast.success(
        "Content created",
        `${itemKey(created.id)} was added to the ${statusOf(created.status).column} lane`,
        { label: "View item", run: () => setOpenId(created.id) }
      );
    } catch (err) {
      fail(err);
      throw err;
    }
  }

  async function saveItem(updated) {
    try {
      await api.update(updated.id, updated);
      replaceItem(updated.id, { ...updated, dateUpdated: nowLocalIso() });
      setOpenId(null);
      toast.success("Changes saved", itemKey(updated.id));
    } catch (err) {
      fail(err);
      throw err;
    }
  }

  async function deleteItem(item) {
    try {
      await api.remove(item.id);
    } catch (err) {
      // 404: it was already gone, so the end result is the same.
      if (err.status !== 404) {
        fail(err);
        throw err;
      }
    }
    setItems((list) => list.filter((i) => i.id !== item.id));
    setPendingDelete(null);
    setOpenId(null);
    toast.success(`${itemKey(item.id)} deleted`);
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(accessKey);
      toast.success("Access key copied");
    } catch {
      toast.error("Couldn't copy. Select the key and copy it manually.");
    }
  }

  // Native HTML5 drag and drop: no library needed for moving cards between lanes.
  const onDragStart = (e, id) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
    setDragId(id);
  };
  const onDragEnd = () => {
    setDragId(null);
    setOverLane(null);
  };
  const onLaneDragOver = (e, laneId) => {
    if (dragId == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overLane !== laneId) setOverLane(laneId);
  };
  const onLaneDragLeave = (e, laneId) => {
    if (!e.currentTarget.contains(e.relatedTarget) && overLane === laneId) setOverLane(null);
  };
  const onLaneDrop = (e, laneId) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain"));
    setOverLane(null);
    setDragId(null);
    if (id) moveItem(id, laneId);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <IconBoard size={20} />
          <span className="brand__name">WorkMesh</span>
        </div>

        <label className="search">
          <IconSearch />
          <input
            className="input"
            type="search"
            placeholder="Search content…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search content"
          />
        </label>

        <select
          className="select type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <div className="topbar__spacer" />

        <button type="button" className="btn btn--primary" onClick={() => setCreateStatus("TODO")} aria-label="Create">
          <IconPlus />
          <span className="btn__text">Create</span>
        </button>

        <div className="keychip" title="Your access key. You need it to open this board again.">
          <IconKey size={14} />
          <code aria-label="Access key">{accessKey}</code>
          <button type="button" className="icon-btn icon-btn--sm" onClick={copyKey} aria-label="Copy access key" title="Copy access key">
            <IconCopy size={14} />
          </button>
          <span className="keychip__sep" />
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={() => setConfirmSwitch(true)}
            aria-label="Switch access key"
            title="Switch access key"
          >
            <IconLogout size={14} />
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar__head">
            <p className="sidebar__title">Personal Workspace</p>
            <p className="sidebar__sub">
              {items.length} {items.length === 1 ? "item" : "items"}
            </p>
          </div>
          <nav aria-label="Views">
            <div className="nav-item" aria-current="page">
              <IconBoard />
              Board
              <span className="nav-item__count">{items.length}</span>
            </div>
          </nav>
        </aside>

        <main className="main">
          <div className="subhead">
            <nav className="crumbs" aria-label="Breadcrumb">
              <span>Personal Workspace</span>
              <span aria-hidden="true">/</span>
              <strong>Board</strong>
            </nav>
            {filtering && (
              <p className="filter-note">
                Showing {visible.length} of {items.length}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setQuery("");
                    setTypeFilter("");
                  }}
                >
                  Clear filters
                </button>
              </p>
            )}
          </div>

          {phase === "error" ? (
            <div className="board-error">
              <IconAlertCircle size={20} />
              <p>Couldn't load your board.</p>
              <button type="button" className="btn btn--secondary" onClick={load}>
                Retry
              </button>
            </div>
          ) : (
            <div className="lanes">
              {lanes.map((lane) =>
                phase === "loading" ? (
                  <SkeletonLane key={lane.id} lane={lane} />
                ) : (
                  <section
                    key={lane.id}
                    className={`lane${overLane === lane.id ? " lane--over" : ""}`}
                    aria-label={lane.column}
                    onDragOver={(e) => onLaneDragOver(e, lane.id)}
                    onDragLeave={(e) => onLaneDragLeave(e, lane.id)}
                    onDrop={(e) => onLaneDrop(e, lane.id)}
                  >
                    <header className="lane__head">
                      <h2 className="lane__title">
                        {lane.column}
                        <span className="count">{lane.items.length}</span>
                      </h2>
                      <button
                        type="button"
                        className="icon-btn icon-btn--sm lane__quick"
                        onClick={() => setCreateStatus(lane.id)}
                        aria-label={`Create item in ${lane.column}`}
                        title={`Create item in ${lane.column}`}
                      >
                        <IconPlus />
                      </button>
                    </header>

                    <div className="lane__cards">
                      {lane.items.map((item) => (
                        <Card
                          key={item.id}
                          item={item}
                          dragging={dragId === item.id}
                          onOpen={() => setOpenId(item.id)}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                        />
                      ))}
                      {(lane.items.length === 0 || lane.id === "COMPLETED") && (
                        <div className="lane__empty">
                          {filtering && lane.items.length === 0 ? "No matching items" : lane.empty}
                        </div>
                      )}
                    </div>

                    <button type="button" className="lane__add" onClick={() => setCreateStatus(lane.id)}>
                      <IconPlus />
                      Create item
                    </button>
                  </section>
                )
              )}
            </div>
          )}
        </main>
      </div>

      {createStatus && (
        <CreateModal initialStatus={createStatus} onCreate={createItem} onClose={() => setCreateStatus(null)} />
      )}

      {openItem && (
        <DetailModal
          key={openItem.id}
          item={openItem}
          onSave={saveItem}
          onDelete={setPendingDelete}
          onClose={() => setOpenId(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${itemKey(pendingDelete.id)}?`}
          subtitle={`Item identifier: ${itemKey(pendingDelete.id)} • ${statusOf(pendingDelete.status).column}`}
          confirmLabel="Delete"
          onConfirm={() => deleteItem(pendingDelete)}
          onClose={() => setPendingDelete(null)}
        >
          This content item will be permanently removed from your calendar. This action cannot be undone.
        </ConfirmDialog>
      )}

      {confirmSwitch && (
        <ConfirmDialog
          title="Switch access key?"
          subtitle={accessKey}
          confirmLabel="Switch key"
          tone="neutral"
          icon={<IconLogout size={20} />}
          onConfirm={onSignOut}
          onClose={() => setConfirmSwitch(false)}
        >
          You'll go back to the start screen. To open this board again you need this key, so copy it first if you
          haven't saved it.
        </ConfirmDialog>
      )}

      <Toasts toasts={toasts} onDismiss={toast.dismiss} />
    </div>
  );
}

function Card({ item, dragging, onOpen, onDragStart, onDragEnd }) {
  const status = item.status ?? "TODO";
  const overdue = isOverdue(item);
  const classes = ["card"];
  if (status === "IN_PROGRESS") classes.push("card--active");
  if (status === "COMPLETED") classes.push("card--done");
  if (dragging) classes.push("card--dragging");

  return (
    <article
      className={classes.join(" ")}
      draggable
      tabIndex={0}
      aria-label={`${itemKey(item.id)}: ${item.title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onDragStart={(e) => onDragStart(e, item.id)}
      onDragEnd={onDragEnd}
    >
      <div className="card__top">
        {item.contentType ? <TypeBadge type={item.contentType} /> : <span />}
        <span className="card__key">{itemKey(item.id)}</span>
      </div>
      <h3 className="card__title">{item.title}</h3>
      <div className="card__meta">
        <div className="card__info">
          {item.url && <IconLink size={14} />}
          {item.dueDate && (
            <span className={overdue ? "card__due--overdue" : undefined} title={overdue ? "Overdue" : "Due date"}>
              {formatDue(item.dueDate)}
            </span>
          )}
        </div>
        <StatusPill status={status} />
      </div>
    </article>
  );
}

function SkeletonLane({ lane }) {
  return (
    <section className="lane" aria-busy="true" aria-label={`${lane.column}, loading`}>
      <header className="lane__head">
        <h2 className="lane__title">{lane.column}</h2>
      </header>
      <div className="lane__cards">
        {[0, 1].map((n) => (
          <div key={n} className="card card--skeleton">
            <div className="skeleton-row">
              <span className="skeleton" style={{ width: 64 }} />
              <span className="skeleton" style={{ width: 36 }} />
            </div>
            <span className="skeleton" />
            <span className="skeleton" style={{ width: "60%" }} />
            <div className="skeleton-row">
              <span className="skeleton" style={{ width: 56 }} />
              <span className="skeleton" style={{ width: 40 }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
