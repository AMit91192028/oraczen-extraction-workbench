import pytest
from pydantic import ValidationError

from app.schemas import ExtractionRecord


def test_valid_record_is_accepted():
    record = ExtractionRecord(
        company="Acme Corp",
        product="Zen Studio",
        category="billing",
        severity="high",
        requested_action="refund",
        refund_amount=4820.00,
        deadline=None,
        escalated=True,
    )

    assert record.company == "Acme Corp"
    assert record.refund_amount == 4820.00


def test_invalid_severity_is_rejected():
    with pytest.raises(ValidationError):
        ExtractionRecord(
            company="Acme Corp",
            product="Zen Studio",
            category="billing",
            severity="urgent",
            requested_action="refund",
            refund_amount=4820.00,
            deadline=None,
            escalated=True,
        )