import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 静态托管前端
app.use(express.static(__dirname));

// 反向代理到 Supabase，同源路径 /supabase
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
    // 保持 Host/Origin 等头部以获得最少跨源影响
    // （changeOrigin 已处理大部分情况）
  },
});
app.use('/supabase', supabaseProxy);

// 创建 HTTP 服务器并挂载 WebSocket 升级事件
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