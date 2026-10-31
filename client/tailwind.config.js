/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#03050c',
          900: '#070c1e',
          850: '#0a122c',
          800: '#0f1b3f',
          700: '#172554',
          600: '#1e3a8a',
        },
        star: {
          active: '#38bdf8',
          activeGlow: 'rgba(56, 189, 248, 0.35)',
          pending: '#f59e0b',
          pendingGlow: 'rgba(245, 158, 11, 0.35)',
          superseded: '#64748b',
          supersededGlow: 'rgba(100, 116, 139, 0.2)',
          conflict: '#ef4444',
          conflictGlow: 'rgba(239, 68, 68, 0.5)',
        },
        telemetry: {
          cyan: '#38bdf8',
          emerald: '#10b981',
          rose: '#f43f5e',
          amber: '#fbbf24',
          violet: '#818cf8',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Space Mono"', 'ui-monospace', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -2px rgba(56, 189, 248, 0.4)',
        'glow-amber': '0 0 20px -2px rgba(245, 158, 11, 0.4)',
        'glow-red': '0 0 25px 2px rgba(239, 68, 68, 0.55)',
        'panel': '0 8px 32px 0 rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'scanline': 'scanline 4s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-spin': 'radar 10s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        },
        radar: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
