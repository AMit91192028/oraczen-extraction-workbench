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