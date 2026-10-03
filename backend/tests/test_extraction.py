from app.extraction import ExtractionService


def test_insufficient_content_needs_review():
    service = ExtractionService()

    ticket = {
        "id": "tkt_0004",
        "subject": "",
        "body": "please advise",
        "from_email": "customer@example.com",
    }

    result = service.process_ticket(ticket)

    assert result["status"] == "needs_review"
    assert result["reason"] == "Insufficient ticket content"


def test_invalid_output_retries():
    class TrackingProvider:
        def __init__(self):
            self.attempts = []

        def extract(
            self,
            ticket,
            attempt=1,
            validation_error=None,
        ):
            self.attempts.append(attempt)

            if attempt == 1:
                return {
                    "record": {
                        "company": "Panacea",
                        "product": "Zen Studio",
                        "category": "billing",
                        "severity": "urgent",
                        "requested_action": "refund",
                        "refund_amount": 18400.0,
                        "deadline": None,
                        "escalated": False,
                    },
                    "uncertain_fields": [],
                }

            return {
                "record": {
                    "company": "Panacea",
                    "product": None,
                    "category": "billing",
                    "severity": None,
                    "requested_action": "refund",
                    "refund_amount": 18400.0,
                    "deadline": None,
                    "escalated": False,
                },
                "uncertain_fields": [
                    "product",
                    "severity",
                ],
            }

    provider = TrackingProvider()
    service = ExtractionService(provider)

    ticket = {
        "id": "tkt_0030",
        "subject": "Billing discrepancy",
        "body": (
            "We were billed twice for invoice INV-23376 on the 11th. "
            "Charge was $18,400 each time. Please refund the duplicate "
            "and confirm in writing."
        ),
        "from_email": "t.beckett@panacea.com",
    }

    result = service.process_ticket(ticket)

    assert provider.attempts == [1, 2]
    assert result["status"] == "needs_review"


def test_invalid_output_twice_needs_review():
    service = ExtractionService()

    ticket = {
        "id": "tkt_0060",
        "subject": "How do I...",
        "body": "How do I move a workspace?",
        "from_email": "customer@example.com",
    }

    result = service.process_ticket(ticket)

    assert result["status"] == "needs_review"
    assert result["raw_output"] is not None
    assert "validation_error" in result


def test_eur_amount_is_flagged():
    service = ExtractionService()

    ticket = {
        "id": "tkt_0058",
        "subject": "Refund request",
        "body": "Please refund 4 820 EUR.",
        "from_email": "customer@example.com",
    }

    result = service.process_ticket(ticket)

    assert (
        "Refund amount is in EUR but the schema expects USD."
        in result["review_reasons"]
    )


def test_multi_issue_ticket_is_flagged():
    service = ExtractionService()

    ticket = {
        "id": "tkt_0089",
        "subject": "RE: RE: RE: multiple unresolved issues - escalating",
        "body": (
            "Copying in the thread below for context. Short version: "
            "we have three separate problems and I need owners for each.\n\n"
            "1) Zen Insights exports are still coming out with "
            "serial-number dates. Reported on the 3rd, ticket was closed "
            "without a fix.\n\n"
            "2) We were charged $18,400 on the 9th. Our signed order form "
            "says $14,800. Nobody has explained the delta.\n\n"
            "3) The SSO work your team committed to for September has "
            "apparently slipped and we found out from a slide, not from "
            "our CSM.\n\n"
            "Our CFO is now involved. I would like a written plan by Friday "
            "covering all three, including who owns what and by when. "
            "If we cannot get to a plan I will be recommending we do not "
            "renew in November."
        ),
        "from_email": "t.beckett@kestrel.com",
    }

    result = service.process_ticket(ticket)

    assert result["status"] == "needs_review"

    assert any(
        "multiple issues" in reason
        for reason in result["review_reasons"]
    )

    assert any(
        "renewal" in reason
        for reason in result["review_reasons"]
    )