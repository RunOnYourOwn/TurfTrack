#!/bin/bash

# Prepare release script for TurfTrack
# Usage: ./scripts/prepare-release.sh [bump_type]
# Run this on a release branch to prepare for release

set -e

VERSION_FILE="VERSION"
CHANGELOG_FILE="CHANGELOG.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get current version
get_current_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE" | tr -d ' \t\n\r'
    else
        print_error "VERSION file not found"
        exit 1
    fi
}

# Function to validate version format
validate_version() {
    local version=$1
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_error "Invalid version format. Use semantic versioning (e.g., 1.0.0)"
        exit 1
    fi
}

# Function to bump version
bump_version() {
    local bump_type=$1
    local current_version=$(get_current_version)
    local major minor patch
    
    IFS='.' read -r major minor patch <<< "$current_version"
    
    case $bump_type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            print_error "Invalid bump type. Use: major, minor, or patch"
            exit 1
            ;;
    esac
    
    local new_version="$major.$minor.$patch"
    echo "$new_version" > "$VERSION_FILE"
    print_success "Version bumped from $current_version to $new_version"
}

# Function to create changelog entry
create_changelog_entry() {
    local version=$1
    local date=$(date +"%Y-%m-%d")

    # Replace the [Unreleased] line with the new version and date
    sed -i '' "s/## \[Unreleased\]/## [$version] - $date/" "$CHANGELOG_FILE"

    # Add a new, empty [Unreleased] section back at the top, after the header.
    # This syntax with literal newlines is compatible with both macOS and GNU sed.
    sed -i '' '/semver.org/a \
\
## [Unreleased]\
\
### Added\
\
### Fixed\
\
### Changed' "$CHANGELOG_FILE"
}

# Function to prepare release
prepare_release() {
    local bump_type=$1
    if [ -z "$bump_type" ]; then
        print_error "Release type required. Use: patch, minor, or major"
        exit 1
    fi

    print_info "Preparing '$bump_type' release..."

    # Check if working directory is clean
    if [ -n "$(git status --porcelain)" ]; then
        print_error "Working directory is not clean. Please commit or stash changes first."
        exit 1
    fi
    
    # Check if we're on a release branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ ! "$current_branch" =~ ^release/ ]]; then
        print_warning "You're not on a release branch (current: $current_branch)"
        print_info "Consider creating a release branch: git checkout -b release/vX.Y.Z"
    fi
    
    # Bump version
    local current_version=$(get_current_version)
    bump_version "$bump_type"
    local new_version=$(get_current_version)
    
    # Create changelog entry
    create_changelog_entry "$new_version"
    
    # Commit version and changelog changes
    git add "$VERSION_FILE" "$CHANGELOG_FILE"
    git commit -m "chore(release): Prepare for v$new_version" -m "Bumps version from $current_version to $new_version and updates changelog."
    
    print_success "Release preparation complete for v$new_version"
    print_info "Next steps:"
    print_info "1. Push this branch: git push origin $current_branch"
    print_info "2. Create PR to main"
    print_info "3. After PR merge, run: ./scripts/tag-release.sh"
}

# Main script logic
case $1 in
    patch|minor|major)
        prepare_release "$1"
        ;;
    current)
        print_info "Current version: $(get_current_version)"
        ;;
    *)
        echo "Usage: $0 {patch|minor|major|current}"
        echo ""
        echo "Commands:"
        echo "  patch           Prepare patch release (0.0.4 -> 0.0.5)"
        echo "  minor           Prepare minor release (0.0.5 -> 0.1.0)"
        echo "  major           Prepare major release (0.1.0 -> 1.0.0)"
        echo "  current         Show current version"
        echo ""
        echo "Workflow:"
        echo "1. Create release branch: git checkout -b release/vX.Y.Z"
        echo "2. Run this script: $0 patch"
        echo "3. Push branch and create PR to main"
        echo "4. After PR merge, run: ./scripts/tag-release.sh"
        ;;
esac 