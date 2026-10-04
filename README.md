# Contract Assistant

Contract Assistant is an AI-powered contract information-management application. It helps users upload contracts, extract structured information using an LLM, review the extracted information, verify supporting quotes, manage versions, and generate summaries.

> This application is an information-management and review tool. It is not intended to provide legal advice.

## Live Deployment

* Frontend: https://contract-assistant-theta.vercel.app/
* Backend API: https://contract-assistant-api-yydn.onrender.com
* Repository: https://github.com/sonu-maddy/contract-assistant

## Problem

**Problem 1 — Contract Obligation and Renewal Assistant**

The application focuses on extracting contract obligations and other important contract information while keeping a human in the review loop.

## Core Workflow

1. Upload a PDF, DOCX, or TXT contract.
2. Extract and normalize document text.
3. Send the contract text to the configured LLM for structured extraction.
4. Validate the LLM response against a schema.
5. Verify extracted quotes against the source contract text.
6. Present extracted items for human review.
7. Allow users to approve, reject, or edit extracted information.
8. Store review changes and contract versions.
9. Generate a contract summary.
10. Track extracted contract dates and reminders where supported.

## Features

* PDF, DOCX, and TXT ingestion
* AI/LLM-based structured contract extraction
* Schema validation for extracted data
* Quote/source verification
* Human review and approval workflow
* Approve, reject, and edit actions
* Review audit records
* Contract version history
* Contract summaries
* Dashboard and contract details
* Loading, empty, success, validation, and failure states
* Structured server-side logging
* MongoDB persistence
* Production deployment

## Architecture

```text
React + Vite Frontend
        |
        | HTTPS / REST API
        v
Node.js + Express Backend
        |
        +---- Document Ingestion
        |
        +---- LLM Extraction
        |
        +---- Schema Validation
        |
        +---- Quote Verification
        |
        +---- Human Review
        |
        +---- Summary / Reminders / Versioning
        |
        v
MongoDB Atlas
```

### Frontend

* React
* Vite
* REST API client
* Pages for upload, dashboard, review, contract details, deadlines, versions, and summary

### Backend

* Node.js
* Express
* Mongoose
* Pino logging
* AJV validation
* pdf-parse
* mammoth
* date-fns
* Gemini via `@google/genai`

### Database

MongoDB Atlas stores:

* Contracts
* Contract versions
* Extracted items
* Item edits/review history
* LLM call metadata

## Project Structure

```text
contract-assistant/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── api.js
│   │   └── App.jsx
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── index.js
│   │   └── logger.js
│   ├── tests/
│   ├── extraction_prompt.md
│   ├── extraction_schema.json
│   └── package.json
│
├── README.md
├── AGENT_USAGE.md
└── .env.example
```

## Local Setup

### Backend

```bash
cd server
npm install
npm start
```

Development mode:

```bash
npm run dev
```

Backend runs on the configured `PORT`, defaulting to `5000` locally.

### Frontend

```bash
cd client
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Environment Variables

Create `server/.env` locally using `.env.example` as a reference.

Required configuration names:

```text
MONGODB_URI=
GEMINI_API_KEY=
LLM_MODEL=
DEMO_EXTRACTION=false
PORT=
NODE_ENV=
```

For the Vite frontend:

```text
VITE_API_BASE_URL=
```

Never commit actual API keys, database credentials, passwords, or other secrets.

## AI / LLM Workflow

The extraction service sends normalized contract text to the configured Gemini model and requests structured contract items.

The workflow includes:

* structured extraction
* schema validation
* retry/error handling
* extraction metadata
* source quote capture
* quote verification
* human review before important extracted information is treated as approved

The application does not automatically treat unreviewed LLM output as approved business information.

## Human Review

Extracted items can be:

* Approved
* Rejected
* Edited

Edits are persisted as review/audit information so that the application maintains a record of human changes.

## Logging

The backend uses structured Pino logging for important application events, including:

* MongoDB connection
* server startup
* extraction processing
* service failures
* API/application errors

## Testing

The backend uses Vitest.

Run:

```bash
cd server
npm test
```

Focused tests cover areas including:

* ingestion
* LLM extraction behaviour
* quote verification
* reminders
* summaries
* versioning
* review behaviour
* database/model behaviour

Some tests remain incomplete or environment-dependent, particularly tests that require live LLM credentials, external database connectivity, or mocks that need further refinement. The deployed core workflow was manually verified through the hosted application.

## Completed Scope

* Contract upload
* PDF/DOCX/TXT ingestion
* MongoDB persistence
* LLM extraction
* Structured extraction schema
* Quote verification
* Human review workflow
* Approve/reject/edit actions
* Contract versioning
* Summary
* Dashboard
* Production frontend
* Production backend
* Production CORS configuration
* Deployment environment configuration

## Excluded / Known Limitations

### Deadline and reminder calculation

The deadline/reminder calculation is not fully reliable for all possible contract date expressions and extraction scenarios.

The rest of the core contract workflow is deployed and functional. Deadline calculation was intentionally left as a follow-up improvement rather than delaying the core submission.

### Legal interpretation

The application does not provide legal advice or determine the legal meaning or enforceability of contract clauses.

### Authentication

The current assessment version does not include a complete user authentication and authorization system.

## Deployment

### Frontend

The React/Vite frontend is deployed on Vercel.

Root directory:

```text
client
```

Build command:

```text
npm run build
```

Output directory:

```text
dist
```

### Backend

The Node/Express backend is deployed on Render.

Root directory:

```text
server
```

Build command:

```text
npm install
```

Start command:

```text
npm start
```

MongoDB Atlas is used for persistent storage.

## Verification

The deployed application was manually tested through the production frontend, including:

* Loading the contracts workspace
* Uploading a long-form PDF contract
* AI extraction
* Reviewing extracted information
* Approving/editing/rejecting items
* Viewing contract information
* Viewing version history
* Generating/viewing summary information

The production frontend and backend were also verified after resolving the production CORS configuration.

## Sample Input

A long-form contract PDF can be used to exercise the extraction and review workflow. Reviewers should upload a contract containing parties, dates, obligations, payment terms, renewal terms, notice periods, termination clauses, and other structured information.

## Submission Notes

The primary goal of this submission is a usable end-to-end contract information workflow with AI-assisted extraction and human review.

The deadline calculation limitation is documented above and can be addressed as a subsequent iteration.
