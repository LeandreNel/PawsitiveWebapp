# Pawsitive: a web application

> Finding furry friends their forever homes, one wagging tail at a time.

**Type of digital solution:** Full-stack website (public adoption site and staff back office)
**Author:** [Your Name & Surname]

---

## Table of Contents

<details>
<summary>Click to expand</summary>

1. [About the Project](#about-the-project)
   - [Short Description](#short-description)
   - [Built With](#built-with)
2. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [How to Install](#how-to-install)
   - [Environment Variables](#environment-variables)
3. [Project Features](#project-features)
4. [Development Process](#development-process)
5. [Final Outcome](#final-outcome)
6. [Conclusion](#conclusion)
7. [Footer](#footer)
   - [License](#license)
   - [Author](#author)
   - [Acknowledgements](#acknowledgements)

</details>

---

## About the Project

### Short Description

Pawsitive is a shelter management and public adoption website for the Pawsitive Animal Shelter in Laezonia AH. Visitors can meet the animals waiting for a home, book a site visit and make a donation. Shelter staff get a back office for managing animal records, calendar events, team notices and donation reports.

Everything is stored in a real database, and every staff action is checked by the API using server-side permissions, with no browser-side role switches. The project was built to give the shelter one place to promote adoptions, collect donations and coordinate its team.

> *Add a screenshot or mockup of the public home page here, e.g. `![Home page](./screenshots/home.png)`*

### Built With

| Part of the app | Technology |
| --- | --- |
| Front end | **React 19** and **Vite 7** |
| Back end | **Node.js** (20.19+ or 22.12+) and **Express 5** |
| Database | **Azure SQL Database** (or SQL Server 2017+) via the `mssql` driver |
| Passwords and sessions | Node's built-in `crypto` (scrypt hashing, SHA-256 hashed session tokens, HTTP-only cookies) |
| Payments | **PayFast** hosted checkout with signed requests and validated ITN notifications |
| Analytics and hosting | **Firebase** (Analytics and Hosting) |
| Alternative hosting | **Azure Static Web Apps**, deployed with **GitHub Actions** |
| Containers | **Docker** (`node:22-alpine`) for the API |
| Dev tooling | npm workspaces, `concurrently`, `dotenv`, `cors` |
| Typography | GROBOLD for headings, system sans-serif elsewhere |

---

## Getting Started

### Prerequisites

- **Node.js** 20.19+ or 22.12+: [Download here](https://nodejs.org/)
- **npm** (installed with Node.js)
- **An Azure SQL Database** ([the free offer works](https://azure.microsoft.com/products/azure-sql/database/)) or **SQL Server 2017+**
- *(Optional, for donations)* A **PayFast** merchant account: [Sign up here](https://www.payfast.co.za/). Sandbox credentials are fine for testing.
- *(Optional, for deployment)* A **Firebase** project and/or an **Azure Static Web Apps** resource

### How to Install

> **Note:** This is a single repository containing both the front end (`client/`) and the API (`server/`), managed as npm workspaces. There is no separate backend repository.

1. **Clone the repository**
   ```bash
   git clone https://github.com/<your-username>/<your-repo-name>.git
   cd <your-repo-name>
   ```

2. **Create a database** named `pawsitive`. In Azure, go to *SQL databases → Create* and choose the free offer. In the server's *Networking* settings, allow Azure services to access the server, and add your own client IP if you run the API locally.

3. **Configure the server.** Copy `server/.env.example` to `server/.env` and fill in your real database details (see [Environment Variables](#environment-variables)). To create the first staff account, set:
   - `INITIAL_STAFF_NAME`
   - `INITIAL_STAFF_EMAIL`
   - `INITIAL_STAFF_PASSWORD` (at least 12 characters, hashed before it is stored)

   On startup, the configured email is given the staff role and its password is set to the configured one, even if that email was already registered as a public account. Restart the API after changing these values.

4. **Install dependencies** from the repository root:
   ```bash
   npm install
   ```

5. **Start everything:**
   ```bash
   npm run dev
   ```
   The API runs at `http://localhost:3001` and the site at `http://localhost:5173`.

6. **Say hello.** Create a public account with **Create a new account**, or sign in with your staff credentials. Public sign-up can never grant staff access.

On first launch the API creates all the tables it needs. If the animal table is empty, it also adds four starter residents: Baxter, Bruno, Snuggy and Milo. Existing animal records are never overwritten.

### Environment Variables

All server variables live in `server/.env`.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (defaults to 3001) |
| `CORS_ORIGIN` | Comma-separated list of front-end origins allowed to call the API |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Database connection details |
| `DB_TRUST_SERVER_CERTIFICATE` | Set to `true` only for a local SQL Server with a self-signed certificate |
| `INITIAL_STAFF_NAME`, `INITIAL_STAFF_EMAIL`, `INITIAL_STAFF_PASSWORD` | First staff account |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` | PayFast credentials |
| `PAYFAST_SANDBOX` | `true` while testing, `false` for live payments |
| `PUBLIC_SITE_URL` | Public address of the front end |
| `PUBLIC_API_URL` | Public address of the API, if hosted separately |

The client only needs `VITE_API_URL` (in `client/.env`), and only when the API lives at a different address from the site.

> **Security:** Never put database or PayFast credentials in the client environment or in source code. Use your hosting provider's secret storage in production, and always use HTTPS.

### Taking Donations

Donations use PayFast hosted checkout. The notification (ITN) URL must be publicly reachable over HTTPS, so `localhost` alone cannot receive callbacks from PayFast. Test with sandbox credentials first, then switch to live ones. Donations are recorded as *Pending* and only marked *Completed* after the API validates PayFast's signed notification.

---

## Project Features

### For Visitors

- **Browse animals:** View available animals and read their profiles.
- **Accounts:** Create an account and sign in securely.
- **Profile management:** Update your name, email, password and profile picture.
- **Delete account:** Remove your account after confirming your password.
- **Book a site visit:** Choose from dates and times published by staff.
- **Donate:** Give through PayFast (General, Food or Medical categories, R10 to R100,000).
- **Adoption enquiry:** Send an email to the shelter with your chosen animal already included.

> *Add a screenshot or GIF of browsing animals and booking a visit here.*

### For Shelter Staff

- **Manage animals:** Add, edit, remove and mark animals as adopted.
- **Photos:** Attach or replace animal photos.
- **Calendar availability:** Publish dates and times when site visits can be booked.
- **Calendar events:** Schedule medical, supply and general events.
- **Team notices:** Share short messages with the rest of the team.
- **Donation reports:** View monthly totals, averages and a paginated history, and export a CSV of donations.
- **Upcoming visits:** See who has booked a site visit.

> *Add a screenshot or GIF of the staff back office here.*

### Security and Reliability

- Passwords hashed with scrypt; session tokens stored only as SHA-256 hashes
- HTTP-only, `Secure`, `SameSite` session cookies in production
- Role checks on every protected API route (public, signed-in user, staff)
- Origin checks on all state-changing requests
- Image uploads limited to JPEG, PNG and WebP, with file signatures checked on the server

### Images

Photos can be JPEG, PNG or WebP up to 2 MB. The browser shrinks them to fit the 512 KB database limit before upload.

---

## Development Process

### Architecture

Pawsitive is a three-tier application: a React single-page front end, an Express REST API and an Azure SQL database.

```
pawsitive/
├── client/                     React + Vite front end
│   ├── public/fonts/           Custom heading font
│   └── src/                    App code, API helper, Firebase setup
├── server/                     Express API
│   ├── src/db.js               Database connection, tables and starter data
│   ├── src/shelter.js          Auth, animals, events, visits, notices, donations, payments
│   ├── src/index.js            Server entry point
│   └── Dockerfile              Container image for the API
├── .github/workflows/          Deployment pipelines
└── firebase.json               Firebase Hosting configuration
```

**Hosting**

| Host | Platform | Link |
| --- | --- | --- |
| Microsoft Azure | Azure Static Web Apps | [orange-flower-07d52f21e.2.azurestaticapps.net](https://orange-flower-07d52f21e.2.azurestaticapps.net/) |
| Google Cloud | Firebase Hosting | [project-d970a4c5-3b03-4517-b3b.web.app](https://project-d970a4c5-3b03-4517-b3b.web.app/) |

The API and database run on Azure (an Express service and Azure SQL Database), and both front ends talk to it.

**Key decisions**

- **Permissions live on the server.** Every protected route runs through `optionalUser`, `requireAuthenticated` or `requireStaff` middleware, so access never depends on the browser.
- **Custom authentication.** Passwords use scrypt with a per-user salt, and sessions are random tokens stored hashed in the database, so a database leak does not expose usable session tokens.
- **Payments are never trusted from the browser.** A donation is created as *Pending*, and only marked *Completed* after the API verifies PayFast's signature, merchant ID, server-side validation response and amount.
- **Tables are created on startup.** `initializeDatabase()` creates any missing tables and seeds starter animals, so setting up a new environment only needs an empty database.
- **One API, two front ends.** CORS is configured from an allow-list so both the Azure and Firebase front ends can sign in with cookies.
- **Images stored in the database** as base64 with strict size and file-type checks, which keeps the deployment simple (no separate file storage).

### Database Design

```
users           (id, name, email*, password_hash, role[user|staff],
                 profile_image, profile_image_mime, created_at)
sessions        (token_hash, user_id → users, expires_at, created_at)
animals         (id, name, type[Dog|Cat], breed, age, description,
                 status[Available|Adopted], image_key, image_data, image_mime)
shelter_events  (id, title, event_date, event_time, kind[medical|supply|event], notes)
availability    (id, available_date*, available_time, updated_by → users)
site_visits     (id, user_id → users, visit_date*, visit_time)
team_notices    (id, user_id → users, message, created_at)
donations       (id, payment_id*, amount, donor_name, donor_email,
                 category[General|Food|Medical], payment_method,
                 status[Pending|Completed|Failed], created_at, completed_at)
tasks           (id, title, description, status[open|in_progress|done])

* = unique
```

Relationships:
- A user can have many sessions, site visits and team notices (deleting a user cascades).
- Each availability date is unique, and each visit date is unique, so a date can only be booked once.
- A site visit is booked against a date that staff have published in `availability`.

> *Consider adding an ERD image here.*

### Theme and Design

Pawsitive uses a warm, friendly tone ("cosy back office", "every wet nose and warm lap") with GROBOLD headings for personality and system sans-serif for readability.

> *Optionally add a moodboard, colour palette or wireframe summary here.*

### Challenges and Solutions

| Challenge | Solution |
| --- | --- |
| Keeping staff features secure | Enforced roles in API middleware instead of hiding buttons in the browser |
| Trusting payment status | Verified PayFast's signature and server-side validation before completing a donation |
| Sessions across two hosted front ends | Allow-listed CORS origins and `SameSite=None; Secure` cookies in production |
| Moving from MySQL to Azure SQL | Wrote a small wrapper that keeps `?` placeholders and MySQL-style results while translating queries (e.g. `SYSUTCDATETIME()`, `OFFSET ... FETCH`, `MERGE`) |
| Storing images safely | Resized images in the browser, then checked size, MIME type and file signature on the server |
| Preventing double-booked visits | Unique constraint on visit date plus an atomic insert-from-availability query |

### Testing

*Describe how you tested the app. For example: manual testing of sign-up, login and logout; staff-only routes rejected for public users; booking and cancelling a visit; sandbox PayFast donations (complete, cancelled and failed); image uploads with invalid files; and checking both hosted front ends against the live API.*

---

## Final Outcome

### Demonstration Video

*Add a link to your demonstration video here (aim for 5 to 8 minutes).*

### Deployed Links

- Azure Static Web Apps: [https://orange-flower-07d52f21e.2.azurestaticapps.net](https://orange-flower-07d52f21e.2.azurestaticapps.net/)
- Firebase Hosting: [https://project-d970a4c5-3b03-4517-b3b.web.app](https://project-d970a4c5-3b03-4517-b3b.web.app/)

> The front end alone cannot sign anyone in. Sign-in and every other API-backed feature need the Express API to be deployed as well.

### Building and Deploying

Build the front end into `client/dist`:
```bash
npm run build
```
Start the API:
```bash
npm start
```

**Front end:** deploy to Firebase Hosting with `firebase deploy --project pawsitiveWebapp`, or through the included GitHub Actions workflow for Azure Static Web Apps.

**API:** the included Dockerfile builds a small production image. In production:
- Route `/api` to the Express service, or set `VITE_API_URL` before building the client
- Set `CORS_ORIGIN` to the front-end origins that are allowed to call the API
- Provide database and PayFast credentials as server secrets
- Use a publicly reachable HTTPS address for PayFast notifications

---

## Conclusion

Building Pawsitive taught me how to design a complete full-stack system: a React front end, a secured Express API and a relational database, deployed across two cloud providers. The most valuable lessons were around security (server-side permissions, password hashing, hashed session tokens) and payments (never trusting the browser, and validating PayFast notifications before recording money as received).

**Challenges:** Securing staff-only features, handling payment confirmation reliably, and making cookie-based sessions work across multiple hosted front ends.

**Future improvements**

- Add animal types beyond dogs and cats
- Add search and filters (breed, age, type) to the animal listings
- Send email confirmations for site visits and donations
- Add multiple photos per animal using dedicated file storage
- Allow staff to edit or cancel events and notices
- Remove the unused starter `tasks` endpoints
- Add automated tests for the API routes

---

## Footer

### License

*Choose a license (e.g. MIT) and add it here. If you prefer to reserve all rights, state this explicitly:*

> Copyright © 2026 [Your Name & Surname]. All rights reserved.

### Author

**[Your Name & Surname]**
Email: [your.email@example.com]
LinkedIn: [your LinkedIn profile URL]
GitHub: [your GitHub profile URL]

*If this was a team project, list each member here.*

### Acknowledgements

- [React](https://react.dev/) and [Vite](https://vite.dev/) documentation
- [Express](https://expressjs.com/) documentation
- [Node.js `crypto`](https://nodejs.org/api/crypto.html) documentation
- [node-mssql](https://github.com/tediousjs/node-mssql) and [Azure SQL Database](https://learn.microsoft.com/azure/azure-sql/) documentation
- [PayFast developer documentation](https://developers.payfast.co.za/)
- [Firebase Hosting](https://firebase.google.com/docs/hosting) and [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/) documentation
- *Animal photos and artwork: [add credits]*
- AI assistance (Claude by Anthropic) used for documentation drafting
