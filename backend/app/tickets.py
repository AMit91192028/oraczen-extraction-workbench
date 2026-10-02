import json
from pathlib import Path


def load_tickets(path: str | Path) -> list[dict]:
    tickets = []

    with open(path, "r", encoding="utf-8") as file:
        for line in file:
            if line.strip():
                tickets.append(json.loads(line))

    return tickets