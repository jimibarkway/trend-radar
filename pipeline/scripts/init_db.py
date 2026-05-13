#!/usr/bin/env python3
"""init_db.py - one-shot DB initialiser. Idempotent.

Usage:
    python -m pipeline.scripts.init_db
    python pipeline/scripts/init_db.py
"""

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from pipeline.lib.env import db_path, schema_path


# Lightweight schema migrations - run defensively on every init. Each entry
# is (column_name, ddl_to_add). CREATE TABLE IF NOT EXISTS in schema.sql
# does not add columns to existing tables, so we handle that here.
MIGRATIONS: list[tuple[str, str]] = [
    ("freshness_score", "ALTER TABLE raw_events ADD COLUMN freshness_score REAL"),
]


def main():
    db = db_path()
    schema = schema_path()
    db.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db))
    con.executescript(schema.read_text())
    # Apply column migrations idempotently
    existing_cols = {r[1] for r in con.execute("PRAGMA table_info(raw_events)")}
    for col, ddl in MIGRATIONS:
        if col not in existing_cols:
            con.execute(ddl)
            print(f"Migration: added column {col}")
    con.commit()
    tables = [row[0] for row in con.execute(
        "SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name"
    )]
    con.close()
    print(f"DB initialised at {db}")
    print(f"Tables + views: {', '.join(tables)}")


if __name__ == "__main__":
    main()
