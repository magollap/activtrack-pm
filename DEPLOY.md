# Deploy ActivTrack for free: Vercel + Supabase

This guide puts ActivTrack on the internet at no cost:

- **Vercel (Hobby plan)** hosts the website and the small AI function in `api/ai.js`.
- **Supabase (Free plan)** holds the database and sign-in. You already have the tables.
- **Google Gemini (free tier)** powers the AI assistant. This is optional: without a key the assistant still understands everyday commands such as "add …", "move … to Done" and "assign … to …".

Total time: about 20 minutes.

> **Free-tier limits to know about**
> - Vercel Hobby is for personal, non-commercial use. A business that charges money should use Vercel Pro, or one of the alternatives at the end of this guide.
> - Supabase pauses a free project after one week without activity. Open the dashboard and click **Restore** to wake it. Any visit to the app also counts as activity.
> - On the Gemini free tier, Google may use what you send to improve its products. For confidential work, use a paid key (Gemini paid tier or Claude) instead.

---

## Step 1. Get your Supabase database ready

### 1a. Find your Supabase project

Sign in at [supabase.com/dashboard](https://supabase.com/dashboard) and open the project that holds your ActivTrack tables (`projects`, `tasks`, `statuses` and so on, under **Table Editor**).

- Tables already there: go to step 1b.
- No project yet, or the tables are missing: create a new project, then follow step 1c.

### 1b. Existing Supabase project: turn on live updates

In the Supabase dashboard, open **SQL Editor → New query**. Paste the contents of
`supabase/migrations/20261030120000_enable_realtime.sql` and click **Run**.

This lets open browser tabs refresh by themselves when a teammate changes a card. It changes no tables or permissions, and it is safe to run twice.

### 1b-2. Existing Supabase project: add custom fields and templates

In **SQL Editor → New query**, paste the contents of
`supabase/migrations/20261030160000_custom_fields_templates.sql` and click **Run**. Until you do, the app still works, but adding custom fields or saving templates asks you to run this file. (`setup.sql` already includes it.)

### 1c. New or empty Supabase project: create the tables

Do this if the tables are missing, or if the app says **"Could not find the table 'public.profiles' in the schema cache"**.

1. In Supabase, open **SQL Editor → New query**.
2. Paste the whole of `supabase/setup.sql` and click **Run**. It creates every table, security rule and trigger, turns on live updates, and sets up any account that signed up before the tables existed. The oldest account becomes the **governor** (super admin). It is safe to run again.
3. Reload the app and sign in.
4. Optional: so governors can create accounts from **Settings → Users**, deploy the `admin-create-user` edge function with the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy admin-create-user
   ```
   Without it, people can still sign up themselves, and governors can change their roles.

### 1d. Copy the two connection values

In Supabase, open **Project Settings → API** (or the **Connect** button at the top). Copy:

- **Project URL**, which looks like `https://abcdefgh.supabase.co`
- **anon public** key, or the newer **publishable** key that starts with `sb_publishable_`

Both are safe to use in the browser, because row level security protects the data. **Never** use the `service_role` or secret key in the app.

---

## Step 2. Create a free Gemini key (optional, recommended)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with a Google account.
2. Click **Create API key** and copy it.

You can use a different provider instead. Set **one** of these:

| Variable | Provider | Free tier |
| --- | --- | --- |
| `GEMINI_API_KEY` | Google Gemini | Yes |
| `GROQ_API_KEY` | Groq | Yes |
| `ANTHROPIC_API_KEY` | Anthropic Claude | No (paid) |
| `OPENAI_API_KEY` | OpenAI | No (paid) |
| `AI_API_KEY` and `AI_BASE_URL` | Any OpenAI-compatible service (OpenRouter, a self-hosted Ollama, ...) | Depends |

`AI_MODEL` optionally picks a different model than the default for that provider.

---

## Step 3. Deploy on Vercel

1. Push this repository to GitHub (it already is: `magollap/activtrack-pm`).
2. Sign in at [vercel.com](https://vercel.com) with GitHub and click **Add New → Project**.
3. Import `activtrack-pm`. Vercel reads `vercel.json` and detects **Vite**. Leave the build settings as they are.
4. Open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | the Project URL from step 1d |
   | `VITE_SUPABASE_ANON_KEY` | the anon or publishable key from step 1d |
   | `GEMINI_API_KEY` | the key from step 2 (optional) |

5. Click **Deploy**. After a minute or two you get an address like `https://activtrack-pm.vercel.app`.

> The `VITE_` values are built into the website. If you change them later, open **Deployments**, click **⋯** on the latest one, and choose **Redeploy**. AI keys take effect on the next deployment as well.

---

## Step 4. Tell Supabase about your new address

Sign-up confirmation emails and password resets link back to your site, so Supabase needs to know its address.

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel address, for example `https://activtrack-pm.vercel.app`.
3. Under **Redirect URLs**, add `https://activtrack-pm.vercel.app/**`. If you use a custom domain, add that too.

**Email confirmation:** by default, Supabase asks new users to confirm their email before they can sign in. Supabase's built-in email sender only sends a few emails per hour, which is fine for a small team. For more, connect your own email service under **Authentication → Emails → SMTP Settings**, or turn off **Confirm email** in the Email provider settings under **Authentication** if you trust everyone who can reach the site.

---

## Step 5. Check that it works

1. Open your Vercel address and sign in (or sign up).
2. Press **Ctrl+K** (⌘K on a Mac). The assistant's header shows **Gemini AI**, or **Built-in commands** when no AI key is set.
3. Type `add a card to test the deployment, high priority, due tomorrow` and press **Enter** twice.
4. Flip the theme switch at the top right: light mode is green, gold and blue; dark mode is black and gold.

### Troubleshooting

| What you see | Fix |
| --- | --- |
| "ActivTrack could not find its server or its online database." | `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing. Add both and redeploy. |
| The assistant says **Built-in commands** although you set a key | Redeploy after adding the key, and check that its name is spelled exactly as in the table above. |
| "The AI key was rejected" | The key is wrong or was revoked. Create a new one. |
| "The AI service is busy or the free quota is used up" | You hit the free tier's per-minute or daily limit. Wait, or use a paid key. |
| "Could not find the table 'public.profiles' in the schema cache" | The tables are missing in this Supabase project. Run `supabase/setup.sql` (step 1c). |
| Changes from teammates only show after switching tabs | Run `20261030120000_enable_realtime.sql` (step 1b). |
| Confirmation email link opens `localhost` | Set the Site URL in step 4. |
| A refreshed page such as `/projects/…` shows 404 | Make sure `vercel.json` is in the repository root. |

---

## Custom domain (optional)

In Vercel, open the project, then **Settings → Domains**, and add your domain. Vercel shows the DNS records to create at your registrar and issues HTTPS automatically. Then add the domain in Supabase as in step 4.

---

## Other free hosts

| Host | Website | AI assistant |
| --- | --- | --- |
| **Netlify** (free) | Works as is: build command `npm run build`, publish directory `dist`, plus the two `VITE_` variables. `public/_redirects` handles deep links. | Uses built-in commands. The Vercel function in `api/ai.js` would need a small Netlify Functions wrapper around `server/ai.mjs` for full AI. |
| **Cloudflare Pages** (free) | Same settings as Netlify. | Same as Netlify: built-in commands, or wrap `server/ai.mjs` in a Pages Function. |
| **Render, Railway, Fly.io, or your own server** | Run the Docker image or `npm start`. This uses the built-in file storage, not Supabase. | Full AI: set `GEMINI_API_KEY` (or another key) on the server. |

---

## Local development

```bash
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm ci
npm run dev               # http://localhost:5173, AI uses built-in commands
npx vercel dev            # optional: also runs api/ai.js locally, with the AI keys from .env
```
