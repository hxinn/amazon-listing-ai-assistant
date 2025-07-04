/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#007bff',
          hover: '#0056b3',
        },
        secondary: '#6c757d',
        background: '#f8f9fa',
        surface: '#ffffff',
        text: '#212529',
        border: '#dee2e6',
        error: '#dc3545',
      },
    },
  },
  plugins: [],
} 