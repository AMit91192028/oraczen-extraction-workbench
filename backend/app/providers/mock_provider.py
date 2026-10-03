import re
import time

from app.provider import ExtractionProvider
from app.config import settings

DEFAULT_PRODUCT = "Zen Orchestrator"
DEFAULT_CATEGORY = "bug"
DEFAULT_SEVERITY = "medium"
DEFAULT_ACTION = "none"


class MockProvider:
    def __init__(self, delay_ms: int | None = None):
        self.delay_ms = (
            settings.mock_delay_ms
            if delay_ms is None
            else delay_ms
        )

    def extract(
        self,
        ticket: dict,
        attempt: int = 1,
        validation_error: str | None = None,
    ) -> dict:
        time.sleep(self.delay_ms / 1000)

        ticket_id = ticket["id"]
        subject = ticket.get("subject", "")
        body = ticket.get("body", "")
        text = f"{subject} {body}".lower()

        if ticket_id == "tkt_0030" and attempt == 1:
            return self._invalid_record()

        if ticket_id == "tkt_0060":
            return self._invalid_record()

        product = self._product_from_text(text)
        category = self._category_from_text(text)
        severity = self._severity_from_text(text)
        action = self._requested_action_from_text(text)

        # The schema has no "unknown" value, so a missing field must still be a
        # valid enum. Fall back to a neutral default and FLAG it as uncertain
        # instead of returning None (None fails validation twice -> needs_review).
        uncertain_fields = []
        if product is None:
            product, _ = DEFAULT_PRODUCT, uncertain_fields.append("product")
        if category is None:
            category, _ = DEFAULT_CATEGORY, uncertain_fields.append("category")
        if severity is None:
            severity, _ = DEFAULT_SEVERITY, uncertain_fields.append("severity")
        if action is None:
            action, _ = DEFAULT_ACTION, uncertain_fields.append("requested_action")

        record = {
            "company": self._company_from_ticket(ticket),
            "product": product,
            "category": category,
            "severity": severity,
            "requested_action": action,
            "refund_amount": self._refund_amount_from_text(text),
            "deadline": None,
            "escalated": self._is_escalated(text),
        }

        if re.search(r"\beur\b|\beuros?\b|€", text):
            uncertain_fields.append("refund_amount")

        return {
            "record": record,
            "uncertain_fields": uncertain_fields,
        }

    def _category_from_text(self, text: str) -> str | None:
        if re.search(r"non-?renew|not renew|cancel|switch(ing)? to|churn", text):
            return "churn_risk"

        if re.search(r"outage|service is down|system is down|production is down|completely down", text):
            return "outage"

        if re.search(r"invoice|billing|charged|overcharg|refund|payment", text):
            return "billing"

        if re.search(r"how do i|how can i|how to|does .* count|is it possible", text):
            return "how_to"

        if re.search(r"feature request|would like|wish|it would be great|add support", text):
            return "feature_request"

        if re.search(r"\bbug\b|error|broken|crash|fails?\b|not working", text):
            return "bug"

        return None

    def _severity_from_text(self, text: str) -> str | None:
        if (
            "critical" in text
            or "production is down" in text
            or "entire service is down" in text
            or "completely down" in text
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
        refund_context = re.search(
            r"(?:refund|reimburse|reimbursement|refunded)"
            r".{0,80}"
            r"\$\s*([\d,]+(?:\.\d+)?)",
            text,
        )

        if not refund_context:
            return None

        return float(
            refund_context.group(1).replace(",", "")
        )

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