"""
utils.py - Utility functions for the URL shortener.
Includes short ID generation using Base62 encoding and URL validation.
"""

import random
import string
import re
from datetime import datetime, timezone


# Base62 character set: digits + uppercase + lowercase letters
BASE62_CHARS = string.digits + string.ascii_uppercase + string.ascii_lowercase

# Length of the generated short ID
SHORT_ID_LENGTH = 7


def generate_short_id(length: int = SHORT_ID_LENGTH) -> str:
    """
    Generate a random Base62 alphanumeric short ID.

    Args:
        length: Number of characters in the short ID (default: 7).

    Returns:
        A random string of `length` characters drawn from Base62 alphabet.

    Example:
        >>> generate_short_id()
        'aB3kR9z'
    """
    return "".join(random.choices(BASE62_CHARS, k=length))


def is_valid_url(url: str) -> bool:
    """
    Validate that the provided string is a well-formed HTTP or HTTPS URL.

    Args:
        url: The URL string to validate.

    Returns:
        True if the URL is valid, False otherwise.
    """
    pattern = re.compile(
        r'^(https?://)'                        # must start with http:// or https://
        r'(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})'   # domain with at least one dot
        r'(:\d+)?'                              # optional port
        r'(/[^\s]*)?$',                         # optional path
        re.IGNORECASE
    )
    return bool(pattern.match(url.strip()))


def current_timestamp() -> str:
    """
    Return the current UTC time as an ISO-8601 formatted string.

    Returns:
        A string like '2024-01-15T14:32:00+00:00'
    """
    return datetime.now(timezone.utc).isoformat()
