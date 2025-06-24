#!/bin/bash

# Tag release script for TurfTrack
# Usage: ./scripts/tag-release.sh
# Run this on main branch after PR merge to create and push the release tag

set -e

VERSION_FILE="VERSION"

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

# Function to create and push tag
tag_release() {
    print_info "Creating release tag..."

    # Check if we're on main branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$current_branch" != "main" ]; then
        print_error "This script should be run on the main branch (current: $current_branch)"
        print_info "Please checkout main: git checkout main"
        exit 1
    fi

    # Check if working directory is clean
    if [ -n "$(git status --porcelain)" ]; then
        print_error "Working directory is not clean. Please commit or stash changes first."
        exit 1
    fi

    # Get current version
    local version=$(get_current_version)
    local tag_name="v$version"

    # Check if tag already exists
    if git tag -l | grep -q "^$tag_name$"; then
        print_error "Tag $tag_name already exists"
        exit 1
    fi

    # Create annotated tag
    git tag -a "$tag_name" -m "Release version $version"

    # Push tag to all remotes
    print_info "Pushing tag to all remotes..."
    for remote in $(git remote); do
        print_info "  -> Pushing tag '$tag_name' to '$remote'"
        git push "$remote" "$tag_name"
    done

    print_success "Release tag $tag_name created and pushed to all remotes"
    print_info "Release is now live!"
}

# Main script logic
case $1 in
    "")
        tag_release
        ;;
    current)
        print_info "Current version: $(get_current_version)"
        ;;
    *)
        echo "Usage: $0 [current]"
        echo ""
        echo "Commands:"
        echo "  (no args)       Create and push release tag"
        echo "  current         Show current version"
        echo ""
        echo "Workflow:"
        echo "1. Ensure you're on main branch"
        echo "2. Ensure release PR has been merged"
        echo "3. Run this script: $0"
        echo ""
        echo "Note: This script should only be run on the main branch after a release PR is merged."
        ;;
esac 