from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
import asyncio

from app.extraction import ExtractionService


@dataclass
class JobItem:
    ticket_id: str
    status: str = "queued"
    result: dict[str, Any] | None = None


@dataclass
class Job:
    id: str
    items: list[JobItem] = field(default_factory=list)
    state: str = "queued"
    created_at: datetime = field(
    default_factory=lambda: datetime.now(timezone.utc)
)
    
class JobManager:
    def __init__(
        self,
        extraction_service=None,
        max_concurrency: int = 5,
    ):
        self.jobs: dict[str, Job] = {}
        self.extraction_service = (
            extraction_service or ExtractionService()
        )
        self.max_concurrency = max_concurrency

    def create_job(self, ticket_ids: list[str]) -> Job:
        job_id = str(uuid4())

        job = Job(
            id=job_id,
            items=[
                JobItem(ticket_id=ticket_id)
                for ticket_id in ticket_ids
            ],
        )

        self.jobs[job_id] = job

        return job

    def get_job(self, job_id: str) -> Job | None:
        return self.jobs.get(job_id)
    def get_progress(self, job_id: str) -> dict[str, int]:
        job = self.jobs[job_id]

        progress = {
            "queued": 0,
            "running": 0,
            "done": 0,
            "failed": 0,
            "needs_review": 0,
        }

        for item in job.items:
            progress[item.status] += 1

        return progress
    async def process_job(
        self,
        job_id: str,
        tickets: dict[str, dict],
    ) -> None:
        job = self.jobs[job_id]
        job.state = "running"

        semaphore = asyncio.Semaphore(
            self.max_concurrency
        )

        tasks = [
            self._process_item(
                job,
                item,
                tickets[item.ticket_id],
                semaphore,
            )
            for item in job.items
        ]

        await asyncio.gather(*tasks)

        job.state = "done"

    async def _process_item(
        self,
        job: Job,
        item: JobItem,
        ticket: dict,
        semaphore: asyncio.Semaphore,
    ) -> None:
        async with semaphore:
            item.status = "running"

            try:
                result = await asyncio.to_thread(
                    self.extraction_service.process_ticket,
                    ticket,
                )

                item.result = result

                if result["status"] == "needs_review":
                    item.status = "needs_review"
                else:
                    item.status = "done"

            except Exception as error:
                item.status = "failed"
                item.result = {
                    "error": str(error),
                }