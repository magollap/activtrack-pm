import { table } from '@/lib/db/tables';
import { isHexColor, COLOR_PALETTE } from '@/lib/colors';
import { parseDay } from '@/lib/dates';
import { FIELD_TYPES, type CustomField, type FieldOption, type FieldType, type FieldValue, type Task } from '@/lib/db/types';

export const FIELD_TYPE_META: Record<FieldType, { label: string; hint: string }> = {
  text: { label: 'Text', hint: 'A short note, name or code' },
  number: { label: 'Number', hint: 'Story points, cost, hours' },
  date: { label: 'Date', hint: 'Any date besides start and due' },
  select: { label: 'Dropdown', hint: 'Pick one of a few choices' },
  checkbox: { label: 'Checkbox', hint: 'Yes or no' },
  url: { label: 'Link', hint: 'A web address' },
};

export interface FieldInput {
  name: string;
  type: FieldType;
  options: FieldOption[];
  showOnCard: boolean;
}

const byOrder = (a: CustomField, b: CustomField) => a.order - b.order || a.createdAt.localeCompare(b.createdAt);

export const newOptionId = (): string => Math.random().toString(36).slice(2, 10);

export function defaultOptionColor(index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length].hex;
}

function cleanOptions(options: FieldOption[]): FieldOption[] {
  const seen = new Set<string>();
  const cleaned = options
    .map((o) => ({ id: o.id || newOptionId(), label: o.label.trim().slice(0, 60), color: isHexColor(o.color) ? o.color : defaultOptionColor(0) }))
    .filter((o) => {
      const key = o.label.toLowerCase();
      if (!o.label || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (cleaned.length > 50) throw new Error('Dropdowns can have at most 50 choices.');
  return cleaned;
}

function clean(input: FieldInput): FieldInput {
  const name = input.name.trim();
  if (!name) throw new Error('Please name the field.');
  if (name.length > 40) throw new Error('Field names can be at most 40 characters.');
  if (!FIELD_TYPES.includes(input.type)) throw new Error('Choose a field type.');
  const options = input.type === 'select' ? cleanOptions(input.options) : [];
  if (input.type === 'select' && !options.length) throw new Error('Add at least one choice to the dropdown.');
  return { name, type: input.type, options, showOnCard: input.showOnCard };
}

/** Fields for one project (or all you can see). Returns [] on databases without the custom fields table yet. */
export async function listFields(projectId?: string): Promise<CustomField[]> {
  try {
    const rows = await table('customFields').list(projectId ? { projectId } : undefined);
    return rows.map((f) => ({ ...f, options: Array.isArray(f.options) ? f.options : [] })).sort(byOrder);
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

/** True when the error says the table does not exist yet (the custom fields SQL has not been run). */
export function isMissingTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /schema cache|does not exist|Unknown collection|relation .* does not exist/i.test(message);
}

export async function createField(projectId: string, input: FieldInput): Promise<CustomField> {
  const existing = await listFields(projectId);
  if (existing.length >= 30) throw new Error('A project can have at most 30 custom fields.');
  const order = existing.length ? existing[existing.length - 1].order + 1 : 0;
  try {
    return await table('customFields').insert({ ...clean(input), projectId, order });
  } catch (error) {
    if (isMissingTable(error)) {
      throw new Error('Custom fields need a one-time database update. Run supabase/migrations/20261030160000_custom_fields_templates.sql in the Supabase SQL Editor.');
    }
    throw error;
  }
}

/** The type cannot change after creation, so existing values always match it. */
export const updateField = (id: string, input: FieldInput): Promise<CustomField> => {
  const { name, options, showOnCard } = clean(input);
  return table('customFields').update(id, { name, options, showOnCard });
};

export async function reorderFields(orderedIds: string[]): Promise<void> {
  await table('customFields').updateMany(orderedIds.map((id, order) => ({ id, patch: { order } })));
}

export async function deleteField(id: string): Promise<void> {
  await table('customFields').remove({ id });
}

/** Turns raw input into a stored value for the field's type; null clears it. */
export function cleanFieldValue(field: CustomField, raw: unknown): FieldValue {
  if (raw === null || raw === undefined || raw === '') return null;
  switch (field.type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
      if (!Number.isFinite(n)) throw new Error(`${field.name} must be a number.`);
      return n;
    }
    case 'checkbox':
      return raw === true || raw === 'true';
    case 'date': {
      const day = String(raw);
      if (!parseDay(day)) throw new Error(`${field.name} needs a valid date.`);
      return day;
    }
    case 'select': {
      const option = field.options.find((o) => o.id === raw || o.label.toLowerCase() === String(raw).toLowerCase());
      if (!option) throw new Error(`"${String(raw)}" is not a choice for ${field.name}.`);
      return option.id;
    }
    case 'url': {
      const text = String(raw).trim().slice(0, 500);
      const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
      try {
        new URL(url);
      } catch {
        throw new Error(`${field.name} needs a valid web address.`);
      }
      return url;
    }
    default:
      return String(raw).trim().slice(0, 500) || null;
  }
}

/** The card's values with one field changed; empty values are dropped to keep the record small. */
export function withFieldValue(task: Task, fieldId: string, value: FieldValue): Record<string, FieldValue> {
  const next = { ...(task.customValues ?? {}) };
  if (value === null || value === false) delete next[fieldId];
  else next[fieldId] = value;
  return next;
}

/** A short human-readable version of a value, for cards, CSV and AI context. */
export function formatFieldValue(field: CustomField, value: FieldValue | undefined): string | null {
  if (value === null || value === undefined || value === '' || value === false) return null;
  switch (field.type) {
    case 'select':
      return field.options.find((o) => o.id === value)?.label ?? null;
    case 'checkbox':
      return 'Yes';
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'date': {
      const date = parseDay(String(value));
      return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
    }
    case 'url':
      return String(value).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    default:
      return String(value);
  }
}
