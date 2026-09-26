import { useCallback, useEffect, useState } from "react";
import { SESSION_DAYS, session, setAccessKey } from "./api.js";
import Onboarding from "./Onboarding.jsx";
import Board from "./Board.jsx";

const EXPIRED_NOTICE = `You were signed out after ${SESSION_DAYS} days. Enter your access key to open your board again.`;
const HOUR = 60 * 60 * 1000;

function restore() {
  const saved = session.load();
  if (saved && saved.expiresAt > Date.now()) {
    setAccessKey(saved.key);
    return { key: saved.key, expiresAt: saved.expiresAt, notice: null };
  }
  if (saved) session.clear();
  setAccessKey(null);
  return { key: null, expiresAt: null, notice: saved ? EXPIRED_NOTICE : null };
}

export default function App() {
  const [auth, setAuth] = useState(restore);

  const open = useCallback((key) => {
    const expiresAt = session.save(key);
    setAccessKey(key);
    setAuth({ key, expiresAt, notice: null });
  }, []);

  const leave = useCallback((notice = null) => {
    session.clear();
    setAccessKey(null);
    setAuth({ key: null, expiresAt: null, notice });
  }, []);

  // A tab can stay open for weeks. Check the expiry every hour and whenever the
  // tab comes back into view. (A single 30-day setTimeout isn't possible: browsers
  // cap timer delays at about 24.8 days and fire longer ones immediately.)
  useEffect(() => {
    if (!auth.key) return undefined;
    const check = () => {
      if (Date.now() >= auth.expiresAt) leave(EXPIRED_NOTICE);
    };
    const timer = setInterval(check, HOUR);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [auth.key, auth.expiresAt, leave]);

  const onUnauthorized = useCallback(
    () => leave("That access key isn't recognized anymore. Enter it again or create a new one."),
    [leave]
  );

  return auth.key ? (
    <Board accessKey={auth.key} onSignOut={() => leave()} onUnauthorized={onUnauthorized} />
  ) : (
    <Onboarding notice={auth.notice} onOpen={open} />
  );
}
