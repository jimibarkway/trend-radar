"""Shared env + paths for the Trend Radar pipeline.

Everything resolves relative to the repo root, which is discovered from the
TREND_RADAR_ROOT env var first, then by walking up from this file.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def repo_root() -> Path:
    env_root = os.environ.get("TREND_RADAR_ROOT")
    if env_root:
        return Path(env_root).resolve()
    # This file lives at pipeline/lib/env.py -> walk up 2 to repo root.
    return Path(__file__).resolve().parent.parent.parent


def pipeline_root() -> Path:
    return repo_root() / "pipeline"


def db_path() -> Path:
    p = repo_root() / "data" / "events.db"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def schema_path() -> Path:
    return pipeline_root() / "sql" / "schema.sql"


def config_path(filename: str) -> Path:
    """Return a config file path. Falls back to the `.example` version if the
    user has not yet copied it. This is what makes `docker-compose up` work
    on a fresh clone."""
    p = pipeline_root() / "config" / filename
    if p.exists():
        return p
    example = pipeline_root() / "config" / f"{filename.replace('.json', '.example.json')}"
    if example.exists():
        return example
    return p


def load_dotenv(path: Path | None = None) -> None:
    """Minimal .env loader. No dependency on python-dotenv."""
    if path is None:
        path = repo_root() / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k, v)


# Some env-var names are commonly aliased - accept either spelling.
_ALIASES: dict[str, list[str]] = {
    "GOOGLE_API_KEY": ["GEMINI_API_KEY"],
    "GEMINI_API_KEY": ["GOOGLE_API_KEY"],
    "GITHUB_TOKEN": ["GITHUB_PAT"],
    "APIFY_TOKEN": ["APIFY_API_TOKEN"],
}


def _resolve(key: str) -> str | None:
    load_dotenv()
    if os.environ.get(key):
        return os.environ[key]
    for alt in _ALIASES.get(key, []):
        if os.environ.get(alt):
            return os.environ[alt]
    return None


def require_env(key: str) -> str:
    val = _resolve(key)
    if not val:
        aliases = _ALIASES.get(key, [])
        names = ", ".join([key] + aliases)
        sys.exit(f"Missing env var. Set one of: {names}")
    return val


def optional_env(key: str, default: str | None = None) -> str | None:
    return _resolve(key) or default
