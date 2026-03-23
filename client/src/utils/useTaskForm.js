import { useState, useRef, useEffect } from "react";

/**
 * Shared hook for all task forms.
 * Eliminates repeated useState + useRef + useEffect pattern across 6+ forms.
 *
 * Usage:
 *   const { d, u } = useTaskForm(item, saveFnRef, onSave);
 *   // d = form data, u(key, value) = update field
 */
export function useTaskForm(item, saveFnRef, onSave, initialExtra = {}) {
  const [d, setD] = useState({ ...item, ...initialExtra });
  const dRef = useRef(d);

  const u = (key, value) => setD(prev => {
    const next = { ...prev, [key]: value };
    dRef.current = next;
    return next;
  });

  useEffect(() => {
    dRef.current = d;
    if (saveFnRef) saveFnRef.current = () => onSave(dRef.current);
  }, [d]);

  return { d, u, dRef };
}
