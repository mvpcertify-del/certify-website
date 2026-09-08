import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local dev plugin to handle Vercel-style serverless API routes
function vercelApiPlugin() {
  return {
    name: 'vercel-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();

        const routePath = req.url.split('?')[0]; // e.g. /api/checkout
        const { fileURLToPath, pathToFileURL } = await import('url');
        const { dirname, join } = await import('path');
        const __dirname = dirname(fileURLToPath(import.meta.url));

        // pathToFileURL, not the bare path. On Windows `join()` produces
        // "E:\...\api\user.js", and Node's ESM loader reads the drive letter as
        // a URL scheme — it fails with "Only URLs with a scheme in: file, data,
        // and node are supported ... Received protocol 'e:'". Every /api/* call
        // then returned HTTP 500, so no admin screen that reads through the
        // service role could be tested locally at all. It looked like empty
        // data rather than a broken dev server, which is worse: on 8 Sep it
        // briefly read as a real bug in the Consultancies and Referral Partners
        // pages. POSIX paths have no drive letter, which is why this never
        // showed up anywhere but Windows.
        const modulePath = pathToFileURL(join(__dirname, `${routePath}.js`)).href;

        try {
          // Load env vars for server-side use
          const { default: dotenv } = await import('dotenv');
          dotenv.config();

          const module = await import(/* @vite-ignore */ modulePath);
          const handler = module.default;

          // Parse JSON body for POST requests
          if (req.method === 'POST') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            req.body = JSON.parse(Buffer.concat(chunks).toString());
          }

          // Adapt res to include .status().json() like Vercel
          const originalEnd = res.end.bind(res);
          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            originalEnd(JSON.stringify(data));
          };

          await handler(req, res);
        } catch (err) {
          console.error('API route error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vercelApiPlugin()],
  optimizeDeps: {
    include: ['@supabase/supabase-js', 'tslib'],
  },
  resolve: {
    dedupe: ['@supabase/supabase-js'],
  },
  build: {
    // Split big shared libraries into their own long-lived chunks so they're
    // cached across deploys and don't bloat each lazy page chunk.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (/i18next|react-i18next/.test(id)) return 'vendor-i18n';
        },
      },
    },
  },
})
