import '@testing-library/jest-dom';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(String(key)) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(String(key));
  }

  setItem(key: string, value: string) {
    this.values.set(String(key), String(value));
  }
}

// Node 26 exposes an incomplete global localStorage unless started with
// --localstorage-file. Tests need browser-compatible storage with no runtime flags.
const localStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
Object.defineProperty(window, 'localStorage', { configurable: true, value: localStorage });
