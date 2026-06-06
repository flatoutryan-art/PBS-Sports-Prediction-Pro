/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream:  '#F5EFDF',
        gold:   '#C9A84C',
        maroon: '#6B1B2E',
      },
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        heading: ['Rajdhani', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'shield-gradient': 'linear-gradient(135deg, #6B1B2E 0%, #3D0D1A 100%)',
      },
      boxShadow: {
        card: '0 4px 24px 0 rgba(0,0,0,0.4)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
