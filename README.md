# Workday

Workday is a simple project and task management app. It has board, list and calendar views, plus comments, history and a home dashboard. People sign in, and each person gets a private space. Admins create shared projects and decide who can see them. You can install it as an app (PWA).

Where data lives depends on how you run it:

| Run it as | Data is stored | Sign-in methods |
| --- | --- | --- |
| Published website (Bolt) | Online database (Supabase) | Email and password |
| Linux, Windows or Docker install | `data/workday.json` on the server | Workday passwords and/or LDAP (company directory) |

The app decides at start-up. If the Workday server answers on `/api/health`, it uses server storage. Otherwise it uses the online database.

- **Stack:** React 18, TypeScript, Vite, Tailwind CSS, React Router, lucide-react, date-fns, dnd-kit and vite-plugin-pwa.
- **Requirements:** Node.js 22 or newer (only for building and self-hosting).

```bash
npm ci          # install packages
npm run dev     # start the development server
npm run build   # type-check and build the static site into dist/
npm start       # run the Workday server (app + data + sign-in) on http://localhost:8080
```

---

## 1. Publish with Bolt (public URL and custom domain)

1. Open the project in Bolt and click **Publish** (top right).
2. Bolt builds the app and gives you a public `*.bolt.host` address. Deep links such as `/projects/abc` keep working after a refresh, because `public/_redirects` sends every path to `index.html`.
3. **Custom domain** (the site must be published first):
   1. Click the **gear icon** at the top, then **All project settings** → **Domains & Hosting** → **Connect a domain you own**. Enter your domain and click **Verify and add domain**.
   2. For a subdomain such as `tasks.example.com`, first add the **TXT record** Bolt shows you at your domain registrar to prove ownership, then click **Verify and add subdomain**.
   3. At your registrar, add the DNS records from Bolt's DNS configuration page. Use a `CNAME` to `site-dns.bolt.host` for `www` or a subdomain, and an `ALIAS`/`ANAME`/flattened CNAME to `site-dns.bolt.host` for the root domain.
   4. Wait for DNS to update. This is usually a few minutes but can take longer. Bolt then issues HTTPS automatically.
   Full guide: https://support.bolt.new/bolt-cloud/domains/connect
4. The published site stores data in the online database that comes with the project. The first person to sign up becomes the admin.
5. To publish changes later, click **Publish** again. People who already have Workday open will see a **"New version available – Reload"** banner.

The `dist/` folder also works on **Netlify, Cloudflare Pages or any static host**. Upload the folder, and `_redirects` handles deep links. A static host uses the online database, so it needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set when you build.

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

If you skip the service, start Workday manually with `npm start`. Then open `http://localhost:8080` and sign up. **The first account becomes the admin.** Data is saved in `data/workday.json` inside the project folder.

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

The image is built in two stages. First, `node:22-alpine` builds the app. Then a slim `node:22-alpine` image runs the Workday server as the unprivileged `node` user. All data lives in the `/app/data` volume, so it is kept when you rebuild or update the container. A health check calls `/api/health`.

---

## 5. Server settings

`server/server.mjs` is a small Node.js server. It serves `dist/`, sends unknown paths to `index.html`, compresses responses with gzip, and answers the `/api` requests for data and sign-in. Its only extra package is `ldapts`, for LDAP.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Port to listen on |
| `HOST` | `0.0.0.0` | Address to bind to. Use `127.0.0.1` to allow only this computer. |
| `DATA_DIR` | `<project>/data` | Folder for `workday.json`, which holds all projects, tasks, accounts and settings |
| `COOKIE_SECURE` | `0` | Set to `1` when you serve Workday over HTTPS, so sign-in cookies are only sent securely. This is also turned on automatically behind a proxy that sends `X-Forwarded-Proto: https`. |

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
- **Settings → Users** (admins only) lets you make someone an admin, or disable an account. A disabled account is signed out and locked out immediately, and its tasks stay in place. Workday never lets you remove the last active admin.
- These rules are enforced by the server (by row-level security on the website, and by `server/rules.mjs` on an install), not only hidden in the screens.

---

## 7. Sign-in methods and LDAP (installs only)

Open **Settings → Sign-in** as an admin. You can turn each of these on or off:

- **Workday passwords**: email and password, stored as salted `scrypt` hashes.
- **Open sign-up**: anyone who can reach the server can create a basic account.
- **Company directory (LDAP)**: sign in with a directory username and password. The account is created automatically the first time someone signs in.

**Fallback when LDAP is down:** admins can always sign in with a Workday password, even when Workday passwords are turned off for everyone else. The sign-in page shows a "Sign in with a Workday password" link for this. If no account exists yet, sign-up is always available so the first admin can be created.

| LDAP field | Example | Notes |
| --- | --- | --- |
| Server address | `ldaps://dc1.example.com:636` | `ldap://` or `ldaps://`. The server must be able to reach it over the network. |
| StartTLS / self-signed | | Upgrade a plain `ldap://` connection, or accept an internal certificate authority |
| Service account | `cn=workday,ou=services,dc=example,dc=com` | Used to look people up. Leave empty for anonymous lookups. |
| Search base | `dc=example,dc=com` | |
| User filter | `(sAMAccountName={{username}})` | `{{username}}` is replaced with the escaped username. The default matches `uid`, `sAMAccountName` or `mail`. |
| Name / email attribute | `displayName` / `mail` | |
| Admin groups | `workday-admins` | One per line, as a group name (CN) or full DN |

**Roles come from the directory.** When admin groups are set, they are checked at every sign-in. Members of those groups become Workday admins, and everyone else gets a basic account. Leave the list empty to manage roles in Workday instead. Use **Test with a user** to check the connection, the person's details and the role they would get before you save.

Failed sign-ins are rate-limited per address and account. Sessions last 30 days and are stored as hashed tokens. Disabling a user ends their sessions.

---

## 8. Backups and export

- **Installs:** back up the data folder (`data/` or the `workday-data` Docker volume). To restore, stop Workday, put `workday.json` back, and start it again.
- **Website:** data is kept in the online database.
- **Settings → Data → Export tasks to CSV** downloads a spreadsheet of every task you can see.

---

## Regenerating icons

Run `npm run icons` to recreate the PWA icons in `public/` from the "W" mark. The script uses only Node.js.
