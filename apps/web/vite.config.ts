import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@/components/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@maas/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
            '@maas/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
        },
    },
});