import { Check } from 'lucide-react';
import { COLOR_PALETTE } from '@/lib/colors';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {COLOR_PALETTE.map((color) => {
        const selected = color.hex.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={color.hex}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.name}
            title={color.name}
            onClick={() => onChange(color.hex)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 ${selected ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900' : ''}`}
            style={{ backgroundColor: color.hex }}
          >
            {selected && <Check className="h-3.5 w-3.5 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
