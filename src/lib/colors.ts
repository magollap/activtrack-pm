export const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: 'Slate', hex: '#64748b' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Lime', hex: '#65a30d' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Cyan', hex: '#0891b2' },
  { name: 'Stone', hex: '#78716c' },
];

export function pickColor(index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length].hex;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}
