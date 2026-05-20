'use strict';

const express = require('express');
const axios = require('axios');
const router = express.Router();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DASHBOARD_URL = (process.env.DASHBOARD_URL || 'http://localhost:3000').replace(/\/$/, '');
const REDIRECT_URI = `${DASHBOARD_URL}/auth/callback`;

const DISCORD_API = 'https://discord.com/api/v10';
const SCOPES = 'identify guilds';

// GET /auth/discord — redirect to Discord OAuth2
router.get('/discord', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send('OAuth2 is not configured. Set CLIENT_ID and DISCORD_CLIENT_SECRET in .env');
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    prompt: 'none',
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

// GET /auth/callback — Discord redirects here with ?code=
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/login?error=no_code');
  }

  try {
    // Exchange code for access token
    const tokenResp = await axios.post(`${DISCORD_API}/oauth2/token`, new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    const { access_token, refresh_token, expires_in } = tokenResp.data;

    // Fetch user info
    const userResp = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` },
      timeout: 10000,
    });

    // Fetch user's guilds
    const guildsResp = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${access_token}` },
      timeout: 10000,
    });

    const user = userResp.data;
    const guilds = guildsResp.data;

    // Store in session
    req.session.user = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiry: Date.now() + expires_in * 1000,
    };
    req.session.guilds = guilds;

    res.redirect('/dashboard');
  } catch (err) {
    console.error('[Auth] OAuth callback error:', err.response?.data || err.message);
    res.redirect('/login?error=oauth_failed');
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
