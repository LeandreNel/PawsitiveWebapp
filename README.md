# Pawsitive

**Finding furry friends their forever homes, one wagging tail at a time.**

Pawsitive is a shelter management and public adoption site for the Pawsitive Animal Shelter in Laezonia AH. Visitors can meet the animals waiting for a home, book a site visit, and donate. Shelter staff get a cosy back office for animal records, calendar events, team notices, and donation reports.

Everything lives in a real database, and every staff action is checked by the API. No browser-side role switches here, just proper permissions.

---

## Live Sites

Pawsitive's front end is deployed in two places:

| Host | Platform | Link |
| --- | --- | --- |
| Microsoft Azure | Azure Static Web Apps | [https://orange-flower-07d52f21e.2.azurestaticapps.net](https://orange-flower-07d52f21e.2.azurestaticapps.net/) |
| Google Cloud | Firebase Hosting | [https://project-d970a4c5-3b03-4517-b3b.web.app](https://project-d970a4c5-3b03-4517-b3b.web.app/) |

The API and database run on Azure (Express service and Azure SQL Database), and both front ends talk to it.

---

## Built With

Pawsitive was put together with these tools:

| Part of the app | What we used |
| --- | --- |
| Front end | React 19 and Vite 7 |
| Back end | Node.js (20.19+ or 22.12+) and Express 5 |
| Database | Azure SQL Database (or SQL Server 2017+) through the `mssql` driver |
| Passwords and sessions | Node's built-in `crypto` module (scrypt hashing, SHA-256 hashed session tokens, HTTP-only cookies) |
| Payments | PayFast hosted checkout with signed requests and validated ITN notifications |
| Analytics and hosting | Firebase (Analytics and Firebase Hosting) |
| Alternative hosting | Azure Static Web Apps, deployed with GitHub Actions |
| Containers | Docker (`node:22-alpine`) for the API |
| Dev tooling | npm workspaces, `concurrently`, `dotenv`, and `cors` |
| Typography | GROBOLD for headings, system sans-serif everywhere else |

---

## What You Can Do

### Visitors
- Browse available animals and read their profiles
- Create an account and sign in securely
- Update your name, email, password, and profile picture
- Delete your account (after confirming your password)
- Book a site visit from dates and times published by staff
- Donate through PayFast
- Send an adoption enquiry by email with your chosen animal already included

### Shelter Staff
- Add, edit, remove, and mark animals as adopted
- Attach or replace animal photos
- Publish calendar availability for site visits
- Schedule medical, supply, and general events
- Share team notices
- View donation summaries and history, and export a CSV report of confirmed payments
- See upcoming site visit bookings

Photos can be JPEG, PNG, or WebP up to 2 MB. The browser shrinks them to fit the 512 KB database limit before upload.

---

## Getting Started

### What you need
- Node.js 20.19+ or 22.12+
- An Azure SQL Database (the free offer works) or SQL Server 2017+

### Setup

1. **Create a database** named `pawsitive`. In Azure, go to SQL databases, then Create, and choose the free offer. In the server's Networking settings, allow Azure services to access the server, and add your own client IP if you run the API locally.

2. **Configure the server.** Copy `server/.env.example` to `server/.env` and fill in your real database details. To create the first staff account, set:
   - `INITIAL_STAFF_NAME`
   - `INITIAL_STAFF_EMAIL`
   - `INITIAL_STAFF_PASSWORD` (at least 12 characters, and it is hashed before it is stored)

   On startup, the configured email is given the staff role and its password is set to the configured one, even if that email was already registered as a public account. Restart the API after changing these values.

3. **Install dependencies** from the repository root:
   ```bash
   npm install
   ```

4. **Start everything:**
   ```bash
   npm run dev
   ```
   The API runs at `http://localhost:3001` and the site at `http://localhost:5173`.

5. **Say hello.** Create a public account with **Create a new account**, or sign in with your staff credentials. Public sign-up can never grant staff access.

On first launch the API creates all the tables it needs. If the animal table is empty, it also welcomes four starter residents: Baxter, Bruno, Snuggy, and Milo. Existing animal records are never overwritten.

---

## Environment Variables

All of these live in `server/.env`.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (defaults to 3001) |
| `CORS_ORIGIN` | Comma-separated list of frontend origins allowed to call the API |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Database connection details |
| `DB_TRUST_SERVER_CERTIFICATE` | Set to `true` only for a local SQL Server with a self-signed certificate |
| `INITIAL_STAFF_NAME`, `INITIAL_STAFF_EMAIL`, `INITIAL_STAFF_PASSWORD` | First staff account |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` | PayFast credentials |
| `PAYFAST_SANDBOX` | `true` while testing, `false` for live payments |
| `PUBLIC_SITE_URL` | Public address of the frontend |
| `PUBLIC_API_URL` | Public address of the API, if hosted separately |

The client only needs `VITE_API_URL` (in `client/.env`), and only when the API lives on a different address from the site.

Never put database or PayFast credentials in the client environment or in source code. Use your hosting provider's secret storage in production, and always use HTTPS.

---

## Taking Donations

Donations use PayFast hosted checkout. The notification (ITN) URL must be publicly reachable over HTTPS, so localhost alone cannot receive callbacks from PayFast. Test with sandbox credentials first, then switch to live ones when you are ready.

Donations are recorded as pending, then marked complete only after the API validates PayFast's signed notification. Reports and totals count confirmed payments only.

---

## API at a Glance

| Endpoint | What it does |
| --- | --- |
| `GET /api/health` | Checks the API and database |
| `GET /api/animals` | Lists available animals to everyone, and all animals to staff |
| `/api/auth/*` | Sign-up, sign-in, session check, sign-out, profile updates, and account deletion |
| `/api/site-visits/*` | Public availability, plus booking and cancelling your own visits (staff can see upcoming bookings) |
| `/api/animals`, `/api/events`, `/api/availability`, `/api/notices`, `/api/donations` | Staff-only management endpoints |
| `POST /api/donations/checkout` | Creates a pending donation and returns a signed PayFast form |
| `POST /api/payments/payfast/notify` | Validates PayFast notifications before completing a payment |

---

## Project Layout

```
pawsitive/
  client/            React + Vite front end
    public/fonts/    Custom heading font
    src/             App code, API helper, Firebase setup
  server/            Express API
    src/db.js        Database connection, tables, and starter data
    src/shelter.js   Auth, animals, events, visits, notices, donations, payments
    src/index.js     Server entry point
    Dockerfile       Container image for the API
  .github/workflows/ Deployment pipelines
  firebase.json      Firebase Hosting configuration
```

---

## Building and Deploying

Build the front end into `client/dist`:

```bash
npm run build
```

Start the API:

```bash
npm start
```

**Front end.** Deploy to Firebase Hosting with:

```bash
firebase deploy --project pawsitiveWebapp
```

The front end can also be deployed to Azure Static Web Apps through the included GitHub Actions workflow.

**API.** The included Dockerfile builds a small production image of the Express service. In production:
- Route `/api` to the Express service, or set `VITE_API_URL` before building the client
- Set `CORS_ORIGIN` to the frontend origins that are allowed to call the API
- Provide database and PayFast credentials as server secrets
- Use a publicly reachable HTTPS address for PayFast notifications

The front end alone cannot sign anyone in. Sign-in and every other API-backed feature need the Express API to be deployed too.

---

Made with care for every wet nose and warm lap waiting to be adopted.
