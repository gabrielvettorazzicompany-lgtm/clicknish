const { heroui } = require("@heroui/react")

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Habilita modo escuro via classe CSS
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        primary: '#6366f1',
        secondary: '#ec4899',
        // Cores personalizadas para temas
        background: {
          light: '#ffffff',
          dark: '#0f1117',
        },
        surface: {
          light: '#f8fafc',
          dark: '#1a1d2e',
        },
        border: {
          light: '#e2e8f0',
          dark: '#1e2139',
        },
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              50: '#eef2ff',
              100: '#e0e7ff',
              200: '#c7d2fe',
              300: '#a5b4fc',
              400: '#818cf8',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
              800: '#3730a3',
              900: '#312e81',
              DEFAULT: '#6366f1',
              foreground: '#ffffff',
            },
          },
        },
        dark: {
          colors: {
            primary: {
              50: '#eef2ff',
              100: '#e0e7ff',
              200: '#c7d2fe',
              300: '#a5b4fc',
              400: '#818cf8',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
              800: '#3730a3',
              900: '#312e81',
              DEFAULT: '#6366f1',
              foreground: '#ffffff',
            },
          },
        },
      },
    }),
  ],
}
