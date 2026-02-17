/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        krt: {
          bg: '#0a0e1a',
          panel: '#111827',
          border: '#1f2937',
          accent: '#3b82f6',
          danger: '#ef4444',
          success: '#22c55e',
          warn: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
};
