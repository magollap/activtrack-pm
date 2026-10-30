# ActivTrack

ActivTrack is a project and task management app with AI skills. It has board, list and calendar views, comments, checklists, history, a home dashboard and a cross-project **My tasks** page. People sign in, and each person gets a private space. Governors create shared projects and decide who can see them. You can install it as an app (PWA).

**What's new**

- **AI assistant** (Ctrl+K / ⌘K): type "add a card to fix the login bug, high priority, due Friday, assign to Priya" or "move release notes to Done". It shows a preview of every change, and nothing happens until you approve it. Changes run with your own permissions. Works with Gemini or Groq (free tiers), Claude, OpenAI or any OpenAI-compatible model. Without a key it still understands everyday commands.
- **Light and dark themes** with a switch in the top bar: green, gold and blue in light mode; black and gold in dark mode. Settings → App & theme also offers "follow this device".
- **Live updates**: cards move on everyone's screen as teammates change them (Supabase Realtime).
- **Bulk edit** in the list view: select cards and move, re-prioritise or assign them together.
- **My tasks**: everything assigned to you across projects, grouped by due date, with one-click complete.
- **Project progress** bars, card **duplicate** and **copy link**, and **keyboard shortcuts** (press `?`).
- **Custom fields**: add your own card fields per project (text, number, date, dropdown, checkbox, link), shown as chips on cards and included in CSV export. Project menu → **Custom fields**.
- **Project templates**: start new projects from built-in templates (software sprint, bug tracking, marketing campaign, product launch, event planning) or save any project as your own template, with or without its cards.

Where data lives depends on how you run it:

| Run it as | Data is stored | Sign-in methods |
| --- | --- | --- |
| Website on Vercel, Netlify or another static host | Online database (Supabase) | Email and password |
| Linux, Windows or Docker install | `data/workday.json` on the server | ActivTrack passwords and/or LDAP (company directory) |

The app decides at start-up. If the ActivTrack server answers on `/api/health`, it uses server storage. Otherwise it uses the online database.

- **Stack:** React 18, TypeScript, Vite, Tailwind CSS, React Router, lucide-react, date-fns, dnd-kit and vite-plugin-pwa.
- **Requirements:** Node.js 22 or newer (only for building and self-hosting).

```bash
npm ci          # install packages
npm run dev     # start the development server (copy .env.example to .env first)
npm run build   # type-check and build the static site into dist/
npm start       # run the ActivTrack server (app + data + sign-in) on http://localhost:8080
```

---

## 1. Deploy for free on Vercel + Supabase

See **[DEPLOY.md](DEPLOY.md)** for the full step-by-step guide. In short:

1. In Supabase, run `supabase/migrations/20261030120000_enable_realtime.sql` in the SQL Editor, and copy the Project URL and anon key.
2. In Vercel, import the GitHub repository and add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and, optionally, `GEMINI_API_KEY`.
3. Deploy, then set your Vercel address as the **Site URL** in Supabase → Authentication → URL Configuration.

`vercel.json` handles deep links and caching, and `api/ai.js` is the AI function. It checks the caller's Supabase session before using the AI key, so only people with an account can use it.

---

## 2. Linux install

```bash
git clone <your-repo-url> workday   # or copy the project folder
cd workday
chmod +x scripts/install-linux.sh
./scripts/install-linux.sh
```

The script:

1. Checks that Node.js 22 or newer is installed.
2. Runs `npm ci` and `npm run build`.
3. Asks whether to create a **systemd service** named `workday` that starts on boot. Answer `y` to install it. It uses `sudo` when needed.

| Task | Command |
| --- | --- |
| Run without the service prompt | `WORKDAY_SERVICE=y ./scripts/install-linux.sh` |
| Use a different port | `PORT=3000 ./scripts/install-linux.sh` |
| Check status | `sudo systemctl status workday` |
| View logs | `sudo journalctl -u workday -f` |
| Stop | `sudo systemctl stop workday` |
| Remove | `sudo systemctl disable --now workday && sudo rm /etc/systemd/system/workday.service` |

If you skip the service, start ActivTrack manually with `npm start`. Then open `http://localhost:8080` and sign up. **The first account becomes the admin.** Data is saved in `data/workday.json` inside the project folder.

---

## 3. Windows install

Open **PowerShell** in the project folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

The script:

1. Checks that Node.js 22 or newer is installed.
2. Runs `npm ci` and `npm run build`.
3. Asks whether to register a **scheduled task** named `Workday` that starts at boot.
   - If you answer yes, the task is registered and started right away. Registering it requires PowerShell to be run **as Administrator**.
   - If you answer no, the server starts once in a minimized window.

| Task | Command |
| --- | --- |
| Use a different port | `-Port 3000` |
| Register without the prompt | `-Service` |
| Skip without the prompt | `-NoService` |
| Remove the startup task | `Unregister-ScheduledTask -TaskName Workday` |

Then open `http://localhost:8080` and sign up. **The first account becomes the admin.**

