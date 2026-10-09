import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Serves /api/sku during `npm run dev` / `npm run preview` using the same handler as the Vercel function.
const localApi = () => ({
  name: 'local-sheets-api',
  configureServer(server) {
    server.middlewares.use('/api/sku', async (req, res) => {
      const { skuHandler } = await server.ssrLoadModule('/server/handler.js');
      return skuHandler(req, res);
    });
  },
});

export default defineConfig({ plugins: [react(), localApi()] });
