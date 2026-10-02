from datetime import date
from enum import Enum

from pydantic import BaseModel


class Product(str, Enum):
    ZEN_ORCHESTRATOR = "Zen Orchestrator"
    ZEN_STUDIO = "Zen Studio"
    ZEN_CONNECT = "Zen Connect"
    ZEN_INSIGHTS = "Zen Insights"
    ZEN_VAULT = "Zen Vault"


class Category(str, Enum):
    OUTAGE = "outage"
    BILLING = "billing"
    BUG = "bug"
    FEATURE_REQUEST = "feature_request"
    HOW_TO = "how_to"
    CHURN_RISK = "churn_risk"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RequestedAction(str, Enum):
    REFUND = "refund"
    CREDIT = "credit"
    FIX = "fix"
    CALLBACK = "callback"
    INFORMATION = "information"
    NONE = "none"


class ExtractionRecord(BaseModel):
    company: str
    product: Product
    category: Category
    severity: Severity
    requested_action: RequestedAction
    refund_amount: float | None = None
    deadline: date | None = None
    escalated: bool