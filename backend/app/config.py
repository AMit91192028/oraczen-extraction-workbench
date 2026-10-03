from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        extra="ignore",
    )

    provider: str = "mock"
    mock_delay_ms: int = 400
    max_concurrency: int = 5
    cors_origin: str = "http://localhost:3000"
    tickets_path: str = "data/tickets.jsonl"



settings = Settings()