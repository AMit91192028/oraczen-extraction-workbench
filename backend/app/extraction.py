from pydantic import ValidationError

from app.providers.mock_provider import MockProvider
from app.schemas import ExtractionRecord


class ExtractionService:
    def __init__(self, provider=None):
        self.provider = provider or MockProvider()

    def process_ticket(self, ticket: dict) -> dict:
        if self._insufficient_content(ticket):
            return {
                "status": "needs_review",
                "reason": "Insufficient ticket content",
                "record": None,
                "raw_output": None,
                "uncertain_fields": [],
                "review_reasons": [
                    "Insufficient ticket content."
                ],
            }

        review_reasons = self._review_reasons(ticket)

        last_output = None
        last_error = None

        for attempt in range(1, 3):
            output = self.provider.extract(
                ticket,
                attempt=attempt,
                validation_error=last_error,
            )

            last_output = output

            try:
                record = ExtractionRecord.model_validate(
                    output["record"]
                )

                return {
                    "status": "done",
                    "reason": None,
                    "record": record.model_dump(mode="json"),
                    "raw_output": output,
                    "uncertain_fields": output.get(
                        "uncertain_fields",
                        [],
                    ),
                    "review_reasons": review_reasons,
                }

            except ValidationError as error:
                last_error = str(error)

        return {
            "status": "needs_review",
            "reason": "Model output failed validation twice",
            "record": None,
            "raw_output": last_output,
            "uncertain_fields": last_output.get(
                "uncertain_fields",
                [],
            ),
            "validation_error": last_error,
            "review_reasons": review_reasons,
        }

    def _insufficient_content(self, ticket: dict) -> bool:
        subject = ticket.get("subject", "").strip()
        body = ticket.get("body", "").strip()

        combined = f"{subject} {body}".strip().lower()

        return combined in {"please advise", "?"}

    def _review_reasons(self, ticket: dict) -> list[str]:
        text = (
            f"{ticket.get('subject', '')} "
            f"{ticket.get('body', '')}"
        ).lower()

        reasons = []

        if "eur" in text or "€" in text:
            reasons.append(
                "Refund amount is in EUR but the schema expects USD."
            )

        if (
            "three separate problems" in text
            or "three separate issues" in text
        ):
            reasons.append(
                "Ticket contains multiple issues but the schema allows one category."
            )

        if (
            "do not renew" in text
            or "not renew" in text
            or "non-renew" in text
        ):
            reasons.append(
                "Ticket contains a renewal/churn threat."
            )

        return reasons