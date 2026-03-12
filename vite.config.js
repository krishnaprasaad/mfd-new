import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            }
        }
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                booking: resolve(__dirname, 'booking.html'),
                signup: resolve(__dirname, 'signup.html'),
            }
        }
    }
});
