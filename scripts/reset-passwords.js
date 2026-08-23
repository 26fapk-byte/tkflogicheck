/**
 * reset-passwords.js
 * Usage: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in a .env file or environment,
 * then run: node scripts/reset-passwords.js emails.csv
 *
 * The script reads a CSV (one email per line, or email;newPassword per line) and
 * updates each user's password using Supabase Admin REST endpoints.
 * IMPORTANT: keep your Service Role key secure. Run this locally, do not commit keys.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/reset-passwords.js emails.csv');
  process.exit(1);
}

const csv = fs.readFileSync(path.resolve(input), 'utf8').trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);

async function getUserByEmail(email) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to fetch user by email: ${res.status} ${txt}`);
  }
  const data = await res.json();
  // Supabase may return an object or array depending on version; handle both
  if (Array.isArray(data) && data.length > 0) return data[0];
  if (data && data.id) return data;
  return null;
}

async function updatePassword(userId, newPassword) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: newPassword })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to update password: ${res.status} ${txt}`);
  }
  return await res.json();
}

(async () => {
  console.log('Reset script started. Ensure your project is active (not paused) in Supabase.');
  for (const line of csv) {
    // support lines like: email or email;newPassword
    const parts = line.split(/[,;\t]/).map(s => s.trim()).filter(Boolean);
    const email = parts[0];
    const newPassword = parts[1] || '123456';
    try {
      process.stdout.write(`Processing ${email} ... `);
      const user = await getUserByEmail(email);
      if (!user) {
        console.log('user not found');
        continue;
      }
      await updatePassword(user.id, newPassword);
      console.log('OK');
    } catch (err) {
      console.error('ERROR', err.message || err);
    }
  }
  console.log('Done. Ask users to change passwords at first login.');
})();
