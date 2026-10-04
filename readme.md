# Extraction Workbench

A human review tool for LLM-extracted support-ticket records.

Customers send support requests as unstructured text such as emails, reply chains, chat messages, and call transcripts. The system performs a first-pass extraction into a structured record, validates the result, and gives a human reviewer a place to inspect and correct anything that is wrong or uncertain.

The important part of this project is not only extraction. It is what happens when extraction is invalid, uncertain, incomplete, or ambiguous, and how that information is communicated to the reviewer.

## Contents

1. [What This Project Does](#1-what-this-project-does)  
2. [Requirements](#2-requirements)  
3. [Technology Stack](#3-technology-stack)  
4. [Project Structure](#4-project-structure)  
5. [How to Run the Project](#5-how-to-run-the-project)  
6. [Running Both Services](#6-running-both-services)  
7. [API Documentation](#7-api-documentation)  
8. [Backend API Endpoints](#8-backend-api-endpoints)  
9. [API Workflow](#9-api-workflow)  
10. [Testing the API with Postman](#10-testing-the-api-with-postman)  
11. [Main Application Workflow](#11-main-application-workflow)  
12. [Extraction and Validation](#12-extraction-and-validation)  
13. [Retry Handling](#13-retry-handling)  
14. [Uncertain Extraction](#14-uncertain-extraction)  
15. [Human Review](#15-human-review)  
16. [Handling Ambiguous and Incomplete Tickets](#16-handling-ambiguous-and-incomplete-tickets)  
17. [Handling Difficult Extraction Cases](#17-handling-difficult-extraction-cases)  
18. [Background Jobs and Concurrency](#18-background-jobs-and-concurrency)  
19. [Mock Extraction Provider](#19-mock-extraction-provider)  
20. [Configuration](#20-configuration)  
21. [Running the Backend Tests](#21-running-the-backend-tests)  
22. [Important Test Scenarios](#22-important-test-scenarios)  
23. [Ports](#23-ports)  
24. [Troubleshooting](#24-troubleshooting)  
25. [Data Persistence](#25-data-persistence)  
26. [Design Decisions](#26-design-decisions)  
27. [Security and Secrets](#27-security-and-secrets)  
28. [Summary](#28-summary)

---

---

## 1. What This Project Does

The application provides:

- A Python/FastAPI backend
- A Next.js App Router frontend using TypeScript and React
- A mock extraction provider that works without an API key
- Pydantic validation for extracted records
- Background extraction jobs
- Concurrent ticket processing with a configurable limit
- One retry when model output fails validation
- `needs_review` handling when validation fails twice
- Per-field uncertainty information
- Human inline editing
- Human-edited field tracking
- Automatic job progress updates
- Partial results while a job is still running
- CSV export of reviewed records
- Backend tests for extraction, validation, retry handling, job processing, and API behavior

No database is required. Job and review state is stored in memory for the lifetime of the backend process.

---

## 2. Requirements

The project assumes you have:

- Python installed
- Node.js and npm installed
- Git installed

The project does **not** require:

- PostgreSQL
- MySQL
- Redis
- Docker
- An external LLM API
- An API key

The application can be run entirely with the included mock provider.

---

## 3. Technology Stack

### Backend

- Python
- FastAPI
- Pydantic
- Uvicorn
- pytest

### Frontend

- Next.js
- React
- TypeScript
- npm

### Communication

The frontend and backend run as two separate processes and communicate over HTTP.

---

## 4. Project Structure

```text
extraction-workbench/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── schemas.py
│   │   ├── tickets.py
│   │   ├── provider.py
│   │   ├── extraction.py
│   │   ├── job_manager.py
│   │   └── providers/
│   │       ├── __init__.py
│   │       └── mock_provider.py
│   │
│   ├── tests/
│   │   ├── test_api.py
│   │   ├── test_extraction.py
│   │   ├── test_job_manager.py
│   │   ├── test_loader.py
│   │   ├── test_provider.py
│   │   └── test_schema.py
│   │
│   ├── pytest.ini
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── jobs/
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.module.css
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── EditableField/
│   │   ├── ManualRecordForm/
│   │   ├── ReviewRecord/
│   │   └── TicketList/
│   │
│   ├── lib/
│   │   ├── api.ts
│   │   ├── format.ts
│   │   └── types.ts
│   │
│   ├── public/
│   ├── .gitignore
│   ├── eslint.config.mjs
│   ├── next-env.d.ts
│   ├── next.config.ts
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   └── tsconfig.json
│
├── data/
│   └── tickets.jsonl
│
├── .env
├── .env.example
├── .gitignore
├── DECISIONS.md
└── README.md
```

> **Note:** `.next/` and `node_modules/` are generated directories and should not be committed to Git. They are intentionally omitted from the source structure above even though they may appear in VS Code.

### Frontend Responsibilities

| Path | Responsibility |
|---|---|
| `app/page.tsx` | Main ticket selection and extraction page |
| `app/jobs/[id]/page.tsx` | Job progress and review-results page |
| `components/TicketList/` | Ticket listing and selection UI |
| `components/ReviewRecord/` | Displays extracted data and review state |
| `components/EditableField/` | Inline editing of extracted fields |
| `components/ManualRecordForm/` | Manual record entry/editing UI |
| `lib/api.ts` | Frontend API requests |
| `lib/format.ts` | Formatting helpers |
| `lib/types.ts` | Shared TypeScript types |

---

## 5. How to Run the Project

The application consists of two separate services:

- **Backend:** Python + FastAPI — `http://localhost:8000`
- **Frontend:** Next.js + React — `http://localhost:3000`

Run the backend and frontend in **two separate terminals**.

### 5.1 Prerequisites

Install the following:

- Python 3
- Node.js and npm
- Git

No database, Redis, Docker, external LLM API, or API key is required for the default setup because the project includes a mock extraction provider.

### 5.2 Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd extraction-workbench
```

### 5.3 Windows

#### Terminal 1 — Backend (Command Prompt)

Open **Command Prompt** in the project directory:

```cmd
cd extraction-workbench\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend:

`http://localhost:8000`

Keep this terminal running.

#### Terminal 1 — Backend (PowerShell)

```powershell
cd extraction-workbench\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

> **PowerShell note:** If the activation script is blocked by your execution policy, use Command Prompt or adjust the PowerShell execution policy for your local machine.

#### Terminal 2 — Frontend

Open a **second Command Prompt or PowerShell**:

```cmd
cd extraction-workbench\frontend
npm install
npm run dev
```

Frontend:

`http://localhost:3000`

Open `http://localhost:3000` in your browser.

### 5.4 macOS

#### Terminal 1 — Backend

Open Terminal in the project directory:

```bash
cd extraction-workbench/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend:

`http://localhost:8000`

Keep this terminal running.

#### Terminal 2 — Frontend

Open a **second Terminal**:

```bash
cd extraction-workbench/frontend
npm install
npm run dev
```

Frontend:

`http://localhost:3000`

Open `http://localhost:3000` in your browser.

### 5.5 Linux

#### Terminal 1 — Backend

Open a terminal in the project directory:

```bash
cd extraction-workbench/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend:

`http://localhost:8000`

Keep this terminal running.

#### Terminal 2 — Frontend

Open a **second terminal**:

```bash
cd extraction-workbench/frontend
npm install
npm run dev
```

Frontend:

`http://localhost:3000`

Open `http://localhost:3000` in your browser.

### 5.6 Quick Reference

| Task | Windows | macOS / Linux |
|---|---|---|
| Create virtual environment | `python -m venv .venv` | `python3 -m venv .venv` |
| Activate environment | `.venv\\Scripts\\activate` | `source .venv/bin/activate` |
| Install backend dependencies | `pip install -r requirements.txt` | `pip install -r requirements.txt` |
| Start backend | `uvicorn app.main:app --reload --port 8000` | `uvicorn app.main:app --reload --port 8000` |
| Install frontend dependencies | `npm install` | `npm install` |
| Start frontend | `npm run dev` | `npm run dev` |

### 5.7 Service URLs

| Service | Port | URL |
|---|---:|---|
| Backend | `8000` | `http://localhost:8000` |
| FastAPI Documentation | `8000` | `http://localhost:8000/docs` |
| Frontend | `3000` | `http://localhost:3000` |

---

## 6. Running Both Services

After setup, keep two terminals open.

### Terminal 1 — Backend

**Windows (Command Prompt):**

```cmd
cd extraction-workbench\backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**macOS / Linux:**

```bash
cd extraction-workbench/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Backend: `http://localhost:8000`

### Terminal 2 — Frontend

**All platforms:**

```bash
cd extraction-workbench/frontend
npm run dev
```

Frontend: `http://localhost:3000`

---

## 7. API Documentation

FastAPI provides interactive API documentation.

With the backend running, open:

`http://localhost:8000/docs`

This allows the API endpoints to be viewed and tested directly from the browser.

---

## 8. Backend API Endpoints

The backend runs on:

`http://localhost:8000`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Checks whether the backend is running. |
| `GET` | `/api/tickets` | Returns the available support tickets from the dataset. |
| `POST` | `/api/jobs` | Starts a new extraction job for selected ticket IDs. |
| `GET` | `/api/jobs/{job_id}` | Returns the current job state, progress, and per-ticket status. |
| `GET` | `/api/jobs/{job_id}/results` | Returns the extraction results for a job. |
| `PATCH` | `/api/records/{record_id}` | Updates an extracted record after human review and validates the updated values. |
| `GET` | `/api/jobs/{job_id}/export.csv` | Exports the reviewed records for a job as CSV. |

---

## 9. API Workflow

The normal API workflow is:

```text
GET /api/tickets
        |
        v
POST /api/jobs
        |
        v
GET /api/jobs/{job_id}
        |
        v
GET /api/jobs/{job_id}/results
        |
        v
PATCH /api/records/{record_id}
        |
        v
GET /api/jobs/{job_id}/export.csv
```

The frontend performs this workflow automatically.

---

## 10. Testing the API with Postman

The API can also be tested independently using Postman.

Make sure the backend is running first:

`http://localhost:8000`

### 10.1 Health Check

```http
GET http://localhost:8000/api/health
```

This checks whether the backend is available.

### 10.2 Get Tickets

```http
GET http://localhost:8000/api/tickets
```

This returns the support tickets loaded from:

`data/tickets.jsonl`

### 10.3 Start an Extraction Job

```http
POST http://localhost:8000/api/jobs
Content-Type: application/json
```

Example request body:

```json
{
  "ticket_ids": [
    "tkt_0001",
    "tkt_0002",
    "tkt_0003"
  ]
}
```

The response contains the created `job_id`. Save it for the next requests.

### 10.4 Check Job Progress

```http
GET http://localhost:8000/api/jobs/{job_id}
```

Replace `{job_id}` with the ID returned when the job was created.

The response contains:

- Job state
- Progress counts
- Per-ticket processing status

### 10.5 Get Job Results

```http
GET http://localhost:8000/api/jobs/{job_id}/results
```

This returns the extraction results available for the job.

Results can become available while other tickets in the same batch are still processing.

### 10.6 Update a Record

```http
PATCH http://localhost:8000/api/records/{record_id}
```

Replace `{record_id}` with the record ID from the job results.

The updated record is validated using the same Pydantic schema used for extraction. Human-edited fields are tracked so the reviewer can distinguish model-generated values from values changed during review.

### 10.7 Export Reviewed Records

```http
GET http://localhost:8000/api/jobs/{job_id}/export.csv
```

This exports the reviewed records for the job as a CSV file.

The frontend also provides an **Export CSV** action on the job page.

---

## 11. Main Application Workflow

The normal reviewer workflow is:

1. Open `http://localhost:3000`.
2. View the available support tickets.
3. Search or filter tickets.
4. Select the tickets to process.
5. Click **Start extraction**.
6. The application creates a background extraction job.
7. The job processes tickets concurrently.
8. The frontend automatically updates job progress.
9. Results become available while the job is running.
10. Tickets requiring human attention are shown as **Needs review**.
11. The reviewer compares the original ticket with the extracted record.
12. The reviewer can edit fields inline.
13. Human-edited fields are tracked.
14. Reviewed records can be exported as CSV.

---

## 12. Extraction and Validation

Every extracted record is validated against the application's Pydantic schema.

The structured record contains:

- `company`
- `product`
- `category`
- `severity`
- `requested_action`
- `refund_amount`
- `deadline`
- `escalated`

The schema restricts fields such as `product`, `category`, `severity`, and `requested_action` to their supported enum values.

This prevents invalid model output from silently becoming application data.

---

## 13. Retry Handling

Model output can be incorrect or malformed. The extraction pipeline handles this explicitly.

When model output fails Pydantic validation:

1. The validation error is captured.
2. The validation error is provided to the provider.
3. The model/provider gets one retry.

If the second attempt also fails validation:

1. The ticket is marked `needs_review`.
2. The raw model output is preserved.
3. The validation error is preserved.
4. The ticket does not cause the entire job to fail.
5. The remaining tickets continue processing.

This means a single bad extraction does not bring down the whole batch.

---

## 14. Uncertain Extraction

A valid Pydantic record does not necessarily mean that every extracted value is correct.

The mock provider therefore tracks uncertainty at the field level.

For example, if there is not enough evidence to determine severity, the provider can use a schema-safe value while also marking `severity` as an uncertain field.

The reviewer can then inspect the original ticket and correct the value if necessary.

This separates:

- **Valid according to schema**
- **Well supported by the ticket**

---

## 15. Human Review

The job results page shows the original ticket alongside the extracted record.

A reviewer can:

- Inspect the source ticket
- See extracted values
- See uncertain fields
- See review reasons
- Correct extracted values
- Save corrections
- See which fields were edited by a human
- Filter results by review state
- Export reviewed records

Records requiring attention are surfaced separately from normal completed records.

---

## 16. Handling Ambiguous and Incomplete Tickets

Some tickets do not contain enough information for reliable extraction.

For example, tickets containing only messages such as:

```text
please advise
```

or:

```text
?
```

do not provide enough context to safely infer a complete structured record.

These cases are handled as `needs_review` instead of silently guessing all fields.

The reviewer can then make the appropriate decision.

---

## 17. Handling Difficult Extraction Cases

The project includes explicit handling for difficult cases in the dataset.

### Missing Severity

Severity is inferred only when the ticket provides supporting evidence. When there is not enough evidence, the system uses a schema-safe fallback while marking the field as uncertain so that the reviewer can verify it.

### EUR Refund Amount

The schema expects refund amounts in USD.

If a ticket contains an amount in EUR, the system does not silently convert it to USD because an exchange rate is not provided by the ticket. The amount is surfaced to the reviewer with a warning/review reason.

### Multiple Issues

Some tickets contain multiple distinct problems while the schema allows only one category.

The system does not pretend that a single category represents every issue. Instead, the ticket is surfaced for human review while retaining the extracted information that is still useful.

### Churn or Renewal Threat

A ticket containing a renewal threat is surfaced to the reviewer so that the business impact is visible rather than silently ignored.

More details about these decisions are documented in [`DECISIONS.md`](DECISIONS.md).

---

## 18. Background Jobs and Concurrency

Extraction is performed through background jobs rather than blocking the HTTP request until every ticket is finished.

The job tracks per-ticket states such as:

- `queued`
- `running`
- `done`
- `needs_review`
- `failed`

The backend processes multiple tickets concurrently while respecting the configured concurrency limit.

The frontend polls the job endpoint and updates the UI automatically.

This allows the reviewer to see partial results before the complete batch has finished.

---

## 19. Mock Extraction Provider

The project includes a mock provider so that the entire application can be run without an external LLM API.

The mock provider:

- Uses deterministic extraction rules
- Produces plausible structured records
- Adds a small processing delay
- Uses the same provider interface as the extraction service
- Produces deliberately invalid output for selected tickets
- Allows the retry path to be exercised
- Allows the `needs_review` path to be exercised

This makes the project reproducible without requiring an API key.

---

## 20. Configuration

The application configuration is defined in:

`backend/app/config.py`

The repository also contains:

`.env.example`

The mock provider is designed to work without an API key.

If real provider/API configuration is introduced later, secrets should be provided through environment variables rather than committed to source control.

> **Security:** Never commit real API keys or other secrets.

---

## 21. Running the Backend Tests

The backend tests use pytest.

From the project root:

```bash
cd backend
source .venv/bin/activate
pytest
```

The test suite covers areas including:

- Pydantic schema validation
- Ticket loading
- Provider behavior
- Extraction validation
- Retry handling
- Double validation failure
- Background job processing
- API behavior
- Job completion behavior

---

## 22. Important Test Scenarios

The project specifically tests the failure cases that are important to the extraction workflow.

### Invalid Model Output

A malformed model response is passed through the validation layer and the retry behavior is verified.

### Failure After Retry

If the second validation attempt also fails, the ticket becomes:

`needs_review`

The job still completes instead of failing because of one ticket.

### Job Completion Progress

The job completion test verifies progress behavior when the final item finishes.

---

## 23. Ports

| Service | Port | URL |
|---|---:|---|
| Backend | `8000` | `http://localhost:8000` |
| FastAPI documentation | `8000` | `http://localhost:8000/docs` |
| Frontend | `3000` | `http://localhost:3000` |

---

## 24. Troubleshooting

### Backend Does Not Start

Make sure the virtual environment is activated and dependencies are installed:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Does Not Start

Make sure frontend dependencies have been installed:

```bash
cd frontend
npm install
npm run dev
```

### Frontend Cannot Communicate with Backend

Make sure both processes are running:

```text
Backend  -> http://localhost:8000
Frontend -> http://localhost:3000
```

Also make sure the backend was started before testing extraction from the frontend.

---

## 25. Data Persistence

The application does not use a database.

Tickets are loaded from:

`data/tickets.jsonl`

Job and review state is stored in memory.

Therefore, restarting the backend clears the in-memory job and review state.

The original ticket dataset remains available because it is stored in the repository.

---

## 26. Design Decisions

The reasoning behind the main product and extraction decisions is documented in [`DECISIONS.md`](DECISIONS.md).

The document covers:

- Missing severity
- French/EUR refund handling
- Multiple issues and category limitations
- Insufficient ticket content
- Progress polling versus streaming
- Frontend testing considerations

---

## 27. Security and Secrets

No API key is required to run the default application.

Do not commit:

- API keys
- Passwords
- Access tokens
- Private credentials
- Local `.env` files containing secrets

The repository includes `.env.example` for configuration reference.

The Python virtual environment is also local to each development machine and should not be committed.

---

## 28. Summary

Extraction Workbench demonstrates an end-to-end workflow for reviewing LLM-style structured extraction from unstructured support tickets.

The key focus is not only producing a structured record, but also making extraction failures and uncertainty visible to a human reviewer.

The system therefore combines:

- Structured validation
- Retry handling
- Explicit `needs_review` states
- Field-level uncertainty
- Human corrections
- Human-edited field tracking
- Background processing
- Concurrent extraction
- Live progress updates
- Partial results
- CSV export

The application can be run locally without an external LLM API or database.


