'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const ejsLayouts = require('express-ejs-layouts');

const { notFound, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');
const db = require('./models');

const app = express();

const PORT = parseInt(process.env.PORT || '3000', 10);

// Ensure runtime directories exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const extractedDir = path.join(__dirname, 'public', 'extracted');
[uploadsDir, extractedDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(ejsLayouts);
app.set('layout', 'layout');

// Core middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Locals exposed to all views
app.use((req, res, next) => {
  res.locals.title = 'Video to Image';
  res.locals.activeNav = '';
  next();
});

// Routes
app.use('/', routes);

// 404 + error handlers (must come last)
app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await db.sequelize.authenticate();
    console.log('[db] connection OK');
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    console.error('Tip: run `npm run db:create && npm run db:migrate` first.');
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
