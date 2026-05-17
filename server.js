// server.js
// Ponto de entrada do Float. Configura Express, WebSocket, rotas e serve o frontend.
// Pra rodar: `npm start` ou `npm run dev` (com auto-reload)

const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./middleware/rateLimit');
const { runMigrations, seedData } = require('./database/migrations/migrations');
const FloatWS = require('./services/websocket');
const config = require('./config/config');

// Rotas
const authRoutes = require('./routes/auth');
const channelRoutes = require('./routes/channels');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');

// Inicializa o banco
console.log('Starting Float...');
runMigrations();
seedData();

const app = express();
const server = http.createServer(app);

// Seguranca
app.use(helmet({
  contentSecurityPolicy: false,   // necessario pra carregar 7.css do CDN
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: config.server.env === 'production' ? false : true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting em todas as rotas /api/
app.use('/api/', apiLimiter);

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);

// Arquivos estaticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: config.server.env === 'production' ? '1d' : 0,
}));

// SPA fallback: qualquer rota que nao seja /api/ serve o index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: config.server.env === 'production' ? 'Erro interno' : err.message,
  });
});

// Inicializa WebSocket no mesmo servidor HTTP
const wsServer = new FloatWS(server);

// Bora
const PORT = config.server.port;
server.listen(PORT, () => {
  console.log(`\n  Float running at http://localhost:${PORT}\n`);
});

module.exports = { app, server };
