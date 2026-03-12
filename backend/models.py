"""
models.py - Pydantic models for request and response validation.
These models define the shape of data entering and leaving the API.
"""

from pydantic import BaseModel, HttpUrl
from typing import Optional


class ShortenRequest(BaseModel):
    """
    Request body for POST /shorten.
    Expects a valid HTTP/HTTPS URL from the client.
    """
    url: str  # Kept as str to allow flexible validation in the route handler


class ShortenResponse(BaseModel):
    """
    Response body after successfully shortening a URL.
    Returns the generated short ID and the full short URL.
    """
    short_id: str
    short_url: str
    original_url: str


class StatsResponse(BaseModel):
    """
    Response body for GET /stats/{short_id}.
    Returns analytics data for a specific short link.
    """
    short_id: str
    original_url: str
    click_count: int
    created_at: str
    short_url: str
