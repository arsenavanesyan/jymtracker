import Database from "@tauri-apps/plugin-sql";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const DB_PATH = "sqlite:jymtracker.db";

const DbContext = createContext<Database | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Database.load(DB_PATH)
      .then((d) => {
        if (!cancelled) setDb(d);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="shell">
        <p className="error">
          Не удалось открыть базу: {error}. Убедитесь, что приложение запущено
          через Tauri (<code>npm run tauri dev</code>) и установлен Rust.
        </p>
      </div>
    );
  }

  if (!db) {
    return (
      <div className="shell">
        <p className="muted">Загрузка базы…</p>
      </div>
    );
  }

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Database {
  const db = useContext(DbContext);
  if (!db) throw new Error("Database context is not ready");
  return db;
}