---

## 4. Docker

```bash
docker build -t workday .
docker run -d --name workday -p 8080:8080 -v workday-data:/app/data --restart unless-stopped workday
```

### docker compose

```bash
docker compose up -d --build    # start (also rebuilds after updates)
docker compose logs -f          # logs
docker compose down             # stop (your data stays in the workday-data volume)
```

The image is built in two stages. First, `node:22-alpine` builds the app. Then a slim `node:22-alpine` image runs the ActivTrack server as the unprivileged `node` user. All data lives in the `/app/data` volume, so it is kept when you rebuild or update the container. A health check calls `/api/health`.

---

## 5. Server settings

`server/server.mjs` is a small Node.js server. It serves `dist/`, sends unknown paths to `index.html`, compresses responses with gzip, and answers the `/api` requests for data and sign-in. Its only extra package is `ldapts`, for LDAP.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Port to listen on |
| `HOST` | `0.0.0.0` | Address to bind to. Use `127.0.0.1` to allow only this computer. |
| `DATA_DIR` | `<project>/data` | Folder for `workday.json`, which holds all projects, tasks, accounts and settings |
| `GEMINI_API_KEY` (or `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) | empty | Turns on the AI assistant. See `server/ai.mjs`. Without a key, the assistant uses built-in commands. |
| `COOKIE_SECURE` | `0` | Set to `1` when you serve ActivTrack over HTTPS, so sign-in cookies are only sent securely. This is also turned on automatically behind a proxy that sends `X-Forwarded-Proto: https`. |

---

## 6. Accounts, roles and project access

- **First sign-up = admin.** Whoever creates the first account becomes the admin. Everyone after that gets a basic account.
- **My space.** Every account gets a private project that only its owner can see. Admins cannot see it either. The owner can add, edit and delete anything in it.
- **Shared projects.** Only admins can create them. A shared project is invisible to everyone else until an admin adds them, either with **People** on the project page or with **Settings → Users → project access**. Each person gets one of these levels:

| Level | Can do |
| --- | --- |
| Read only | View tasks, checklists, comments and history |
| Read & write | Also add and edit tasks, checklists and comments |
| Read, write & delete own | Also delete tasks **they created** |
| Admin | Full control of every shared project, every task and every user |

- Nobody except an admin can delete another person's task. People can edit their own comments, and they or an admin can delete them.
- **Settings → Users** (admins only) lets you make someone an admin, or disable an account. A disabled account is signed out and locked out immediately, and its tasks stay in place. ActivTrack never lets you remove the last active admin.
- These rules are enforced by the server (by row-level security on the website, and by `server/rules.mjs` on an install), not only hidden in the screens.

---

## 7. Sign-in methods and LDAP (installs only)

Open **Settings → Sign-in** as an admin. You can turn each of these on or off:

- **ActivTrack passwords**: email and password, stored as salted `scrypt` hashes.
- **Open sign-up**: anyone who can reach the server can create a basic account.
- **Company directory (LDAP)**: sign in with a directory username and password. The account is created automatically the first time someone signs in.

**Fallback when LDAP is down:** admins can always sign in with an ActivTrack password, even when ActivTrack passwords are turned off for everyone else. The sign-in page shows a "Sign in with an ActivTrack password" link for this. If no account exists yet, sign-up is always available so the first admin can be created.

| LDAP field | Example | Notes |
| --- | --- | --- |
| Server address | `ldaps://dc1.example.com:636` | `ldap://` or `ldaps://`. The server must be able to reach it over the network. |
| StartTLS / self-signed | | Upgrade a plain `ldap://` connection, or accept an internal certificate authority |
| Service account | `cn=workday,ou=services,dc=example,dc=com` | Used to look people up. Leave empty for anonymous lookups. |
| Search base | `dc=example,dc=com` | |
| User filter | `(sAMAccountName={{username}})` | `{{username}}` is replaced with the escaped username. The default matches `uid`, `sAMAccountName` or `mail`. |
| Name / email attribute | `displayName` / `mail` | |
| Admin groups | `workday-admins` | One per line, as a group name (CN) or full DN |

**Roles come from the directory.** When admin groups are set, they are checked at every sign-in. Members of those groups become ActivTrack admins, and everyone else gets a basic account. Leave the list empty to manage roles in ActivTrack instead. Use **Test with a user** to check the connection, the person's details and the role they would get before you save.

Failed sign-ins are rate-limited per address and account. Sessions last 30 days and are stored as hashed tokens. Disabling a user ends their sessions.

---

## 8. Backups and export

- **Installs:** back up the data folder (`data/` or the `workday-data` Docker volume). To restore, stop ActivTrack, put `workday.json` back, and start it again.
- **Website:** data is kept in the online database.
- **Settings → Data → Export tasks to CSV** downloads a spreadsheet of every task you can see.

---

## Regenerating icons

Run `npm run icons` to recreate the PWA icons in `public/` from the "W" mark. The script uses only Node.js.
