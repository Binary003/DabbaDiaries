import shared from '../../tailwind.config.js';

export default {
    ...shared,
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'],
};