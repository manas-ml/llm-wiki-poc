import { randomUUID } from "node:crypto";

/**
 * Minimal in-memory collection store. Swap this out for a real database
 * (Postgres, SQLite, ...) without touching the service/controller layers,
 * which only depend on this class's public methods.
 */
export class InMemoryStore<T extends { id: string }> {
  private readonly records = new Map<string, T>();

  create(build: (id: string) => T): T {
    const id = randomUUID();
    const record = build(id);
    this.records.set(id, record);
    return record;
  }

  findAll(): T[] {
    return Array.from(this.records.values());
  }

  findById(id: string): T | undefined {
    return this.records.get(id);
  }

  update(id: string, patch: Partial<T>): T | undefined {
    const existing = this.records.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.records.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.records.delete(id);
  }
}
