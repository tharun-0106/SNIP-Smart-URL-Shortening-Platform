"""
database.py - SQLite database initialization and connection management.
Handles all database setup and provides a session factory for FastAPI dependencies.
"""

import sqlite3
from pathlib import Path

# Path to the SQLite database file (stored in backend directory)
DB_PATH = Path(__file__).parent / "urls.db"


def get_connection() -> sqlite3.Connection:
    """
    Create and return a new SQLite connection with row_factory set
    so rows behave like dictionaries (accessible by column name).
    """
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # Enables dict-like row access
    return conn


def init_db() -> None:
    """
    Initialize the database schema.
    Creates the 'urls' table if it does not already exist.

    Schema:
        short_id     - unique alphanumeric identifier (primary key)
        original_url - the full original URL provided by the user
        click_count  - number of times the short link has been visited
        created_at   - ISO-8601 timestamp of when the link was created
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS urls (
                short_id     TEXT PRIMARY KEY,
                original_url TEXT NOT NULL,
                click_count  INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT NOT NULL
            )
        """)
        conn.commit()
    finally:
        conn.close()
