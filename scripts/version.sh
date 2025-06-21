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
    
    if [ ! -f "$CHANGELOG_FILE" ]; then
        cat > "$CHANGELOG_FILE" << EOF
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

EOF
    fi
    
    # Add new version entry at the top (after Unreleased)
    if [ -f "$CHANGELOG_FILE" ]; then
        # Create temporary file
        local temp_file=$(mktemp)
        
        # Copy lines until "## [Unreleased]"
        awk '/^## \[Unreleased\]/ {print; next} /^## \[/ {exit} {print}' "$CHANGELOG_FILE" > "$temp_file"
        
        # Add new version entry
        echo "" >> "$temp_file"
        echo "## [$version] - $date" >> "$temp_file"
        echo "" >> "$temp_file"
        echo "### Added" >> "$temp_file"
        echo "- Initial release" >> "$temp_file"
        echo "" >> "$temp_file"
        
        # Add remaining content
        awk '/^## \[Unreleased\]/ {next} /^## \[/ {p=1} p' "$CHANGELOG_FILE" >> "$temp_file"
        
        # Replace original file
        mv "$temp_file" "$CHANGELOG_FILE"
    fi
}

# Function to create release
release() {
    local version=$(get_current_version)
    local tag_name="v$version"
    
    print_info "Creating release for version $version"
    
    # Check if working directory is clean
    if [ -n "$(git status --porcelain)" ]; then
        print_error "Working directory is not clean. Please commit or stash changes first."
        exit 1
    fi
    
    # Create changelog entry
    create_changelog_entry "$version"
    
    # Commit version changes
    git add "$VERSION_FILE" "$CHANGELOG_FILE"
    git commit -m "Release version $version"
    
    # Create and push tag
    git tag -a "$tag_name" -m "Release version $version"
    git push origin "$tag_name"
    
    print_success "Release $version created and pushed"
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
        release
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
        echo "  release         Create release with current version"
        echo "  current         Show current version"
        echo ""
        echo "Examples:"
        echo "  $0 bump patch    # 1.0.0 -> 1.0.1"
        echo "  $0 bump minor    # 1.0.1 -> 1.1.0"
        echo "  $0 bump major    # 1.1.0 -> 2.0.0"
        echo "  $0 set 0.0.1     # Set version to 0.0.1"
        echo "  $0 release       # Create release with current version"
        exit 1
        ;;
esac 