import csv
import io
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.job_manager import JobManager
from app.schemas import ExtractionRecord
from app.tickets import load_tickets


app = FastAPI(title="Extraction Workbench")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TICKETS_PATH = PROJECT_ROOT / "data" / "tickets.jsonl"

tickets = load_tickets(TICKETS_PATH)
tickets_by_id = {ticket["id"]: ticket for ticket in tickets}

job_manager = JobManager(
    max_concurrency=settings.max_concurrency
)


class CreateJobRequest(BaseModel):
    ticket_ids: list[str]

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/tickets")
def get_tickets():
    return tickets

@app.post("/api/jobs", status_code=202)
async def create_job(
    request: CreateJobRequest,
    background_tasks: BackgroundTasks,
):
    for ticket_id in request.ticket_ids:
        if ticket_id not in tickets_by_id:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown ticket ID: {ticket_id}",
            )

    job = job_manager.create_job(request.ticket_ids)

    background_tasks.add_task(
        job_manager.process_job,
        job.id,
        tickets_by_id,
    )

    return {
        "job_id": job.id,
        "state": job.state,
    }


@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    job = job_manager.get_job(job_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found",
        )

    return {
        "job_id": job.id,
        "state": job.state,
        "progress": job_manager.get_progress(job.id),
        "items": [
            {
                "ticket_id": item.ticket_id,
                "status": item.status,
            }
            for item in job.items
        ],
    }


@app.get("/api/jobs/{job_id}/results")
def get_job_results(job_id: str):
    job = job_manager.get_job(job_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found",
        )

    return [
        {
            "record_id": item.record_id,
            "ticket_id": item.ticket_id,
            "status": item.status,
            "result": item.result,
        }
        for item in job.items
        if item.result is not None
    ]


@app.patch("/api/records/{record_id}")
def update_record(record_id: str, updates: dict):
    allowed_fields = set(ExtractionRecord.model_fields.keys())

    unknown_fields = set(updates.keys()) - allowed_fields

    if unknown_fields:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown fields: {sorted(unknown_fields)}",
        )

    for job in job_manager.jobs.values():
        for item in job.items:
            if item.record_id == record_id:
                if item.result is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Record result not available",
                    )

                current_record = item.result.get("record")

                if current_record is None:
                    raw_output = item.result.get("raw_output") or {}
                    current_record = raw_output.get("record")

                if current_record is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Record result not available",
                    )

                updated_record = {
                    **current_record,
                    **updates,
                }

                try:
                    validated_record = ExtractionRecord.model_validate(
                        updated_record
                    )
                except ValidationError as error:
                    raise HTTPException(
                        status_code=422,
                        detail=error.errors(),
                    )

                item.result["record"] = validated_record.model_dump(
                    mode="json"
                )

                item.status = "done"

                human_edited_fields = item.result.setdefault(
                    "human_edited_fields",
                    [],
                )

                for field in updates:
                    if field not in human_edited_fields:
                        human_edited_fields.append(field)

                return {
                    "record_id": item.record_id,
                    "ticket_id": item.ticket_id,
                    "status": item.status,
                    "record": item.result["record"],
                    "human_edited_fields": human_edited_fields,
                }

    raise HTTPException(
        status_code=404,
        detail="Record not found",
    )


@app.get("/api/jobs/{job_id}/export.csv")
def export_job_csv(job_id: str):
    job = job_manager.get_job(job_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found",
        )

    output = io.StringIO()

    fieldnames = [
        "record_id",
        "ticket_id",
        "company",
        "product",
        "category",
        "severity",
        "requested_action",
        "refund_amount",
        "deadline",
        "escalated",
        "human_edited_fields",
    ]

    writer = csv.DictWriter(
        output,
        fieldnames=fieldnames,
    )

    writer.writeheader()

    for item in job.items:
        if item.result is None:
            continue

        record = item.result.get("record")

        if record is None:
            continue

        writer.writerow(
            {
                "record_id": item.record_id,
                "ticket_id": item.ticket_id,
                **record,
                "human_edited_fields": ",".join(
                    item.result.get(
                        "human_edited_fields",
                        [],
                    )
                ),
            }
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="job-{job_id}.csv"'
            )
        },
    )