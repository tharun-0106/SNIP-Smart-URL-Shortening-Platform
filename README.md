# SNIP — Smart URL Shortener

> A fast, analytics-powered URL shortener built with **FastAPI** + **SQLite** backend and a bold **neo-brutalist dark** frontend.

---

## Project Structure

```
url-shortener/
├── backend/
│   ├── main.py        # FastAPI app + all API endpoints
│   ├── database.py    # SQLite connection & schema init
│   ├── models.py      # Pydantic request/response models
│   └── utils.py       # ID generation, URL validation, timestamps
├── frontend/
│   ├── index.html     # Main SPA page
│   ├── style.css      # Neo-brutalist dark theme
│   └── script.js      # Fetch API + UI logic
├── requirements.txt   # Python dependencies
└── README.md
```

---

## Quick Start

### 1. Install Python Dependencies

Requires **Python 3.9+**

```bash
# From the project root
pip install -r requirements.txt
```

### 2. Run the FastAPI Backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be live at: `http://localhost:8000`

Interactive API docs: `http://localhost:8000/docs`

### 3. Open the Frontend

Open `frontend/index.html` directly in your browser:

```bash
# macOS
open frontend/index.html

# Linux
xdg-open frontend/index.html

# Windows
start frontend/index.html
```

Or serve it with any static file server:

```bash
# Using Python's built-in server
cd frontend
python -m http.server 3000
# Then visit http://localhost:3000
```

---

## API Reference

### `POST /shorten`
Shorten a long URL.

**Request body:**
```json
{ "url": "https://example.com/very/long/path" }
```

**Response:**
```json
{
  "short_id":    "aB3kR9z",
  "short_url":   "http://localhost:8000/aB3kR9z",
  "original_url":"https://example.com/very/long/path"
}
```

---

### `GET /{short_id}`
Redirects to the original URL and increments the click counter.

```
GET http://localhost:8000/aB3kR9z
→ 307 Redirect → https://example.com/very/long/path
```

---

### `GET /stats/{short_id}`
Retrieve analytics for a short link.

**Response:**
```json
{
  "short_id":    "aB3kR9z",
  "original_url":"https://example.com/very/long/path",
  "click_count": 42,
  "created_at":  "2024-01-15T14:32:00+00:00",
  "short_url":   "http://localhost:8000/aB3kR9z"
}
```

---

## Testing the Application

### Option 1: Use the Web UI
1. Start the backend (`uvicorn main:app --reload`)
2. Open `frontend/index.html` in your browser
3. Paste a long URL and click **SNIP IT**
4. Copy the generated link and open it in a new tab
5. Click **REFRESH STATS** to see the updated click count

### Option 2: Use the Swagger UI
Visit `http://localhost:8000/docs` for interactive API testing.

### Option 3: cURL

```bash
# Shorten a URL
curl -X POST http://localhost:8000/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.github.com/openai/openai-cookbook"}'

# Get stats (replace aB3kR9z with your short_id)
curl http://localhost:8000/stats/aB3kR9z

# Test redirect (follow the redirect)
curl -L http://localhost:8000/aB3kR9z
```

---

## Features

| Feature | Details |
|---|---|
| URL Shortening | Base62 random IDs (7 chars, ~3.5 trillion combinations) |
| Click Tracking | Atomic counter increment on each redirect |
| Analytics | Click count + creation timestamp |
| Collision Handling | Up to 10 retry attempts on ID collision |
| URL Validation | Regex-based HTTP/HTTPS validation |
| History | Last 10 links persisted via localStorage |
| Responsive UI | Mobile + desktop layouts |
| Animations | Staggered reveals, counter animation, loading states |

---

## Configuration

To deploy with a custom domain, update `BASE_URL` in `backend/main.py`:

```python
BASE_URL = "https://your-domain.com"
```

And update `API_BASE` in `frontend/script.js`:

```javascript
const API_BASE = "https://your-domain.com";
```
