# Code Review Criteria

Rules for reviewing pull requests in TurfTrack. Check these patterns before merging.

## Critical Issues (Must Fix Before Merge)

### Backend Anti-Patterns

#### Synchronous Database Access
```python
# BAD - Blocking the event loop
from sqlalchemy import create_engine
engine = create_engine(DATABASE_URL)
result = engine.execute(query)

# GOOD - Async session
from app.core.database import async_session
async with async_session() as session:
    result = await session.execute(query)
```

#### Missing Input Validation
```python
# BAD - No validation
@router.post("/lawns/")
async def create_lawn(data: dict):
    lawn = Lawn(**data)  # Unvalidated!

# GOOD - Pydantic schema
@router.post("/lawns/", response_model=LawnRead)
async def create_lawn(data: LawnCreate, session: AsyncSession = Depends(get_session)):
    lawn = Lawn(**data.model_dump())
```

#### Raw SQL Queries
```python
# BAD - SQL injection risk
await session.execute(text(f"SELECT * FROM lawns WHERE id = {lawn_id}"))

# GOOD - Parameterized query
await session.execute(select(Lawn).where(Lawn.id == lawn_id))
```

#### N+1 Query Problem
```python
# BAD - N+1 queries
lawns = await session.execute(select(Lawn))
for lawn in lawns.scalars():
    weather = await session.execute(
        select(Weather).where(Weather.lawn_id == lawn.id)
    )

# GOOD - Eager loading
lawns = await session.execute(
    select(Lawn).options(selectinload(Lawn.weather_data))
)
```

#### Missing Error Handling in Celery Tasks
```python
# BAD - Unhandled exceptions kill worker
@celery_app.task
def fetch_weather(lawn_id):
    response = requests.get(url)  # What if it fails?
    process(response.json())

# GOOD - Retry with backoff
@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def fetch_weather(self, lawn_id):
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        process(response.json())
    except requests.RequestException as exc:
        raise self.retry(exc=exc)
```

---

### Frontend Anti-Patterns

#### Direct API Calls
```typescript
// BAD - Bypassing TanStack Query
const [data, setData] = useState(null);
useEffect(() => {
  axios.get('/api/v1/lawns').then(res => setData(res.data));
}, []);

// GOOD - TanStack Query
const { data, isLoading, error } = useQuery({
  queryKey: ['lawns'],
  queryFn: () => getLawns(),
});
```

#### Missing TypeScript Types
```typescript
// BAD - any types
const handleSubmit = (data: any) => {
  // ...
};

// GOOD - Proper types
const handleSubmit = (data: LawnCreate) => {
  // ...
};
```

#### Non-Lazy Page Components
```typescript
// BAD - Eager loading
import LawnsPage from './pages/LawnsPage';

// GOOD - Lazy loading
const LawnsPage = React.lazy(() => import('./pages/LawnsPage'));
```

---

## Security Review Checklist

When reviewing PRs, verify:

### Input Validation
- [ ] All user inputs validated via Pydantic schemas
- [ ] File uploads checked for size and type
- [ ] URL parameters validated and typed

### Database Security
- [ ] No raw SQL or string interpolation in queries
- [ ] SQLAlchemy ORM used for all database access
- [ ] Migrations don't drop data without confirmation

### API Security
- [ ] Proper HTTP methods (GET for reads, POST/PUT/DELETE for writes)
- [ ] Error responses don't leak internal details
- [ ] CORS configuration appropriate

### Secrets
- [ ] No hardcoded credentials, API keys, or tokens
- [ ] Environment variables used for all secrets
- [ ] `.env` files not committed

---

## Testing Requirements

Before merging:

### Must Have Tests
- [ ] All new API endpoints tested (unit + integration)
- [ ] Utility functions tested with edge cases
- [ ] Celery tasks tested with mock external services

### Test Quality
- [ ] Tests cover happy path AND error cases
- [ ] Async tests use proper fixtures
- [ ] No flaky tests (consistent pass/fail)
- [ ] Meaningful assertions (not just `assert True`)

---

## Review Process

1. **Run Tests**
   ```bash
   cd backend && ./run_tests.sh
   ```

2. **Check Linting**
   ```bash
   cd backend && ./run_tests.sh lint
   cd frontend && npm run lint
   ```

3. **Build Frontend**
   ```bash
   cd frontend && npm run build
   ```

4. **Check for Issues**
   - Search for anti-patterns above
   - Verify security checklist
   - Check error handling
   - Look for N+1 queries

5. **Review Migrations**
   - Schema changes have migrations
   - Migrations are reversible when possible
   - No data loss

---

## Common Anti-Patterns to Reject

### Synchronous Code in Async Context
```python
# Blocks the event loop
import time
time.sleep(5)  # NO!
```

### Missing Pydantic Schema
```python
# Accepting raw dicts instead of validated schemas
@router.post("/")
async def create(data: dict):  # NO!
```

### Hardcoded Configuration
```python
# Should use Settings from core/config.py
DATABASE_URL = "postgresql://user:pass@localhost/db"  # NO!
```

### Console.log in Production
```typescript
// Remove before merge
console.log("debug data:", data);  // NO!
```

---

## Final Checks

Before approving PR:
- [ ] All tests pass
- [ ] No security issues present
- [ ] Async patterns followed throughout
- [ ] Pydantic schemas used for all API input/output
- [ ] SQLAlchemy ORM used (no raw SQL)
- [ ] Frontend builds cleanly
- [ ] Migrations included if schema changed
- [ ] CHANGELOG.md updated
