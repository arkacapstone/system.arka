import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // `npm run dev` serves the scripts from the same address as APP_URL (e.g. the computer's
    // Wi-Fi IP), so ARKA also opens on phones and laptops on the same network. With localhost
    // only, other devices (and Chrome on the IP address) got a blank white page.
    const appHost = new URL(loadEnv(mode, process.cwd(), '').APP_URL || 'http://localhost').hostname;

    return {
        plugins: [
            laravel({
                input: 'resources/js/app.jsx',
                refresh: true,
            }),
            react(),
        ],
        server: {
            host: '0.0.0.0',
            port: 5173,
            strictPort: true,
            origin: `http://${appHost}:5173`,
            cors: true,
            hmr: { host: appHost },
        },
    };
});
