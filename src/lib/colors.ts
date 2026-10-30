export const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: 'Forest', hex: '#0a8c4e' },
  { name: 'Gold', hex: '#c9a227' },
  { name: 'Royal blue', hex: '#2550e8' },
  { name: 'Slate', hex: '#64748b' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Stone', hex: '#78716c' },
];

export function pickColor(index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length].hex;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}
