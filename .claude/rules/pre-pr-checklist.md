# Pre-PR Checklist - TurfTrack

Complete this checklist **before pushing your branch**. If any item fails, fix it first.

## 1. Tests
- [ ] **TDD workflow followed** - Tests written first, committed separately
- [ ] **All backend tests pass**: `cd backend && ./run_tests.sh`
- [ ] **Coverage >= 80%**: `cd backend && ./run_tests.sh coverage`
- [ ] **New endpoints have tests** - Unit and integration tests
- [ ] **Tests are meaningful** - Not just smoke tests

## 2. Code Quality - Backend
- [ ] **Linting passes**: `cd backend && ./run_tests.sh lint`
- [ ] **Black formatted** - Consistent code style
- [ ] **isort organized** - Imports sorted correctly
- [ ] **flake8 clean** - No lint warnings
- [ ] **No `any` type hints** - Use proper Python types

## 3. Code Quality - Frontend
- [ ] **ESLint passes**: `cd frontend && npm run lint`
- [ ] **TypeScript builds**: `cd frontend && npm run build`
- [ ] **No `any` types** - Proper TypeScript definitions
- [ ] **shadcn/ui components used** - Don't reinvent existing components

## 4. Database
- [ ] **Migration created** - If schema changes: `alembic revision --autogenerate -m "description"`
- [ ] **Migration tested** - `alembic upgrade head` succeeds
- [ ] **No raw SQL** - Use SQLAlchemy 2.0 query API
- [ ] **Models have timestamps** - `created_at`/`updated_at` on all models

## 5. API Design
- [ ] **Pydantic schemas** - Create/Read/Update pattern followed
- [ ] **Async endpoints** - All handlers are async
- [ ] **Error responses** - Proper HTTP status codes and error messages
- [ ] **Input validation** - Pydantic handles validation

## 6. Security
- [ ] **No secrets in code** - Check for hardcoded keys, tokens, passwords
- [ ] **Input validation** - Pydantic schemas validate all input
- [ ] **SQL injection safe** - SQLAlchemy parameterized queries only
- [ ] **No XSS vectors** - React handles output encoding
- [ ] **CORS configured** - Check `middleware/security.py`

## 7. Frontend
- [ ] **Pages lazy-loaded** - React.lazy + Suspense for new pages
- [ ] **TanStack Query** - API calls use query hooks, not raw fetch/axios
- [ ] **Dark mode works** - Test both light and dark themes
- [ ] **Responsive layout** - Test mobile and desktop views

## 8. Documentation
- [ ] **CLAUDE.md updated** - If adding major features or patterns
- [ ] **README.md updated** - If changing setup or architecture
- [ ] **CHANGELOG.md updated** - Add entry under [Unreleased]
- [ ] **Code comments** - Complex algorithms explained

## 9. Git Hygiene
- [ ] **Descriptive commit messages** - Explain what and why
- [ ] **Logical commits** - One feature/fix per commit (when possible)
- [ ] **No merge conflicts** - Rebase on latest main
- [ ] **Co-Authored-By line** - Include when AI-assisted

## 10. CI/CD
- [ ] **All CI checks pass** - Wait for GitHub Actions
- [ ] **Docker builds** - `docker compose up --build` succeeds
- [ ] **No CI workarounds** - Don't merge if checks fail

## Quick Pre-PR Commands

```bash
# Backend checks
cd backend && ./run_tests.sh              # All tests pass
cd backend && ./run_tests.sh lint          # Linting clean
cd backend && ./run_tests.sh coverage      # Coverage >= 80%

# Frontend checks
cd frontend && npm run lint                # ESLint clean
cd frontend && npm run build               # TypeScript + Vite build

# Docker check
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

# Git checks
git status                                 # No uncommitted changes
git log --oneline -5                       # Review recent commits
git diff main                              # Review all changes
```

## PR Review Checklist (For Reviewers)

### Code Quality
- [ ] TDD workflow followed (tests committed separately)
- [ ] Tests comprehensive and meaningful
- [ ] Backend async patterns followed
- [ ] Frontend TypeScript strict
- [ ] No performance regressions

### Critical Issues to Block
- **Missing tests** for new endpoints or features
- **SQL injection** or raw SQL usage
- **Hardcoded secrets** in code
- **Missing migrations** for schema changes
- **Broken TypeScript build**
- **Missing input validation**

### Request Changes If
- Tests missing edge cases or error paths
- Code overly complex without justification
- Documentation missing or outdated
- Pydantic schemas not following Create/Read/Update pattern
