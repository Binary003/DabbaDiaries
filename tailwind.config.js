import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url)).replace(/\\/g, '/');

export default {
  content: [
    `${workspaceRoot}apps/*/index.html`,
    `${workspaceRoot}apps/**/*.{js,ts,jsx,tsx}`,
    `${workspaceRoot}packages/**/*.{js,ts,jsx,tsx}`,
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F5EDDA',
          50: '#FBF6EA',
          100: '#F5EDDA',
          200: '#EBE0C9',
          300: '#DFD2B5',
          400: '#C9B98E',
        },
        ink: {
          DEFAULT: '#24211C',
          light: '#3D3933',
          muted: '#6B655C',
          faint: '#9A9388',
        },
        marigold: {
          DEFAULT: '#D98E04',
          light: '#E8A533',
          dark: '#B87403',
          50: '#FDF4E3',
          100: '#FAE9C4',
        },
        spice: {
          DEFAULT: '#1F3A2E',
          light: '#2D5240',
          dark: '#152921',
          50: '#E8EFEB',
          100: '#C5D6CC',
        },
        steel: {
          DEFAULT: '#6B7B80',
          light: '#8A979B',
          dark: '#566166',
          50: '#E8EDEE',
          100: '#D1D8DA',
        },
        leaf: {
          DEFAULT: '#3F7D4C',
          light: '#5A9A68',
          dark: '#2E6138',
          50: '#E6F0E9',
        },
        rust: {
          DEFAULT: '#B3432B',
          light: '#C95D44',
          dark: '#963519',
          50: '#F7E7E2',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(36, 33, 28, 0.04)',
        panel: '0 2px 8px rgba(36, 33, 28, 0.06)',
        float: '0 4px 16px rgba(36, 33, 28, 0.08)',
        ring: '0 0 0 1px rgba(36, 33, 28, 0.08)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'code-emphasis': {
          '0%': { transform: 'scale(0.96)', opacity: '0.5' },
          '50%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'code-emphasis': 'code-emphasis 0.5s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'shake': 'shake 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
};
