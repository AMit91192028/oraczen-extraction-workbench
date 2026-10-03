from fastapi.testclient import TestClient

from app.main import app, job_manager


client = TestClient(app)


def test_human_can_correct_needs_review_record():
    job = job_manager.create_job(["tkt_0001"])

    item = job.items[0]

    item.status = "needs_review"
    item.result = {
        "status": "needs_review",
        "record": None,
        "raw_output": {
            "record": {
                "company": "Castlerock",
                "product": "Zen Orchestrator",
                "category": "bug",
                "severity": None,
                "requested_action": "information",
                "refund_amount": None,
                "deadline": None,
                "escalated": False,
            }
        },
    }

    response = client.patch(
        f"/api/records/{item.record_id}",
        json={"severity": "high"},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["ticket_id"] == "tkt_0001"
    assert data["status"] == "done"
    assert data["record"]["severity"] == "high"
    assert data["human_edited_fields"] == ["severity"]


def test_invalid_human_correction_is_rejected():
    job = job_manager.create_job(["tkt_0001"])

    item = job.items[0]

    item.status = "needs_review"
    item.result = {
        "status": "needs_review",
        "record": None,
        "raw_output": {
            "record": {
                "company": "Castlerock",
                "product": "Zen Orchestrator",
                "category": "bug",
                "severity": None,
                "requested_action": "information",
                "refund_amount": None,
                "deadline": None,
                "escalated": False,
            }
        },
    }

    response = client.patch(
        f"/api/records/{item.record_id}",
        json={"severity": "urgent"},
    )

    assert response.status_code == 422


def test_unknown_human_field_is_rejected():
    job = job_manager.create_job(["tkt_0001"])

    item = job.items[0]

    item.status = "needs_review"
    item.result = {
        "status": "needs_review",
        "record": None,
        "raw_output": {
            "record": {
                "company": "Castlerock",
                "product": "Zen Orchestrator",
                "category": "bug",
                "severity": None,
                "requested_action": "information",
                "refund_amount": None,
                "deadline": None,
                "escalated": False,
            }
        },
    }

    response = client.patch(
        f"/api/records/{item.record_id}",
        json={"random_field": "hello"},
    )

    assert response.status_code == 422

def test_export_job_csv():
    response = client.post(
        "/api/jobs",
        json={
            "ticket_ids": ["tkt_0030"],
        },
    )

    assert response.status_code == 202

    job_id = response.json()["job_id"]

    import time

    for _ in range(20):
        status_response = client.get(
            f"/api/jobs/{job_id}"
        )

        assert status_response.status_code == 200

        if status_response.json()["state"] == "done":
            break

        time.sleep(0.1)

    export_response = client.get(
        f"/api/jobs/{job_id}/export.csv"
    )

    assert export_response.status_code == 200
    assert export_response.headers["content-type"].startswith(
        "text/csv"
    )

    csv_content = export_response.text

    assert "record_id" in csv_content
    assert "ticket_id" in csv_content
    assert "tkt_0030" in csv_content
    assert "Panacea" in csv_content

   