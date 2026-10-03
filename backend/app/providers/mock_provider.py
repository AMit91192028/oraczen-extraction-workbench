import re
import time

import re
import time

_AMOUNT_RE = re.compile(r"\$\s?([\d,]+(?:\.\d+)?)")
_EUR_RE = re.compile(
    r"([\d][\d,\s]*(?:\.\d+)?)\s?EUR",
    re.IGNORECASE,
)

WORD_NUMBERS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}

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
            product = DEFAULT_PRODUCT
            uncertain_fields.append("product")

        if category is None:
            category = DEFAULT_CATEGORY
            uncertain_fields.append("category")

        if severity is None:
            severity = DEFAULT_SEVERITY
            uncertain_fields.append("severity")

        if action is None:
            action = DEFAULT_ACTION
            uncertain_fields.append("requested_action")

        warnings = []

        if action == "refund":
            refund_amount, refund_confidence, refund_grounded = (
                self._guess_refund_amount(text, warnings)
            )
        else:
            refund_amount = None
            refund_confidence = 0.7
            refund_grounded = True

        record = {
            "company": self._company_from_ticket(ticket),
            "product": product,
            "category": category,
            "severity": severity,
            "requested_action": action,
            "refund_amount": refund_amount,
            "deadline": None,
            "escalated": self._is_escalated(text),
        }

        if not refund_grounded:
            uncertain_fields.append("refund_amount")

        return {
            "record": record,
            "uncertain_fields": uncertain_fields,
            "warnings": warnings,
            "field_confidence": {
                "refund_amount": refund_confidence,
            },
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

    def _guess_refund_amount(
        self,
        text: str,
        warnings: list[str],
    ) -> tuple[float | None, float, bool]:
        usd_match = _AMOUNT_RE.search(text)

        if usd_match:
            amount = float(
                usd_match.group(1).replace(",", "").replace(" ", "")
            )
            return amount, 0.9, True

        eur_match = _EUR_RE.search(text)

        if eur_match:
            amount = float(
                eur_match.group(1).replace(",", "").replace(" ", "")
            )
            warnings.append(
                f"Amount was stated in EUR ({amount:g} EUR), not USD. "
                "Stored as-is, unconverted -- verify the rate and correct "
                "before export."
            )
            return amount, 0.4, False

        lowered = text.lower()

        word_amount_match = re.search(
            r"(" + "|".join(WORD_NUMBERS) + r")\s+thousand",
            lowered,
        )

        if word_amount_match:
            amount = WORD_NUMBERS[word_amount_match.group(1)] * 1000
            warnings.append(
                f"Amount was spoken approximately "
                f"('{word_amount_match.group(0)} something'); "
                f"extracted {amount:g} as a rough figure, not grounded "
                "in an exact written number."
            )
            return float(amount), 0.3, False

        if any(
            keyword in lowered
            for keyword in ["refund", "charged", "billed", "credit"]
        ):
            return None, 0.3, False

        return None, 0.7, True
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