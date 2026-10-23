/** An in-memory Storage stand-in for `sessionStorage`/`localStorage` in Vitest's node project (no real browser storage there). */
export function fakeStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size
    },
  }
}
