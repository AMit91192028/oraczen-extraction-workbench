# Extraction Workbench

A human review tool for LLM-extracted support-ticket records.

Customers send support requests as unstructured text such as emails, reply chains, chat messages, and call transcripts. The system performs a first-pass extraction into a structured record, validates the result, and gives a human reviewer a place to inspect and correct anything that is wrong or uncertain.

The important part of this project is not only extraction. It is what happens when extraction is invalid, uncertain, incomplete, or ambiguous, and how that information is communicated to the reviewer.

---

## 1. What this project does

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
- Backend tests for the required extraction and job behavior

No database is required. Job and review state is stored in memory for the lifetime of the backend process.

---

# 2. Requirements

The reviewer is assumed to have:

- Python installed
- Node.js installed

Git is also required to clone the repository.

The project does **not** require:

- PostgreSQL
- MySQL
- Redis
- Docker
- An external LLM API
- An API key

The application can be run entirely with the included mock provider.

---

# 3. Technology stack

## Backend

- Python
- FastAPI
- Pydantic
- Uvicorn
- pytest

## Frontend

- Next.js
- React
- TypeScript
- npm

## Communication

The frontend and backend run as two separate processes and communicate over HTTP.

---

# 4. Project structure

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
│   │   ├── page.tsx
│   │   └── jobs/
│   │       └── [id]/
│   │           └── page.tsx
│   │
│   ├── components/
│   │   ├── EditableField/
│   │   ├── ReviewRecord/
│   │   └── TicketList/
│   │
│   └── lib/
│       ├── api.ts
│       └── types.ts
│
├── data/
│   └── tickets.jsonl
│
├── .env.example
├── DECISIONS.md
└── README.md
```


# 3. How to run the project after cloning

After cloning the repository, start the backend and frontend separately.

## Start the backend

Open a terminal in the project root:

```bash
cd extraction-workbench/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
## Start the frontend
Open a new terminal in the project root:
```bash 
cd extraction-workbench/frontend
npm install
npm run dev
http://localhost:3000

Keep this terminal running.
```

# Backend API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Checks whether the backend is running. |
| `GET` | `/api/tickets` | Returns the available support tickets from the dataset. |
| `POST` | `/api/jobs` | Starts a new extraction job for the selected ticket IDs. |
| `GET` | `/api/jobs/{job_id}` | Returns the current job state, progress, and per-ticket status. |
| `GET` | `/api/jobs/{job_id}/results` | Returns the extraction results for the job. |
| `PATCH` | `/api/records/{record_id}` | Updates an extracted record after human review and validates the updated values. |
| `GET` | `/api/jobs/{job_id}/export.csv` | Exports the reviewed records for the job as a CSV file. |