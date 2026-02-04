/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./plexify-shared-ui/src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/plexify-shared-ui/dist/**/*.{js,mjs}",
  ],
  safelist: [
    // Ensure NotebookBD Phase 1A UI (shared-ui source) always has the required styles
    'bg-gradient-to-br',
    'from-indigo-500',
    'to-purple-600',
    'text-white',
    'bg-white/20',
    'hover:bg-white/30',
    'bg-white/90',
    'bg-black/20',
    'hover:bg-black/30',
    'from-black/60',
    'to-transparent',
    'aspect-video',
    'bg-slate-300',
    'from-slate-400',
    'to-slate-500',
    'bg-indigo-600',
    'hover:bg-indigo-700',
  ],
  theme: {
    extend: {
      colors: {
        // Navy Blue primary (PlexifyBID brand)
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a', // Main Navy Blue
          950: '#172554',
        },
        // BID operations colors
        bid: {
          green: '#70b180',      // Dashboard gradient light
          coral: '#e8927c',      // Dashboard gradient dark
          navyBlue: '#1e3a8a',   // Sidebar background
          activeNav: '#3b82f6',  // Active navigation item
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'inner-lg': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },
      borderWidth: {
        '3': '3px',
      },
      backgroundImage: {
        'blueprint-pattern': "linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)",
        'safety-stripe': "repeating-linear-gradient(45deg, #FFC107, #FFC107 10px, #000000 10px, #000000 20px)",
      },
      backgroundSize: {
        'blueprint': '20px 20px',
      },
    },
  },
  plugins: [],
}
