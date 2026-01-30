# Security Requirements

Security rules and patterns for TurfTrack development.

## OWASP Top 10 Awareness

### A03:2021 - Injection

#### SQL Injection Prevention

```python
# BAD - String interpolation
query = f"SELECT * FROM lawns WHERE name = '{user_input}'"
await session.execute(text(query))

# GOOD - SQLAlchemy ORM (parameterized)
result = await session.execute(
    select(Lawn).where(Lawn.name == user_input)
)

# GOOD - If raw SQL is unavoidable, use bind parameters
result = await session.execute(
    text("SELECT * FROM lawns WHERE name = :name"),
    {"name": user_input}
)
```

**Rule:** Always use SQLAlchemy ORM. Never concatenate user input into queries.

---

### A07:2021 - Cross-Site Scripting (XSS)

React handles output encoding by default. Risks remain with:

```typescript
// BAD - Renders raw HTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// GOOD - React auto-escapes
<div>{userInput}</div>
```

**Rule:** Never use `dangerouslySetInnerHTML` with user-provided content.

---

### A09:2021 - Security Logging and Monitoring

```python
# DO Log
logger.info("Lawn created: lawn_id=%s", lawn.id)
logger.warning("Failed login attempt: ip=%s", request.client.host)
logger.error("Weather API failed: status=%d", response.status_code)

# DON'T Log
logger.info("User password: %s", password)          # Secrets
logger.info("API key: %s", settings.api_key)         # Credentials
logger.info("Full request: %s", request.body())       # May contain secrets
```

---

## Input Validation

### Pydantic Schemas (Primary Defense)

All API input MUST go through Pydantic schemas:

```python
# GOOD - Pydantic validates everything
class LawnCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    grass_type: GrassType  # Enum validation
    area_sqft: float = Field(..., gt=0)

# FastAPI automatically validates
@router.post("/lawns/", response_model=LawnRead)
async def create_lawn(lawn: LawnCreate):
    # lawn is already validated
    ...
```

### File Upload Validation

```python
# Validate file uploads
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".csv", ".json"}

async def validate_upload(file: UploadFile):
    # Check extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type {ext} not allowed")

    # Check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large")

    await file.seek(0)  # Reset for subsequent reads
    return content
```

---

## Secrets Management

### Environment Variables

```python
# GOOD - Settings from environment
from app.core.config import settings

database_url = settings.DATABASE_URL
redis_url = settings.REDIS_URL
secret_key = settings.SECRET_KEY

# BAD - Hardcoded
database_url = "postgresql://user:password@localhost/db"
```

### Files to Never Commit
- `.env` (use `.env.example` as template)
- `*.pem`, `*.key` (certificates)
- `credentials.json`, `service-account.json`
- Any file containing API keys or tokens

### .gitignore Verification

Ensure these patterns exist in `.gitignore`:
```
.env
*.pem
*.key
credentials.json
```

---

## API Security

### Error Responses

```python
# BAD - Leaks internal details
raise HTTPException(500, detail=str(e))  # Exposes stack trace

# GOOD - Generic error message
logger.error("Unexpected error: %s", e)
raise HTTPException(500, detail="Internal server error")
```

### CORS Configuration

```python
# Verify middleware/security.py restricts origins appropriately
# Development: allow localhost
# Production: restrict to actual domain
```

### Rate Limiting

Consider rate limiting on:
- API endpoints with external calls (weather fetching)
- Resource creation endpoints
- Any endpoint that triggers Celery tasks

---

## Database Security

### Migration Safety

```python
# DANGEROUS - Dropping columns/tables
op.drop_column('lawns', 'important_data')

# SAFER - Rename first, drop later
op.alter_column('lawns', 'important_data', new_column_name='_deprecated_important_data')
# Drop in a subsequent migration after verifying no code references it
```

### Connection Security

- Use SSL connections in production
- Connection pooling via SQLAlchemy (configured in `core/database.py`)
- Async connections via asyncpg

---

## Security Review Checklist

When reviewing PRs, check:

### Input Validation
- [ ] All user inputs validated via Pydantic schemas
- [ ] Field constraints appropriate (min/max length, ranges)
- [ ] Enum types used for fixed-value fields
- [ ] File uploads validated (size, type)

### Database
- [ ] No raw SQL or string interpolation
- [ ] SQLAlchemy ORM used throughout
- [ ] Migrations don't drop data without plan

### Secrets
- [ ] No hardcoded credentials
- [ ] Environment variables used
- [ ] .env not committed

### API
- [ ] Error responses don't leak internals
- [ ] Proper HTTP status codes
- [ ] CORS configured appropriately

### Frontend
- [ ] No `dangerouslySetInnerHTML` with user content
- [ ] No sensitive data in localStorage
- [ ] API tokens handled securely

---

## Threat Model

### Threats We Protect Against
- SQL injection (SQLAlchemy ORM)
- XSS (React auto-escaping)
- CSRF (SameSite cookies, CORS)
- Secret exposure (environment variables, .gitignore)
- Invalid input (Pydantic validation)

### Assumptions
- Application runs behind reverse proxy in production
- Database access restricted to application server
- Redis access restricted to internal network
- Docker network isolation in place
