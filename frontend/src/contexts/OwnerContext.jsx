import { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const OwnerContext = createContext(null);

const STORAGE_KEY = 'geo_owner';

export function OwnerProvider({ children }) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setOwner(JSON.parse(stored)); }
      catch { localStorage.removeItem(STORAGE_KEY); }
    }
    setLoading(false);
  }, []);

  function register(name) {
    const o = { owner_id: uuidv4(), owner_name: name.trim() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
    setOwner(o);
    return o;
  }

  function update(name) {
    const o = { ...owner, owner_name: name.trim() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
    setOwner(o);
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setOwner(null);
  }

  return (
    <OwnerContext.Provider value={{ owner, loading, register, update, reset }}>
      {children}
    </OwnerContext.Provider>
  );
}

export function useOwner() {
  return useContext(OwnerContext);
}
