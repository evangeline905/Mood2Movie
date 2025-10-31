import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Static hosting for frontend
app.use(express.static(__dirname));

// Reverse proxy to Supabase, same-origin path /supabase
const SUPABASE_TARGET = 'https://emnvezsluaulmnoitrle.supabase.co';
const supabaseProxy = createProxyMiddleware({
  target: SUPABASE_TARGET,
  changeOrigin: true,
  ws: true,
  secure: true,
  logLevel: 'warn',
  pathRewrite: {
    '^/supabase': '',
  },
  onProxyReq(proxyReq, req, res) {
    // Keep Host/Origin headers for minimal cross-origin impact
    // (changeOrigin handles most cases)
  },
});
app.use('/supabase', supabaseProxy);

// Create HTTP server and mount WebSocket upgrade event
const server = http.createServer(app);
server.on('upgrade', supabaseProxy.upgrade);

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', (error) => {
  if (error) {
    console.error('Error starting server:', error);
    return;
  }
  console.log(`Reverse proxy + static server on http://localhost:${PORT}`);
  console.log(`Server is also accessible at http://0.0.0.0:${PORT}`);
});