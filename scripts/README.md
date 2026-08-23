Reset passwords script

Usage:

1. Create a `.env` file in the repo root (do NOT commit it) with:

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

2. Prepare a file `emails.csv` with one email per line or `email,newPassword` per line.

3. Run locally:

```bash
node scripts/reset-passwords.js emails.csv
```

Notes:
- Keep the Service Role key secret. Run this on your local machine only.
- If Supabase project is paused or SMTP is not configured, password reset e-mails may not be delivered.
