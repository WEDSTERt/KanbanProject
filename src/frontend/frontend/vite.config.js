import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],

    server: {
        host: true,
        port: 3000,
        allowedHosts: [
            'kanbandocky.ru',
            'screamingly-big-brocket.cloudpub.ru',
            'localhost'
        ],
        proxy: {
            '/graphql': {
                target: 'https://orally-perceptive-roughy.cloudpub.ru',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/graphql/, '/graphql')
            },
            '/api': {
                target: 'https://orally-perceptive-roughy.cloudpub.ru',
                changeOrigin: true,
                secure: false,
            }
        }
    },

    build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (id.includes('node_modules/react')) {
                        return 'vendor-react';
                    }
                    if (id.includes('node_modules/@apollo')) {
                        return 'vendor-apollo';
                    }
                    if (id.includes('node_modules')) {
                        return 'vendor';
                    }
                }
            }
        }
    }

})