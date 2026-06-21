# Authorized Partner - Signup & Login Automation

Automated registration and login flow for [Authorized Partner](https://authorized-partner.vercel.app/register) using Playwright + TypeScript.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
npx playwright install chromium
```

Make sure `C:\Users\DELL\Desktop\test.docx` exists for document upload (or change the path in `src/index.ts`).

## Usage

### Full signup + login

```bash
npm start
```

This will:

1. Create a temporary email inbox (via mail.tm)
2. Complete all 4 registration steps:
   - **Step 1** – Account Setup (personal info + OTP verification)
   - **Step 2** – Agency Details (name, role, region)
   - **Step 3** – Professional Experience (years, metrics, services)
   - **Step 4** – Verification & Preferences (business number, countries, docs)
3. Save credentials to `credentials.json`
4. Login and land on the admin dashboard

### Login only (reuse saved credentials)

```bash
npm start
```

If `credentials.json` exists, it skips signup and logs in directly.

## Project Structure

```
├── src/
│   ├── index.ts          # Main automation script
│   └── login.ts          # Standalone login script
├── credentials.json      # Saved credentials (auto-generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Notes

- OTP is auto-retrieved via mail.tm API
- Uses Playwright with visible browser (`headless: false`)
- Default password: `TestPass123!`
- Documents uploaded from `C:\Users\DELL\Desktop\test.docx`
