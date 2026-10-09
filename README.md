This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## MySQL and Prisma setup

DocVault uses Prisma ORM with MySQL for accounts, sessions, documents, folders,
and trash. This project already contains the Prisma schema and client setup.
Copy `.env.example` to `.env.local` and set `DATABASE_URL` to your MySQL connection
string. Put your username, password, host, port, and database name in the URL:

```env
DATABASE_URL="mysql://USERNAME:PASSWORD@HOST:3306/docvault"
```

For example, replace `USERNAME`, `PASSWORD`, `HOST`, `3306`, and `docvault` with
your own MySQL connection details. URL-encode special characters in the username
or password (for example, `@` becomes `%40`). Never commit `.env.local`.

Create the database once in MySQL:

```sql
CREATE DATABASE docvault CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then, from the project root, run:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

`npx prisma init --datasource-provider mysql` is the Prisma initialization
command for a new project; it has already been completed here, so do not rerun
it over the existing schema. The migration creates `User`, `Session`,
`Document`, `Folder`, and `TrashItem` tables. `Document` stores the requested
metadata (`id`, `name`, `type`, `size`, `createdAt`) plus folder, starred, and
file content fields. File content is stored in MySQL `LONGTEXT`.

Prisma only runs in server-side API routes and server components. The MySQL
connection URL is never sent to the browser. To inspect stored rows, run
`npx prisma studio`, or connect to MySQL and run:

```sql
SELECT id, name, type, size, createdAt FROM Document;
```

## Administrator account setup

Admin accounts sign in through the existing login flow; they do not need to use
public signup. An account must first exist in the database and either have the
`ADMIN` role or have its email included in the comma-separated `ADMIN_EMAILS`
allowlist. To bootstrap an initial allowlisted admin account, set `ADMIN_EMAIL`
to an allowlisted email and `ADMIN_PASSWORD` to a unique password of at least
12 characters in `.env.local`, then run:

```bash
npm run admin:bootstrap
```

The bootstrap command creates the account only if it does not already exist and
never changes an existing account or password. It uses the configured
`DATABASE_URL`; to create the account for production, run it against the
production database using Railway's public connection URL. Keep all credentials
out of source control, and remove the temporary `ADMIN_PASSWORD` value after
bootstrapping.

## Roles and manager access

DocVault stores `ADMIN`, `MANAGER`, or `USER` on each account. All roles use
the shared `/login` page; Admins land at `/admin`, the configured Manager lands
at `/manager`, and Users land at `/dashboard`. Set `MANAGER_EMAIL` in the
environment and run `npm run manager:bootstrap` against the intended database
to prepare the single configured Manager. If the account does not exist, also
set `MANAGER_PASSWORD` to a unique password of at least 12 characters; it is
used only when creating the account. If the matching account already exists,
its password and existing Manager permissions are preserved.
The command is safe to rerun and refuses to modify an Admin account.

Role labels on Admin Panel → Users are read-only and that page lists regular
`USER` accounts. The dedicated `/admin/managers` page shows the configured
account, its activation status, and its permissions. An Admin controls the
account status and configures its permissions there. Manager permissions are
disabled by default for a newly created or converted account. The Admin
permission editor exposes only the Manager-safe dashboard and operational
read permissions: `VIEW_DASHBOARD`, `VIEW_DASHBOARD_STATS`,
`VIEW_RECENT_DOCUMENTS`, `VIEW_STORAGE_USAGE`, `VIEW_USERS`, and
`VIEW_USER_FILES`, `VIEW_PAYMENTS`, `VIEW_SUBSCRIPTIONS`, and `VIEW_REPORTS`.
Dashboard summary permissions can be adjusted independently after dashboard
access is granted. User-directory, file, billing, and reports access are
separately permission-controlled.

The configured, database-role-verified Manager can view all regular `USER`
accounts, including blocked accounts, when `VIEW_USERS` is enabled. The user
directory reports account status and registration date. Subscription details
are shown only when `VIEW_SUBSCRIPTIONS` is also enabled.
`VIEW_USER_FILES` controls access to stored files belonging to regular `USER`
accounts, including preview and download through a Manager-only media endpoint.
Admins, Managers, and deleted documents are excluded. The legacy Admin
assignment records are retained, but do not limit or expand this Manager scope.
Manager pages and `/api/manager/*` endpoints validate the authenticated Manager
role and permissions on the server.

| Page or feature | Admin | Manager | User | Manager authorization |
| --- | --- | --- | --- | --- |
| Admin dashboard, user administration, manager assignments and permissions | Yes | No | No | Admin-only |
| Manager dashboard and summary reports | Yes | Optional | No | `VIEW_DASHBOARD`; user, file, payment, and subscription sections require their matching data permission; combined summary/revenue/activity also require `VIEW_DASHBOARD_STATS` and `VIEW_REPORTS` |
| User directory and account details | Yes | Optional | No | `VIEW_USERS`; normal `USER` accounts; plan details additionally require `VIEW_SUBSCRIPTIONS` |
| Normal users' file list, preview and download | Yes | Optional | No | `VIEW_USER_FILES`; stored documents only; no mutations |
| Payment and subscription history | Yes | Optional | Own records only | `VIEW_PAYMENTS` and `VIEW_SUBSCRIPTIONS`; Manager access is read-only |
| Manager's own profile | Yes | Yes | No | Authenticated Manager session |
| User dashboard, documents, folders, trash, subscription and profile | No (separate workspace) | No | Yes | User session, existing permissions and ownership checks |
| Plans, payments, subscription changes and billing operations | Yes | No | Own subscription only | Admin-only management; Users may access only their own subscription/payment records |
| Admin settings, role/permission administration, secrets and system configuration | Yes | No | No | Admin-only |

Manager access is **off by default** for a newly created or converted account.
Manager APIs are read-only `GET` endpoints for normal User records, stored
file metadata and authorized media, and recorded payment/subscription data.
Admin APIs, billing mutations, User-owned document APIs, and system
configuration are not granted to Managers.
The Manager dashboard reads `/api/manager/dashboard`, applies UTC date filters
to its real database aggregates, and refreshes when the user returns to the
page or selects Refresh. Activity entries are derived from authorized recent
user, file, payment, and subscription records; the schema has no separate
audit-event log.
The repository audit identified 26 page routes (with 13 layouts), 36 API route
files, and 48 exported HTTP-method handlers. The shared permission catalog
continues to serve Admin-managed User permissions; Manager grants use a
separate allowlist enforced by the server so legacy or manually stored
permissions outside the Manager-safe read capabilities have no effect.

Configure `MANAGER_EMAIL` (and `MANAGER_PASSWORD` for first-time account
creation) in local `.env.local` and in the production environment, then run
`npm run manager:bootstrap` with the target database's `DATABASE_URL` in a
trusted setup environment. Do not expose `MANAGER_PASSWORD` to the browser or
commit it to source control.

Admin and User panels retain their existing functionality. Cross-panel
requests do not render another role's panel, and Admin APIs remain Admin-only.

## Email OTP authentication

Public sign-up and `USER` sign-in require a six-digit email OTP. `ADMIN` and
the configured database-role-verified `MANAGER` sign in directly after their
password is verified. The server-side mail utility sends signup, resend, and
User login OTP messages using Nodemailer. In local development, Next.js reads the SMTP settings from
`.env.local`; in production, add the same variables in Vercel under
**Project Settings → Environment Variables**, enabled for **Production**:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASSWORD=your-16-character-google-app-password
SMTP_FROM=DocVault <your-gmail-address@gmail.com>
```

For Gmail, create an App Password after enabling 2-Step Verification. Do not
use your regular Gmail password. Port `465` uses implicit TLS; port `587` uses
STARTTLS. SMTP credentials, `DATABASE_URL`, and `OTP_SECRET` are server-only;
never use `NEXT_PUBLIC_` prefixes. Set `OTP_SECRET` to a random secret of at
least 32 characters.

The npm `dev`, `build`, and `start` scripts enable Node.js system CA trust so
SMTP TLS works on machines whose trusted certificate authority is installed in
the operating system (for example, managed Windows networks). The setting is
passed as an environment variable to Next.js and its build workers, while TLS
certificate verification remains enabled. Node.js 22.15 or later is required.

After updating `.env.local`, stop and restart Next.js. Apply the OTP database
migration with:

```bash
npx prisma migrate dev --name add_email_otp
npx prisma generate
```

Codes expire after 10 minutes and have at most five verification attempts. OTP
delivery is required for sign-up and User login; Admin and Manager login do not
generate or send OTPs. Development mode does not return verification codes to
the browser or log them to the server. To test locally, run `npm run dev` and
use the signup form or sign in with a User account and an inbox you can access;
confirm the OTP arrives, then enter it to complete verification. Also test
resend from the OTP screen. Admin and Manager should go directly to their
respective panels after password verification. On Vercel, save the Production
variables and redeploy, then repeat the checks on the live website. Vercel
environment variable changes only apply to new deployments.

## Private Cloudinary media storage

Uploaded files are stored as authenticated Cloudinary assets under a
user-specific `docvault/<user-id>` folder. MySQL stores the media reference and
document metadata. File downloads and image previews are proxied through an
authenticated DocVault API route; Cloudinary credentials and direct media URLs
stay on the server.

Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
`CLOUDINARY_API_SECRET` to `.env.local` using the values from your Cloudinary
console. Do not use `NEXT_PUBLIC_` prefixes or commit these values. After
updating the Prisma schema, apply the `add_cloudinary_media` migration and
regenerate Prisma Client:

```bash
npx prisma migrate dev --name add_cloudinary_media
npx prisma generate
```

New uploads are limited to 15 MB. Deleting a document permanently also asks
Cloudinary to remove its asset; moving a document to Trash retains the asset so
it can be restored.

## Subscription plans and Razorpay Test Mode

DocVault offers Free, Plus, and Pro plans. Their names, prices, billing periods,
features, availability, and document/storage limits are stored in MySQL. Admins
can manage these values at `/admin/pricing`; users see active plans at
`/dashboard/subscription`. Razorpay order amounts and upload quotas are read
server-side from the database. A repeatable seed creates the initial Free
(₹0/month, 10 documents and 100 MB), Plus (₹199/month, 100 documents and 5 GB),
and Pro (₹499/month, unlimited documents and 25 GB) defaults without overwriting
admin changes. Plan limits and active subscription dates are checked server-side.
Payment orders are priced on the server and paid access is granted only after
Razorpay signature and captured-payment checks. Paid access follows the plan's
configured billing period and does not automatically renew; users can renew
from Dashboard → Subscription.

Copy the Razorpay values from `.env.example` into `.env.local`, using **Test
Mode** credentials from the Razorpay Dashboard. Keep `RAZORPAY_KEY_SECRET` and
`RAZORPAY_WEBHOOK_SECRET` server-side, never prefix them with `NEXT_PUBLIC_`,
and never commit `.env.local`. Configure a Razorpay webhook for
`https://<your-domain>/api/payment/webhook` using the same webhook secret, and
subscribe to the `payment.captured`, `payment.failed`, and `refund.processed`
events. A processed full refund ends the linked paid subscription; partial
refunds are recorded but do not end access. Refund processing is idempotent by
Razorpay refund ID.

Apply the Prisma migrations and seed the initial plans:

```bash
npx prisma migrate dev
npx prisma generate
npm run db:seed
```

The initial plan seed is safe to rerun and does not reset existing plan edits.
The authenticated plan endpoint is `GET /api/subscription/plans`. Admin pricing
is managed through `GET /api/admin/pricing` and
`PATCH /api/admin/pricing/[id]`; all admin routes use DocVault's existing admin
session authorization. The legacy admin read-only pricing panel links to the
management page.

Test Plus and Pro checkouts using Razorpay's documented Test Mode payment
details. Successful transactions appear in the Razorpay Dashboard under
Transactions/Payments while Test Mode is enabled. Existing Razorpay recurring
subscription records remain in MySQL, but new checkout uses one-time Razorpay
orders and monthly access periods.

Razorpay references: [Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/),
[Orders API](https://razorpay.com/docs/api/orders/create/), and
[webhook signature validation](https://razorpay.com/docs/webhooks/validate-test/).

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
