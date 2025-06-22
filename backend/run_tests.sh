#!/bin/bash

# Test runner script for TurfTrack backend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
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

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  unit              Run unit tests only"
    echo "  integration       Run integration tests only"
    echo "  e2e               Run end-to-end tests only"
    echo "  all               Run all tests (default)"
    echo "  coverage          Run tests with coverage report"
    echo "  fast              Run tests without coverage (faster)"
    echo "  lint              Run linting checks"
    echo "  clean             Clean test artifacts"
    echo "  help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 unit           # Run only unit tests"
    echo "  $0 coverage       # Run all tests with coverage"
    echo "  $0 fast           # Run tests without coverage"
}

# Function to clean test artifacts
clean_tests() {
    print_status "Cleaning test artifacts..."
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name "*.pyc" -delete 2>/dev/null || true
    find . -type f -name "*.pyo" -delete 2>/dev/null || true
    rm -rf .pytest_cache 2>/dev/null || true
    rm -rf htmlcov 2>/dev/null || true
    rm -f coverage.xml 2>/dev/null || true
    rm -f .coverage 2>/dev/null || true
    print_success "Test artifacts cleaned"
}

# Function to run linting
run_lint() {
    print_status "Running linting checks..."
    python -m flake8 app/ tests/ --max-line-length=100 --ignore=E501,W503
    python -m black --check app/ tests/
    python -m isort --check-only app/ tests/
    print_success "Linting passed"
}

# Function to run tests
run_tests() {
    local test_type=$1
    local coverage_flag=$2
    
    print_status "Running $test_type tests..."
    
    if [ "$coverage_flag" = "true" ]; then
        python -m pytest tests/ -m "$test_type" --cov=app --cov-report=term-missing --cov-report=html:htmlcov --cov-report=xml:coverage.xml --cov-fail-under=80 -v
    else
        python -m pytest tests/ -m "$test_type" -v
    fi
    
    if [ $? -eq 0 ]; then
        print_success "$test_type tests passed"
    else
        print_error "$test_type tests failed"
        exit 1
    fi
}

# Main script logic
case "${1:-all}" in
    "unit")
        run_tests "unit" "false"
        ;;
    "integration")
        run_tests "integration" "false"
        ;;
    "e2e")
        run_tests "e2e" "false"
        ;;
    "all")
        run_tests "unit or integration or e2e" "false"
        ;;
    "coverage")
        run_tests "unit or integration or e2e" "true"
        ;;
    "fast")
        run_tests "unit or integration or e2e" "false"
        ;;
    "lint")
        run_lint
        ;;
    "clean")
        clean_tests
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    *)
        print_error "Unknown option: $1"
        show_usage
        exit 1
        ;;
esac 