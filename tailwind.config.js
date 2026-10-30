/** @type {import('tailwindcss').Config} */

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** A colour scale whose values live in CSS variables, so light and dark mode can swap them (see src/index.css). */
const themed = (name) =>
  Object.fromEntries(SHADES.map((shade) => [shade, `rgb(var(--${name}-${shade}) / <alpha-value>)`]));

const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light mode: brand = green, gold = gold, info = blue.
        // Dark mode:  brand = gold, gold = gold, info = champagne, slate = warm blacks.
        brand: { ...themed('brand'), contrast: token('brand-contrast') },
        gold: themed('gold'),
        info: themed('info'),
        slate: themed('slate'),
        sidebar: {
          DEFAULT: token('sidebar-bg'),
          fg: token('sidebar-fg'),
          muted: token('sidebar-muted'),
          hover: token('sidebar-hover'),
          active: token('sidebar-active'),
          accent: token('sidebar-accent'),
          border: token('sidebar-border'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-left': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-right': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-down': { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
        'slide-left': 'slide-left 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-right': 'slide-right 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-up': 'slide-up 180ms ease-out',
        'slide-down': 'slide-down 180ms ease-out',
      },
    },
  },
  plugins: [],
};
