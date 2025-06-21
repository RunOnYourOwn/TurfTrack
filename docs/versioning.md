# Version Management System

This document describes the version management system for TurfTrack, including how to use the versioning tools and best practices for releases.

## Overview

TurfTrack uses a centralized version management system with the following components:

- **VERSION file**: Single source of truth for the current version
- **Version script**: Automated version management (`scripts/version.sh`)
- **Backend version module**: API endpoint for version information
- **Frontend version utility**: Version display and comparison tools
- **Changelog**: Automated changelog management

## Version Format

We follow [Semantic Versioning](https://semver.org/) (SemVer) format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes, incompatible API changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

## Version Management Script

The `scripts/version.sh` script provides automated version management:

### Commands

#### Show Current Version

```bash
./scripts/version.sh current
```

#### Set Specific Version

```bash
./scripts/version.sh set 1.0.0
```

#### Bump Version

```bash
# Bump patch version (1.0.0 -> 1.0.1)
./scripts/version.sh bump patch

# Bump minor version (1.0.1 -> 1.1.0)
./scripts/version.sh bump minor

# Bump major version (1.1.0 -> 2.0.0)
./scripts/version.sh bump major
```

#### Create Release

```bash
./scripts/version.sh release
```

The release command:

1. Creates a changelog entry for the current version
2. Commits version changes to git
3. Creates and pushes a git tag
4. Updates the changelog

## Backend Version API

The backend provides version information via the `/api/v1/version` endpoint:

```json
{
  "version": "0.0.1",
  "build_date": "2024-12-19T10:30:00Z",
  "git": {
    "commit_hash": "14dd339",
    "branch": "main",
    "tag": "v0.0.1"
  },
  "environment": {
    "python_version": "3.11.0",
    "platform": "linux"
  }
}
```

## Frontend Version Utilities

The frontend includes utilities for version management:

```typescript
import {
  fetchBackendVersion,
  getFrontendVersion,
  formatVersion,
  compareVersions,
} from "@/lib/version";

// Fetch backend version
const backendVersion = await fetchBackendVersion();

// Get frontend version with backend info
const frontendVersion = await getFrontendVersion(true);

// Format version for display
const displayVersion = formatVersion(backendVersion);

// Compare versions
const isNewer = compareVersions("1.1.0", "1.0.0") > 0;
```

## Release Workflow

### Standard Release Process

1. **Prepare for release**:

   ```bash
   # Ensure working directory is clean
   git status

   # Bump version as needed
   ./scripts/version.sh bump minor  # or patch/major
   ```

2. **Create release**:

   ```bash
   ./scripts/version.sh release
   ```

3. **Rebuild and deploy**:

   ```bash
   # Rebuild backend container to reflect new version
   docker-compose -f docker-compose.dev.yml build backend
   docker-compose -f docker-compose.dev.yml up -d backend
   ```

4. **Verify release**:
   ```bash
   # Check version endpoint
   curl http://localhost:8000/api/v1/version
   ```

### Emergency Version Reset

If you need to reset to a previous version:

1. **Delete remote tag**:

   ```bash
   git tag -d v1.1.0
   git push origin :refs/tags/v1.1.0
   ```

2. **Reset to previous commit**:

   ```bash
   git reset --hard <commit-hash>
   git push --force
   ```

3. **Set new version**:

   ```bash
   ./scripts/version.sh set 0.0.1
   ```

4. **Create new release**:
   ```bash
   ./scripts/version.sh release
   ```

## Best Practices

### Version Bumping Guidelines

- **Patch (0.0.x)**: Bug fixes, minor improvements
- **Minor (0.x.0)**: New features, significant improvements
- **Major (x.0.0)**: Breaking changes, major refactoring

### Commit Messages

Use conventional commit messages:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for test changes
- `chore:` for maintenance tasks

### Release Notes

Always update the changelog with meaningful descriptions:

- What was added/changed/fixed
- Breaking changes (if any)
- Migration notes (if needed)

### Testing

Before creating a release:

1. Run all tests
2. Test the version endpoint
3. Verify changelog entries
4. Check that git tags are correct

## Troubleshooting

### Common Issues

**VERSION file not found in container**:

- Ensure VERSION file is copied in Dockerfile
- Check file paths in version module

**Git information not available**:

- Ensure .git directory is accessible
- Check git command availability in container

**Version endpoint returns 404**:

- Verify version endpoint is registered in router
- Check API route configuration

### Debug Commands

```bash
# Check current version
cat VERSION

# Test version script
./scripts/version.sh current

# Check git status
git status
git log --oneline -5

# Test version endpoint
curl http://localhost:8000/api/v1/version
```

## Integration with CI/CD

The version system can be integrated with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Bump version
  run: ./scripts/version.sh bump patch

- name: Create release
  run: ./scripts/version.sh release

- name: Build and deploy
  run: |
    docker-compose build
    docker-compose push
```

## Security Considerations

- Version information is public and should not contain sensitive data
- Git commit hashes are truncated for security
- Build dates use UTC to avoid timezone issues
- Version validation prevents injection attacks
