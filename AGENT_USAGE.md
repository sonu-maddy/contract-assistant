# Agent Usage

## Purpose

AI assistance was used throughout the implementation of Contract Assistant for code generation, debugging, architecture decisions, testing guidance, deployment troubleshooting, and documentation.

The AI was used as a development assistant rather than as an autonomous decision-maker. Important application behaviour, especially LLM extraction and review behaviour, was manually tested before deployment.

## Tools Used

* ChatGPT for implementation assistance, debugging, code review, test analysis, and deployment guidance
* Gemini through the application for contract information extraction
* Git and GitHub for source control
* MongoDB Atlas for persistence
* Render for backend hosting
* Vercel for frontend hosting
* Vitest for backend tests

## Representative Prompts

Examples of development tasks delegated to the AI assistant included:

### Backend architecture

> Build a Node.js and Express backend for a contract information-management application using MongoDB and Mongoose.

### Document ingestion

> Implement ingestion for PDF, DOCX, and TXT files. Normalize extracted text and generate a SHA-256 hash for the extracted content.

### LLM extraction

> Implement structured contract extraction using Gemini, validate the response against a schema, capture metadata, and handle retries and provider errors.

### Human review

> Implement approve, reject, and edit workflows for extracted contract items and preserve an audit record of human changes.

### Versioning

> Implement contract version creation while preserving previous versions and identifying changed/stale extracted items.

### Frontend

> Build React/Vite pages for upload, review, dashboard, contract details, deadlines, versions, and summary.

### Deployment

> Prepare the React frontend and Node/Express backend for separate production deployment and configure the frontend API URL and CORS.

## Delegated Work

AI assistance was used to help with:

* Project structure
* Express routes
* Mongoose models
* Document ingestion
* Gemini extraction service
* Extraction schema
* Quote verification
* Reminder/date parsing
* Versioning logic
* Review workflow
* React pages and API integration
* Error/loading/empty states
* Vitest test cases
* Production deployment configuration
* CORS troubleshooting
* README and submission documentation

## Important Agent Mistakes / Rejected Suggestions

### Deadline extraction

The initial implementation and later reminder parsing improvements did not reliably produce deadline/reminder results for every contract scenario. The problem was traced to the extraction pipeline in cases where only an obligation item was persisted instead of the expected expiry/renewal/notice items.

Rather than blocking the complete submission, deadline calculation was intentionally documented as a known limitation.

### Demo extraction

A demo extraction path existed during development. For the production deployment, the configuration was set to:

```text
DEMO_EXTRACTION=false
```

so that the deployed application uses the actual LLM extraction workflow.

### Production CORS

The first deployed backend did not expose the required CORS header to the Vercel frontend. Browser console errors identified the issue:

```text
No 'Access-Control-Allow-Origin' header is present
```

The backend was updated to allow the production Vercel origin and the Render service was redeployed. The production frontend was then re-tested.

### Environment configuration

The application was checked so that API/database/LLM secrets remain deployment environment variables rather than source-controlled values.

## Verification Process

Verification was performed at several levels.

### Build verification

The Vite production build completed successfully:

```text
vite build
52 modules transformed
built successfully
```

### Backend verification

The backend successfully connected to MongoDB Atlas and started on the configured port.

### Production verification

The deployed application was tested through the Vercel frontend against the Render backend.

The following workflow was manually verified:

```text
Upload contract
      ↓
Document ingestion
      ↓
LLM extraction
      ↓
Review extracted items
      ↓
Approve / Reject / Edit
      ↓
Summary
      ↓
Version history
```

A long-form test contract containing parties, dates, obligations, payment terms, notice periods, renewal and termination information was used during verification.

## Human-in-the-Loop

AI-generated contract information is presented for human review before approval.

Reviewers can:

* inspect extracted information
* inspect source quotes
* approve items
* reject items
* edit extracted values

This prevents the LLM output from being treated as automatically approved information.

## Current Limitation

Deadline/reminder calculation is not fully reliable for all date-expression and extraction scenarios.

This limitation was intentionally accepted for the assessment submission so that the core upload → extraction → review → persistence → versioning workflow could be deployed and demonstrated.

## Final Deployment

Frontend:

https://contract-assistant-theta.vercel.app/

Backend:

https://contract-assistant-api-yydn.onrender.com

Repository:

https://github.com/sonu-maddy/contract-assistant
