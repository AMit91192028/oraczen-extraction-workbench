import re
import time

from app.provider import ExtractionProvider


class MockProvider:
    def extract(
        self,
        ticket: dict,
        attempt: int = 1,
        validation_error: str | None = None,
    ) -> dict:
        time.sleep(0.1)

        ticket_id = ticket["id"]
        subject = ticket.get("subject", "")
        body = ticket.get("body", "")
        text = f"{subject} {body}".lower()

        if ticket_id == "tkt_0030" and attempt == 1:
            return self._invalid_record()

        if ticket_id == "tkt_0060":
            return self._invalid_record()

        record = {
            "company": self._company_from_ticket(ticket),
            "product": self._product_from_text(text),
            "category": self._category_from_text(text),
            "severity": self._severity_from_text(text),
            "requested_action": self._requested_action_from_text(text),
            "refund_amount": self._refund_amount_from_text(text),
            "deadline": None,
            "escalated": self._is_escalated(text),
        }

        uncertain_fields = []

        for field in ["product", "category", "severity", "requested_action"]:
            if record[field] is None:
                uncertain_fields.append(field)

        if "eur" in text or "€" in text:
            uncertain_fields.append("refund_amount")

        return {
            "record": record,
            "uncertain_fields": uncertain_fields,
        }

    def _category_from_text(self, text: str) -> str | None:
        if "outage" in text or "service is down" in text or "system is down" in text:
            return "outage"

        if "invoice" in text or "billing" in text or "charged" in text:
            return "billing"

        if "feature" in text or "would like" in text or "request" in text:
            return "feature_request"

        if "how do i" in text or "how can i" in text:
            return "how_to"

        if "renew" in text or "non-renew" in text:
            return "churn_risk"

        if "bug" in text or "error" in text or "broken" in text:
            return "bug"

        return None

    def _severity_from_text(self, text: str) -> str | None:
        if (
            "critical" in text
            or "production is down" in text
            or "entire service is down" in text
        ):
            return "critical"

        if (
            "urgent" in text
            or "escalated" in text
            or "escalation" in text
            or "business impact" in text
            or "cannot access" in text
        ):
            return "high"

        if (
            "minor" in text
            or "low priority" in text
            or "when convenient" in text
        ):
            return "low"

        return None

    def _requested_action_from_text(self, text: str) -> str | None:
        if "refund" in text or "reimburse" in text:
            return "refund"

        if "credit" in text:
            return "credit"

        if "callback" in text or "call me" in text:
            return "callback"

        if "fix" in text or "broken" in text:
            return "fix"

        if "please advise" in text or "?" in text:
            return "information"

        return None

    def _refund_amount_from_text(self, text: str) -> float | None:
        match = re.search(r"\$\s*([\d,]+(?:\.\d+)?)", text)

        if not match:
            return None

        return float(match.group(1).replace(",", ""))

    def _product_from_text(self, text: str) -> str | None:
        if "zen orchestrator" in text:
            return "Zen Orchestrator"

        if "zen studio" in text:
            return "Zen Studio"

        if "zen connect" in text:
            return "Zen Connect"

        if "zen insights" in text:
            return "Zen Insights"

        if "zen vault" in text:
            return "Zen Vault"

        return None

    def _is_escalated(self, text: str) -> bool:
        escalation_words = (
            "escalated",
            "escalation",
            "management",
            "urgent",
        )

        return any(word in text for word in escalation_words)

    def _company_from_ticket(self, ticket: dict) -> str:
        sender = ticket.get("from_email", "")

        if "@" not in sender:
            return "Unknown"

        domain = sender.split("@", 1)[1]
        company = domain.split(".")[0]

        return company.title()

    def _invalid_record(self) -> dict:
        return {
            "record": {
                "company": "Unknown",
                "product": "Zen Studio",
                "category": "billing",
                "severity": "urgent",
                "requested_action": "information",
                "refund_amount": None,
                "deadline": None,
                "escalated": False,
            },
            "uncertain_fields": [],
        }