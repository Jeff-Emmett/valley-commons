const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// API routes - wrap Vercel serverless functions
const waitlistHandler = require('./api/waitlist');
const gameChatHandler = require('./api/game-chat');
const shareToGithubHandler = require('./api/share-to-github');

// Adapter to convert Vercel handler to Express
const vercelToExpress = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('API Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

app.all('/api/waitlist', vercelToExpress(waitlistHandler));
app.all('/api/game-chat', vercelToExpress(gameChatHandler));
app.all('/api/share-to-github', vercelToExpress(shareToGithubHandler));

// Static files
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  index: 'index.html'
}));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Valley of the Commons server running on port ${PORT}`);
});
