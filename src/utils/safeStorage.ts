/**
 * Helper seguro para sessionStorage / localStorage.
 * - Envuelve todas las operaciones en try-catch (private browsing, quota exceeded).
 * - Funciona fuera de componentes React (hooks, utils, event handlers).
 */

export function safeGetItem(key: string, storage: Storage = sessionStorage): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string, storage: Storage = sessionStorage): void {
  try {
    storage.setItem(key, value);
  } catch {
    // quota exceeded o private browsing
  }
}

export function safeRemoveItem(key: string, storage: Storage = sessionStorage): void {
  try {
    storage.removeItem(key);
  } catch {
    // noop
  }
}
