import { backend } from '@/lib/backend';
import type { Filter } from '@/lib/backend/types';
import { emitChange } from '@/lib/db/events';
import type { BaseRecord, CollectionName, Collections, NewRecord } from '@/lib/db/types';

type Row<C extends CollectionName> = Collections[C];
type Input<C extends CollectionName> = Partial<NewRecord<Row<C>>>;

/** Typed access to one collection on whichever backend is active; every write notifies open screens. */
export function table<C extends CollectionName>(collection: C) {
  return {
    list: (filter?: Filter<Row<C>>) => backend().list(collection, filter),
    async find(id: string): Promise<Row<C> | null> {
      const rows = await backend().list(collection, { id } as Filter<Row<C>>);
      return rows[0] ?? null;
    },
    async insert(data: Input<C>): Promise<Row<C>> {
      const [row] = await backend().insert(collection, [data as Record<string, unknown>]);
      emitChange(collection);
      if (!row) throw new Error('The item could not be saved.');
      return row;
    },
    async insertMany(data: Input<C>[]): Promise<Row<C>[]> {
      const rows = await backend().insert(collection, data as Record<string, unknown>[]);
      if (rows.length) emitChange(collection);
      return rows;
    },
    async update(id: string, patch: Input<C>): Promise<Row<C>> {
      const row = await backend().update(collection, id, patch as Record<string, unknown>);
      emitChange(collection);
      return row;
    },
    async updateMany(patches: { id: string; patch: Input<C> }[]): Promise<void> {
      if (!patches.length) return;
      try {
        await Promise.all(patches.map((p) => backend().update(collection, p.id, p.patch as Record<string, unknown>)));
      } finally {
        emitChange(collection);
      }
    },
    async remove(filter: Filter<Row<C>>): Promise<number> {
      const removed = await backend().remove(collection, filter);
      if (removed) emitChange(collection);
      return removed;
    },
  };
}

export const byCreated = (a: BaseRecord, b: BaseRecord) => a.createdAt.localeCompare(b.createdAt);
