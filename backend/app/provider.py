from typing import Protocol


class ExtractionProvider(Protocol):
    def extract(
        self,
        ticket: dict,
        attempt: int = 1,
        validation_error: str | None = None,
    ) -> dict:
        ...