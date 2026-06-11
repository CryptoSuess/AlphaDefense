/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // NIKO brand palette — dark navy / electric blue / white
        niko: {
          navy: '#0a0f24',
          deep: '#060a18',
          panel: '#101935',
          line: '#1d2b55',
          blue: '#0052ff',
          electric: '#3b82f6',
          glow: '#60a5fa',
          ice: '#bfdbfe',
          flame: '#38bdf8',
        },
      },
      fontFamily: {
        display: ['"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(59, 130, 246, 0.45)',
      },
    },
  },
  plugins: [],
};
