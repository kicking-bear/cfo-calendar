# District CFO Calendar

A shared year-at-a-glance calendar for district CFO activities.

- **Anyone with the link can view.** Editing needs a group code: CWS, Binhi, Kadiwa and Buklod each get their own.
- **Status:** each activity is Draft, Submitted or Approved. Anyone with a code can change it.
- **Leading & taking part:** mark the one group running the activity (or none), plus every group taking part. Four groups show as "with all CFO".
- **When:** either a specific date (with optional end date and times), or **month only** (shows as TBD) when the date isn't picked yet. Month-only activities can span several months (e.g. Feb – Mar).
- Built with shadcn/ui (`web/components.json` is set up, so `npx shadcn add <component>` works).
- Every change records which group made it. The page refreshes every minute and whenever you come back to the tab.

Same setup as the tournament tracker: a static site on **GitHub Pages** and an API on a **Cloudflare Worker** with a **D1** database. Both are free.

```
cfo-calendar/
├─ web/       React + Vite + Tailwind frontend  → GitHub Pages
├─ worker/    Cloudflare Worker API             → Cloudflare
└─ .github/workflows/deploy.yml                 → builds web/ on every push to main
```

---

## Setup (about 15 minutes)

Do these in order. Commands are for PowerShell on Windows.

### 1. Create the database

1. In the Cloudflare dashboard, go to **Storage & Databases → D1 → Create database**.
2. Name it `cfo-calendar` and create it.
3. Copy the **Database ID** shown on the database page.
4. Open the database's **Console** tab and run each line of `worker/schema.sql` one at a time (each statement is a single line, no comments).

### 2. Deploy the Worker

1. Open `worker/wrangler.toml` and paste the Database ID into `database_id`.
2. In a terminal:

   ```powershell
   cd worker
   npm install
   npx wrangler login
   npx wrangler deploy
   ```

3. Wrangler prints the Worker address, e.g. `https://cfo-calendar.<your-subdomain>.workers.dev`. Keep it handy.

### 3. Set the four group codes

Pick a code for each group (something short but not guessable, e.g. `kadiwa-ridge-42`). Then either:

- **Dashboard:** Workers & Pages → `cfo-calendar` → Settings → Variables and Secrets → add **Secret** `CODE_CWS`, `CODE_BINHI`, `CODE_KADIWA`, `CODE_BUKLOD`, or
- **Terminal** (from the `worker` folder):

  ```powershell
  npx wrangler secret put CODE_CWS
  npx wrangler secret put CODE_BINHI
  npx wrangler secret put CODE_KADIWA
  npx wrangler secret put CODE_BUKLOD
  ```

Check it works (replace the address and code):

```powershell
Invoke-RestMethod https://cfo-calendar.<your-subdomain>.workers.dev/api/me -Headers @{ "X-Edit-Code" = "your-kadiwa-code" }
```

It should answer `group : kadiwa`.

To change a code later, set the secret again. Anyone using the old code will be asked for the new one the next time they save.

### 4. Publish the site on GitHub Pages

1. Create a new GitHub repo (e.g. `cfo-calendar`) and push this whole folder to `main`.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables tab → New repository variable**
   - Name: `VITE_API_URL`
   - Value: your Worker address from step 2 (no trailing slash)
4. Go to **Actions → Deploy to GitHub Pages → Run workflow** (or just push a commit).
5. The site appears at `https://<your-username>.github.io/cfo-calendar/`.

### 5. Lock the Worker to your site (recommended)

In `worker/wrangler.toml`, change `ALLOWED_ORIGIN = "*"` to your Pages address, e.g. `"https://kicking-bear.github.io"`, then run `npx wrangler deploy` again.

### 6. Share it

Send the Pages link to the district CFO chat, and send each group its own code privately. On a phone, "Add to Home Screen" makes it open like an app.

---

## Working on it locally

```powershell
# API with a local database
cd worker
npx wrangler d1 execute cfo-calendar --local --file=schema.sql
# create worker/.dev.vars with lines like:  CODE_KADIWA=test
npx wrangler dev

# Frontend (second terminal)
cd web
npm install
"VITE_API_URL=http://localhost:8787" | Out-File -Encoding utf8 .env.local
npm run dev
```

If `VITE_API_URL` is empty the site runs in **demo mode**: sample data, saved only in that browser, and the codes are just `cws`, `binhi`, `kadiwa`, `buklod`.

## API

| Method | Path | Needs code | Notes |
| --- | --- | --- | --- |
| GET | `/api/activities?year=2027` | no | Everything that touches that year |
| GET | `/api/me` | yes | Returns which group the code belongs to |
| POST | `/api/activities` | yes | Create |
| PATCH | `/api/activities/:id` | yes | Update (any fields) |
| DELETE | `/api/activities/:id` | yes | Delete |

The code goes in an `X-Edit-Code` header.

## Backing up the data

D1 → `cfo-calendar` → Console:

```sql
SELECT * FROM activities ORDER BY month, start_date;
```

Or export everything with `npx wrangler d1 export cfo-calendar --remote --output backup.sql`.
