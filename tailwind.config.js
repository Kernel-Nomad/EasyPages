export default {
  content: [
    "./src/web/index.html",
    "./src/web/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Modal enter/exit. `both` holds the final frame so the panel does not flash back to
      // its start state between the animation ending and React unmounting it.
      // prefers-reduced-motion is handled globally in shared/styles/index.css.
      keyframes: {
        'backdrop-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'backdrop-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'panel-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'panel-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(12px) scale(.96)' },
        },
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'sheet-out': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(100%)' } },
      },
      animation: {
        'backdrop-in': 'backdrop-in 260ms ease-out both',
        'backdrop-out': 'backdrop-out 200ms ease-in both',
        'panel-in': 'panel-in 260ms cubic-bezier(.16,1,.3,1) both',
        'panel-out': 'panel-out 200ms ease-in both',
        'sheet-in': 'sheet-in 280ms cubic-bezier(.16,1,.3,1) both',
        'sheet-out': 'sheet-out 200ms ease-in both',
      },
    },
  },
  plugins: [],
}
