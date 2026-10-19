# Pawsitive

Pawsitive is a shelter management and public adoption site built with React, Vite, Express, and Azure SQL Database (SQL Server). Animal records, staff accounts, events, availability, team notices, and donation records are stored in the database. Staff actions are checked by the API; a browser-side role switch is not used for access control.

## Requirements

- Node.js 20.19+ or 22.12+
- Azure SQL Database (the free offer works) or SQL Server 2017+

## Run locally

1. Create a database named `pawsitive` (in Azure: SQL databases → Create, choose the free offer). In the server's **Networking** settings, allow Azure services to access the server, and add your own client IP if you run the API locally against it.

2. Copy `server/.env.example` to `server/.env` and set the real database credentials (the example password is only a placeholder). To provision the staff account, set `INITIAL_STAFF_NAME`, `INITIAL_STAFF_EMAIL`, and a unique `INITIAL_STAFF_PASSWORD` of at least 12 characters. The password is hashed before it is stored. Restart the API after changing these values; on startup, the configured email is assigned the staff role and its password is reset to the configured password, even if that email was previously registered as a public account.
3. Install dependencies from the repository root with `npm install`.
4. Run `npm run dev` from the repository root. This starts the API at `http://localhost:3001` and Vite at `http://localhost:5173`.
5. Create public accounts using **Create a new account**. Public registration cannot grant staff access. Staff sign in with the provisioned staff credentials.

The API creates the required tables on startup and adds the starter animal listings only when the animal table is empty. Existing animal records are not overwritten.

## Working features

- Public animal browsing and profiles; staff can add, remove, and mark animals as adopted.
- Account creation and sign-in with server-side password hashing, HTTP-only sessions, and staff-only API authorization.
- Signed-in public users can update their name, email, or password and permanently delete their account after password confirmation.
- Staff can attach or replace animal photos while editing animal profiles; staff and public users can upload or remove their own profile pictures. Selected JPEG, PNG, and WebP files up to 2 MB are optimized in the browser to fit the database's 512 KB image limit.
- Signed-in users have a separate home, adopt, donate, and calendar portal. Site visits can be booked from future dates and times published by staff in calendar availability.
- Staff calendar events, date availability, and team notices stored in the database.
- Donation summaries, history pagination, and CSV report export based on confirmed payments.
- Hosted PayFast checkout. Set `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_SANDBOX`, and `PUBLIC_SITE_URL` in the server environment. For a separately hosted API, set `PUBLIC_API_URL` as well. The PayFast ITN/notification URL must be publicly reachable over HTTPS; localhost alone cannot receive provider callbacks. Test with sandbox credentials before switching to live credentials.
- Adoption enquiries open an email addressed to the shelter with the selected animal included.

Never put database or PayFast credentials in the client environment or source code. Configure production secrets through the hosting provider. Use HTTPS in production.

## API

- `GET /api/health` checks the API and database.
- `GET /api/animals` lists available animals publicly and all animals to staff.
- `/api/auth/*` supports account creation, sign-in, session inspection, sign-out, authenticated profile updates, and password-confirmed account deletion.
- `/api/site-visits/*` lists public availability, allows users to view/book/cancel their own visits, and lets staff see upcoming bookings.
- Staff-only endpoints under `/api/animals`, `/api/events`, `/api/availability`, `/api/notices`, and `/api/donations` manage shelter data. Animal and profile photo uploads accept JPEG, PNG, and WebP images up to 512 KB after optimization.
- `POST /api/donations/checkout` creates a pending donation and returns a signed PayFast checkout form.
- `POST /api/payments/payfast/notify` validates PayFast notifications before marking payments complete.

## Build and deployment

Run `npm run build` to create the frontend in `client/dist`; run `npm start` to start the API. In production, route `/api` to the Express service (or configure `VITE_API_URL` before building), set `CORS_ORIGIN` to the comma-separated frontend origins allowed to access the API, provide database and PayFast credentials via server secrets, and use a publicly reachable HTTPS URL for PayFast notifications.
