# Test-Driven Development (TDD)

**CRITICAL:** All new features MUST follow TDD workflow. Write tests first, then implementation.

## TDD Workflow (5 Steps)

### 1. Write Tests First
- Define expected behavior in tests
- Cover happy path and edge cases
- Include error handling scenarios

### 2. Run Tests - Confirm Failure
- Tests MUST fail initially (red)
- Verifies tests are actually testing something
- Proves feature doesn't exist yet

### 3. Commit Tests Separately
- Commit failing tests before implementation
- Message: "Add tests for [feature]"
- Creates clear TDD history

### 4. Implement Code to Pass Tests
- Write minimal code to make tests pass (green)
- Follow repo-specific patterns
- Refactor for quality after tests pass

### 5. Confirm Passing
- Tests now pass (green)
- Coverage maintained or improved
- All CI checks pass

## Why TDD?

- **Prevents regressions**: Tests catch breaking changes
- **Documents behavior**: Tests show how code should work
- **Better design**: Writing tests first leads to more testable code
- **Confidence**: Green tests mean code works as expected

## TDD Examples by Repository

### Backend (Python / FastAPI)

```bash
# 1. Write test first
cat > backend/tests/unit/test_new_feature.py << 'EOF'
import pytest
from app.utils.new_feature import calculate_something

@pytest.mark.unit
async def test_calculate_something_happy_path():
    result = await calculate_something(input_value=42)
    assert result == expected_output

@pytest.mark.unit
async def test_calculate_something_edge_case():
    result = await calculate_something(input_value=0)
    assert result == 0

@pytest.mark.unit
async def test_calculate_something_invalid_input():
    with pytest.raises(ValueError):
        await calculate_something(input_value=-1)
EOF

# 2. Confirm test fails
cd backend && python -m pytest tests/unit/test_new_feature.py -v
# Expected: FAILED (feature doesn't exist yet)

# 3. Commit failing test
git add tests/unit/test_new_feature.py
git commit -m "Add tests for new_feature calculation"

# 4. Implement feature
# ... write code in backend/app/utils/new_feature.py ...

# 5. Verify test passes
cd backend && python -m pytest tests/unit/test_new_feature.py -v
# Expected: PASSED
```

### Backend API Endpoint

```bash
# 1. Write integration test first
cat > backend/tests/integration/test_new_endpoint.py << 'EOF'
import pytest
from httpx import AsyncClient

@pytest.mark.integration
@pytest.mark.api
async def test_create_resource(client: AsyncClient, auth_headers):
    response = await client.post(
        "/api/v1/resources/",
        json={"name": "Test Resource", "value": 42},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Resource"

@pytest.mark.integration
@pytest.mark.api
async def test_create_resource_invalid(client: AsyncClient, auth_headers):
    response = await client.post(
        "/api/v1/resources/",
        json={"name": ""},  # Invalid - empty name
        headers=auth_headers,
    )
    assert response.status_code == 422
EOF

# 2. Confirm test fails
cd backend && python -m pytest tests/integration/test_new_endpoint.py -v
# Expected: FAILED

# 3. Commit failing test
git add tests/integration/test_new_endpoint.py
git commit -m "Add tests for resource endpoint"

# 4. Implement endpoint in backend/app/api/v1/endpoints/
# 5. Verify: cd backend && ./run_tests.sh
```

### Frontend (React / TypeScript)

```bash
# Frontend follows build-first verification
# 1. Write component with TypeScript types
# 2. Verify: npm run lint && npm run build
# 3. Test manually in dev: npm run dev
```

## Enforcement

- PRs without tests for new features will be **rejected**
- Coverage thresholds enforced:
  - Backend: >= 80%
  - Frontend: lint + build must pass
- Tests must be **meaningful**, not just for coverage
- TDD workflow must be followed (tests committed separately)

## Red -> Green -> Refactor

The TDD cycle:
1. **Red**: Write failing test
2. **Green**: Make it pass with minimal code
3. **Refactor**: Improve code while keeping tests green

This cycle ensures:
- You always know if code works (tests pass)
- You don't over-engineer (minimal code to pass)
- You can refactor safely (tests catch breakage)
