#!/bin/bash

# Version management script for TurfTrack
# Usage: ./scripts/version.sh [bump|set|release] [version]

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

# Function to set specific version
set_version() {
    local new_version=$1
    validate_version "$new_version"
    local current_version=$(get_current_version)
    
    echo "$new_version" > "$VERSION_FILE"
    print_success "Version set from $current_version to $new_version"
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

# Function to create release
release() {
    local bump_type=$1
    if [ -z "$bump_type" ]; then
        print_error "Release type required. Use: patch, minor, or major"
        exit 1
    fi

    print_info "Starting '$bump_type' release..."

    # Check if working directory is clean
    if [ -n "$(git status --porcelain)" ]; then
        print_error "Working directory is not clean. Please commit or stash changes first."
        exit 1
    fi
    
    # Bump version
    local current_version=$(get_current_version)
    bump_version "$bump_type"
    local new_version=$(get_current_version)
    local tag_name="v$new_version"
    
    # Create changelog entry
    create_changelog_entry "$new_version"
    
    # Commit version and changelog changes
    git add "$VERSION_FILE" "$CHANGELOG_FILE"
    git commit -m "chore(release): Prepare for v$new_version" -m "Bumps version from $current_version to $new_version and updates changelog."
    
    # Create and push tag
    git tag -a "$tag_name" -m "Release version $new_version"

    # Push commit and tag to all remotes
    print_info "Pushing to all remotes..."
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    for remote in $(git remote); do
        print_info "  -> Pushing branch '$current_branch' to '$remote'"
        git push "$remote" "$current_branch"
        print_info "  -> Pushing tag '$tag_name' to '$remote'"
        git push "$remote" "$tag_name"
    done
    
    print_success "Release $new_version created and pushed to all remotes"
    print_info "Tag: $tag_name"
}

# Main script logic
case $1 in
    bump)
        if [ -z "$2" ]; then
            print_error "Bump type required. Use: major, minor, or patch"
            exit 1
        fi
        bump_version "$2"
        ;;
    set)
        if [ -z "$2" ]; then
            print_error "Version number required"
            exit 1
        fi
        set_version "$2"
        ;;
    release)
        if [ -z "$2" ]; then
            print_error "Release type required. Use: patch, minor, or major"
            exit 1
        fi
        release "$2"
        ;;
    current)
        print_info "Current version: $(get_current_version)"
        ;;
    *)
        echo "Usage: $0 {bump|set|release|current} [version|bump_type]"
        echo ""
        echo "Commands:"
        echo "  bump <type>     Bump version (major|minor|patch)"
        echo "  set <version>   Set specific version (e.g., 1.0.0)"
        echo "  release <type>  Create and push a new release (major|minor|patch)"
        echo "  current         Show current version"
        echo ""
        echo "Examples:"
        echo "  $0 bump patch    # 1.0.0 -> 1.0.1"
        echo "  $0 bump minor    # 1.0.1 -> 1.1.0"
        echo "  $0 bump major    # 1.1.0 -> 2.0.0"
        echo "  $0 set 0.0.1     # Set version to 0.0.1"
        echo "  $0 release patch # Bumps patch version and creates release"
        exit 1
        ;;
esac 