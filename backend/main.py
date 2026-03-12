"""
main.py - FastAPI application entry point.
Defines all API endpoints for the Smart URL Shortener service.

Endpoints:
    POST /shorten         → Create a new short URL
    GET  /{short_id}      → Redirect to the original URL
    GET  /stats/{short_id} → Return analytics for a short URL
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import sqlite3

from database import get_connection, init_db
from models import ShortenRequest, ShortenResponse, StatsResponse
from utils import generate_short_id, is_valid_url, current_timestamp

# ---------------------------------------------------------------------------
# Application Setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Smart URL Shortener",
    description="A fast, analytics-powered URL shortening service.",
    version="1.0.0",
)

# Allow all origins for local development — restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base URL used to construct short links (change for production deployments)
BASE_URL = "http://localhost:8000"


@app.on_event("startup")
def startup_event():
    """Initialize the SQLite database when the server starts."""
    init_db()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/shorten", response_model=ShortenResponse, tags=["URL Shortener"])
def shorten_url(request: ShortenRequest):
    """
    Create a shortened URL from a long URL.

    - Validates the incoming URL format.
    - Generates a unique Base62 short ID (retries on collision).
    - Persists the mapping in SQLite.
    - Returns the short ID and full short URL.
    """
    url = request.url.strip()

    # --- Validate URL ---
    if not is_valid_url(url):
        raise HTTPException(
            status_code=422,
            detail="Invalid URL. Please provide a valid HTTP or HTTPS URL."
        )

    conn = get_connection()
    try:
        cursor = conn.cursor()

        # --- Generate a unique short ID (retry on collision) ---
        max_attempts = 10
        short_id = None
        for _ in range(max_attempts):
            candidate = generate_short_id()
            cursor.execute("SELECT short_id FROM urls WHERE short_id = ?", (candidate,))
            if cursor.fetchone() is None:
                short_id = candidate
                break

        if short_id is None:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate a unique short ID. Please try again."
            )

        # --- Persist to database ---
        cursor.execute(
            "INSERT INTO urls (short_id, original_url, click_count, created_at) VALUES (?, ?, 0, ?)",
            (short_id, url, current_timestamp())
        )
        conn.commit()

    finally:
        conn.close()

    return ShortenResponse(
        short_id=short_id,
        short_url=f"{BASE_URL}/{short_id}",
        original_url=url,
    )


@app.get("/stats/{short_id}", response_model=StatsResponse, tags=["Analytics"])
def get_stats(short_id: str):
    """
    Retrieve analytics data for a given short ID.

    Returns:
        - Original URL
        - Click count (number of redirects)
        - Creation timestamp
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM urls WHERE short_id = ?", (short_id,))
        row = cursor.fetchone()
    finally:
        conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail=f"Short ID '{short_id}' not found.")

    return StatsResponse(
        short_id=row["short_id"],
        original_url=row["original_url"],
        click_count=row["click_count"],
        created_at=row["created_at"],
        short_url=f"{BASE_URL}/{row['short_id']}",
    )


@app.get("/{short_id}", tags=["Redirect"])
def redirect_to_url(short_id: str):
    """
    Redirect the browser to the original URL associated with the short ID.
    Increments the click counter atomically on each visit.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()

        # Fetch the original URL
        cursor.execute("SELECT original_url FROM urls WHERE short_id = ?", (short_id,))
        row = cursor.fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"Short ID '{short_id}' not found.")

        # Increment click count
        cursor.execute(
            "UPDATE urls SET click_count = click_count + 1 WHERE short_id = ?",
            (short_id,)
        )
        conn.commit()
        original_url = row["original_url"]

    finally:
        conn.close()

    # HTTP 307 preserves the original request method on redirect
    return RedirectResponse(url=original_url, status_code=307)
