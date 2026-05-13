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


def main():
    db = db_path()
    schema = schema_path()
    db.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db))
    con.executescript(schema.read_text())
    con.commit()
    tables = [row[0] for row in con.execute(
        "SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name"
    )]
    con.close()
    print(f"DB initialised at {db}")
    print(f"Tables + views: {', '.join(tables)}")


if __name__ == "__main__":
    main()
