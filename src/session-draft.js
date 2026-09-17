import { useEffect, useState } from 'react';
export function readSessionDraft(key) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(key));
    if (stored?.version === 1 && stored.data && Array.isArray(stored.data.items)) return stored.data;
  } catch { /* Missing, disabled or invalid storage starts a fresh document. */ }
  return {};
}
export function useSessionDraft(key, data) {
  const serialized = JSON.stringify({ version: 1, data });
  const [error, setError] = useState('');
  useEffect(() => {
    let message = '';
    try {
      sessionStorage.setItem(key, serialized);
    } catch {
      message = 'Session recovery is unavailable (browser storage is full or disabled). Save your work before refreshing.';
    }
    const timer = setTimeout(() => setError(message), 0);
    return () => clearTimeout(timer);
  }, [key, serialized]);
  return error;
}
