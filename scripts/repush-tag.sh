#!/bin/bash

# Re-push latest tag script for TurfTrack
# Usage: ./scripts/repush-tag.sh [tag_name]
# Run this to re-push a tag to all remotes

set -e

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

# Function to get latest tag
get_latest_tag() {
    local latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -z "$latest_tag" ]; then
        print_error "No tags found in repository"
        exit 1
    fi
    echo "$latest_tag"
}

# Function to validate tag exists locally
validate_tag() {
    local tag=$1
    if ! git tag -l | grep -q "^$tag$"; then
        print_error "Tag '$tag' does not exist locally"
        print_info "Available tags:"
        git tag -l | sort -V | tail -10
        exit 1
    fi
}

# Function to re-push tag
repush_tag() {
    local tag_name=$1
    
    print_info "Re-pushing tag '$tag_name' to all remotes..."
    
    # Check if working directory is clean
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "Working directory is not clean, but continuing with tag push..."
    fi
    
    # Push tag to all remotes
    local push_success=true
    for remote in $(git remote); do
        print_info "  -> Pushing tag '$tag_name' to '$remote'"
        if git push "$remote" "$tag_name" 2>/dev/null; then
            print_success "    ✓ Successfully pushed to $remote"
        else
            print_error "    ✗ Failed to push to $remote"
            push_success=false
        fi
    done
    
    if [ "$push_success" = true ]; then
        print_success "Tag '$tag_name' successfully pushed to all remotes"
    else
        print_warning "Tag push completed with some failures"
        print_info "You may need to check remote permissions or network connectivity"
        exit 1
    fi
}

# Main script logic
case $1 in
    "")
        # No tag specified, use latest
        latest_tag=$(get_latest_tag)
        print_info "Using latest tag: $latest_tag"
        repush_tag "$latest_tag"
        ;;
    current)
        latest_tag=$(get_latest_tag)
        print_info "Latest tag: $latest_tag"
        ;;
    *)
        # Tag specified
        validate_tag "$1"
        repush_tag "$1"
        ;;
esac 