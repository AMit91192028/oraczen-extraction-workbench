import asyncio

from app.extraction import ExtractionService
from app.job_manager import JobManager


def test_create_job():
    manager = JobManager()

    job = manager.create_job(
        ["tkt_0001", "tkt_0002"]
    )

    assert job.id
    assert job.state == "queued"
    assert len(job.items) == 2
    assert job.items[0].ticket_id == "tkt_0001"
    assert job.items[0].status == "queued"


def test_get_job():
    manager = JobManager()

    created_job = manager.create_job(
        ["tkt_0001"]
    )

    found_job = manager.get_job(created_job.id)

    assert found_job is created_job


def test_get_missing_job_returns_none():
    manager = JobManager()

    result = manager.get_job("does-not-exist")

    assert result is None

    
def test_progress_counts_items():
    manager = JobManager()

    job = manager.create_job(
        ["tkt_0001", "tkt_0002", "tkt_0003"]
    )

    job.items[0].status = "done"
    job.items[1].status = "running"
    job.items[2].status = "queued"

    progress = manager.get_progress(job.id)

    assert progress == {
        "queued": 1,
        "running": 1,
        "done": 1,
        "failed": 0,
        "needs_review": 0,
    }


def test_job_flips_to_done_after_processing():
    manager = JobManager(
        max_concurrency=2
    )

    job = manager.create_job(
        ["tkt_0001", "tkt_0002"]
    )

    tickets = {
    "tkt_0001": {
        "id": "tkt_0001",
        "subject": "Zen Studio billing issue",
        "body": (
            "Zen Studio was charged twice. "
            "Please refund $100. This is an urgent issue."
        ),
        "from_email": "customer@example.com",
    },
    "tkt_0002": {
        "id": "tkt_0002",
        "subject": "Zen Connect billing issue",
        "body": (
            "Zen Connect was charged twice. "
            "Please refund $200. This is an urgent issue."
        ),
        "from_email": "customer@example.com",
    },
}

    import asyncio

    asyncio.run(
        manager.process_job(
            job.id,
            tickets,
        )
    )

    progress = manager.get_progress(job.id)

    assert job.state == "done"
    assert progress["queued"] == 0
    assert progress["running"] == 0
    assert progress["done"] == 2
    assert progress["failed"] == 0
    assert progress["needs_review"] == 0


class FlakyProvider:
    """Always returns an invalid record for tkt_bad, a valid one otherwise."""

    def __init__(self):
        self.calls = []

    def extract(self, ticket, attempt=1, validation_error=None):
        self.calls.append(
            (ticket["id"], attempt, validation_error)
        )

        severity = "urgent" if ticket["id"] == "tkt_bad" else "high"

        return {
            "record": {
                "company": "Acme",
                "product": "Zen Studio",
                "category": "bug",
                "severity": severity,
                "requested_action": "fix",
                "refund_amount": None,
                "deadline": None,
                "escalated": False,
            },
            "uncertain_fields": [],
        }


def test_item_failing_twice_lands_in_needs_review_and_job_completes():
    provider = FlakyProvider()
    manager = JobManager(
        extraction_service=ExtractionService(provider),
        max_concurrency=2,
    )

    tickets = {
        "tkt_bad": {
            "id": "tkt_bad",
            "subject": "Broken thing",
            "body": "Zen Studio crashes on export.",
            "from_email": "a@acme.com",
        },
        "tkt_good": {
            "id": "tkt_good",
            "subject": "Broken other thing",
            "body": "Zen Studio crashes on import.",
            "from_email": "b@acme.com",
        },
    }

    job = manager.create_job(["tkt_bad", "tkt_good"])

    asyncio.run(manager.process_job(job.id, tickets))

    bad_item, good_item = job.items

    # The job finished even though one ticket failed validation twice.
    assert job.state == "done"

    # The bad ticket was retried exactly once, and the validation error
    # from attempt 1 was fed back into attempt 2.
    bad_calls = [c for c in provider.calls if c[0] == "tkt_bad"]
    assert [c[1] for c in bad_calls] == [1, 2]
    assert bad_calls[0][2] is None
    assert "severity" in bad_calls[1][2]

    # It is parked for review with the raw model output kept.
    assert bad_item.status == "needs_review"
    assert bad_item.result["record"] is None
    assert bad_item.result["raw_output"] is not None
    assert "validation_error" in bad_item.result

    # The healthy ticket was not affected.
    assert good_item.status == "done"

    assert manager.get_progress(job.id) == {
        "queued": 0,
        "running": 0,
        "done": 1,
        "failed": 0,
        "needs_review": 1,
    }