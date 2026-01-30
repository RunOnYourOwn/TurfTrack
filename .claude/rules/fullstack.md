# Full-Stack Development Rules

FastAPI + React patterns and best practices for TurfTrack.

## Backend Patterns

### Async Database Sessions

```python
# GOOD - Async session with dependency injection
from app.core.database import get_session

@router.get("/lawns/", response_model=list[LawnRead])
async def list_lawns(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Lawn))
    return result.scalars().all()
```

### Pydantic Schema Pattern

Follow Create/Read/Update for every domain:

```python
# schemas/lawn.py
class LawnBase(BaseModel):
    name: str
    latitude: float
    longitude: float

class LawnCreate(LawnBase):
    grass_type: GrassType
    area_sqft: float

class LawnRead(LawnBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class LawnUpdate(BaseModel):
    name: str | None = None
    grass_type: GrassType | None = None
    area_sqft: float | None = None
```

### SQLAlchemy Model Pattern

```python
# models/lawn.py
class Lawn(Base):
    __tablename__ = "lawns"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[float]
    longitude: Mapped[float]
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    # Relationships
    weather_data: Mapped[list["Weather"]] = relationship(back_populates="lawn")
```

### Endpoint Pattern

```python
# api/v1/endpoints/lawns.py
@router.post("/", response_model=LawnRead, status_code=201)
async def create_lawn(
    lawn_data: LawnCreate,
    session: AsyncSession = Depends(get_session),
):
    lawn = Lawn(**lawn_data.model_dump())
    session.add(lawn)
    await session.commit()
    await session.refresh(lawn)
    return lawn

@router.get("/{lawn_id}", response_model=LawnRead)
async def get_lawn(
    lawn_id: int,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Lawn).where(Lawn.id == lawn_id))
    lawn = result.scalar_one_or_none()
    if not lawn:
        raise HTTPException(status_code=404, detail="Lawn not found")
    return lawn
```

### Celery Task Pattern

```python
# tasks/weather.py
@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def fetch_weather_data(self, lawn_id: int):
    """Fetch weather data from OpenMeteo API."""
    try:
        # Use sync requests in Celery tasks (not async)
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        # Process and store...
    except requests.RequestException as exc:
        logger.error("Weather fetch failed for lawn %d: %s", lawn_id, exc)
        raise self.retry(exc=exc)
```

### Alembic Migration Pattern

```python
# alembic/versions/xxxx_add_feature.py
def upgrade() -> None:
    op.add_column('lawns', sa.Column('zone', sa.String(10), nullable=True))

def downgrade() -> None:
    op.drop_column('lawns', 'zone')
```

**Rules:**
- Always provide both upgrade and downgrade
- Use `nullable=True` for new columns on existing tables (then backfill + set NOT NULL)
- Never modify existing migrations that have been applied

---

## Frontend Patterns

### Page Component (Lazy-Loaded)

```typescript
// pages/LawnsPage.tsx
export default function LawnsPage() {
  const { data: lawns, isLoading, error } = useQuery({
    queryKey: ['lawns'],
    queryFn: getLawns,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">Lawns</h1>
      {lawns?.map(lawn => (
        <LawnCard key={lawn.id} lawn={lawn} />
      ))}
    </div>
  );
}
```

### API Client Pattern

```typescript
// api/lawns.ts
import { axiosInstance } from '@/lib/axios';
import type { Lawn, LawnCreate } from '@/types/lawn';

export const getLawns = async (): Promise<Lawn[]> => {
  const { data } = await axiosInstance.get('/api/v1/lawns/');
  return data;
};

export const createLawn = async (lawn: LawnCreate): Promise<Lawn> => {
  const { data } = await axiosInstance.post('/api/v1/lawns/', lawn);
  return data;
};
```

### TanStack Query Mutation Pattern

```typescript
// hooks/useLawnMutations.ts
export function useCreateLawn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLawn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lawns'] });
    },
  });
}
```

### Component with shadcn/ui

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function LawnCard({ lawn }: { lawn: Lawn }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{lawn.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{lawn.grass_type} - {lawn.area_sqft} sq ft</p>
        <Button variant="outline">View Details</Button>
      </CardContent>
    </Card>
  );
}
```

---

## Domain Utilities

### GDD Calculation
- Located in `backend/app/utils/gdd.py`
- Uses base temperatures specific to grass type
- Accumulated daily from weather data

### Smith-Kerns Disease Model
- Located in `backend/app/utils/disease.py`
- Calculates disease pressure based on temperature and humidity
- Returns risk levels for common turf diseases

### Water Management
- Located in `backend/app/utils/water.py`
- Tracks irrigation and rainfall
- Calculates ET-based water needs

### Growth Potential
- Located in `backend/app/utils/growth_potential.py`
- Based on optimum growth temperature for grass species
- Used to adjust management practices seasonally

---

## DO / DON'T Summary

### DO
- Use async/await for all database and API operations
- Validate all input with Pydantic schemas
- Use SQLAlchemy ORM for database access
- Lazy-load all page components
- Use TanStack Query for all API calls
- Use shadcn/ui components before building custom ones
- Create Alembic migrations for schema changes
- Add `created_at`/`updated_at` to all models

### DON'T
- Use synchronous database calls in async endpoints
- Accept raw `dict` as API input
- Write raw SQL queries
- Import pages eagerly
- Use `fetch` or raw `axios` outside API client files
- Build custom UI components when shadcn/ui has them
- Modify existing applied migrations
- Skip Pydantic schemas for "simple" endpoints
