import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 3000,
        allowedHosts: [
            'screamingly-big-brocket.cloudpub.ru',
            '.cloudpub.ru'
        ],
        proxy: {
            '/graphql': {
                target: 'https://orally-perceptive-roughy.cloudpub.ru',
                changeOrigin: true,
                secure: false,
            },
            '/api': {
                target: 'https://orally-perceptive-roughy.cloudpub.ru',
                changeOrigin: true,
                secure: false,
            }
        }
    }
})