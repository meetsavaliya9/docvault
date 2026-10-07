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
Copy `.env.example` to `.env` and set `DATABASE_URL` to your MySQL connection
string. Put your username, password, host, port, and database name in the URL:

```env
DATABASE_URL="mysql://USERNAME:PASSWORD@HOST:3306/docvault"
```

For example, replace `USERNAME`, `PASSWORD`, `HOST`, `3306`, and `docvault` with
your own MySQL connection details. URL-encode special characters in the username
or password (for example, `@` becomes `%40`). Never commit `.env`.

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

## Email OTP authentication

Sign-up and sign-in require a six-digit email OTP after the password step.
Configure a trusted SMTP provider in `.env.local` using the variables shown in
`.env.example`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`SMTP_PASSWORD`, and `SMTP_FROM`. Set `OTP_SECRET` to a random secret of at
least 32 characters. Keep SMTP credentials and `OTP_SECRET` server-side; never
use `NEXT_PUBLIC_` prefixes for them.

After updating `.env.local`, stop and restart Next.js. Apply the OTP database
migration with:

```bash
npx prisma migrate dev --name add_email_otp
npx prisma generate
```

Codes expire after 10 minutes and have at most five verification attempts. OTP
delivery requires valid SMTP settings in every environment; development mode
does not return verification codes to the browser or log them to the server.

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
