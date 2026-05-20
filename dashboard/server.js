'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const session = require('express-session');
const path = require('path');

const authRouter = require('./routes/auth');
const pagesRouter = require('./routes/pages');
const apiRouter = require('./routes/api');

const PORT = process.env.DASHBOARD_PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-env';

if (SESSION_SECRET === 'change-me-in-env') {
  console.warn('[Dashboard] WARNING: SESSION_SECRET is not set in .env — using insecure default');
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax',
  },
}));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/auth', authRouter);
app.use('/api', apiRouter);
app.use('/', pagesRouter);

// 404
app.use((req, res) => {
  res.status(404).send('<h1 style="font-family:sans-serif;background:#0B0B0F;color:#fff;padding:40px">404 — Page not found</h1>');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Dashboard Error]', err);
  res.status(500).send('<h1 style="font-family:sans-serif;background:#0B0B0F;color:#fff;padding:40px">500 — Internal server error</h1>');
});

app.listen(PORT, () => {
  console.log(`[Dashboard] Running at http://localhost:${PORT}`);
});
