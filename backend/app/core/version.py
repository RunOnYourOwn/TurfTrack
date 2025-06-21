"""
Version management module for TurfTrack backend.
Reads version from VERSION file and provides version information via API.
"""

import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, Any


def get_version() -> str:
    """
    Get the current version from VERSION file.

    Returns:
        str: Current version string

    Raises:
        FileNotFoundError: If VERSION file cannot be found
        ValueError: If VERSION file is empty or invalid
    """
    # Try multiple possible paths for the VERSION file
    possible_paths = [
        Path("VERSION"),  # Current directory
        Path("../VERSION"),  # Parent directory
        Path("../../VERSION"),  # Grandparent directory
        Path(__file__).parent.parent.parent.parent
        / "VERSION",  # Project root from backend
    ]

    version_file = None
    for path in possible_paths:
        if path.exists():
            version_file = path
            break

    if not version_file:
        raise FileNotFoundError("VERSION file not found in any expected location")

    try:
        with open(version_file, "r") as f:
            version = f.read().strip()

        if not version:
            raise ValueError("VERSION file is empty")

        return version
    except Exception as e:
        raise ValueError(f"Error reading VERSION file: {e}")


def get_git_info() -> Dict[str, str]:
    """
    Get git information for the current repository.

    Returns:
        Dict[str, str]: Dictionary containing git information
    """
    git_info = {"commit_hash": "unknown", "branch": "unknown", "tag": "unknown"}

    try:
        # Get current working directory
        cwd = Path.cwd()

        # Try to find git repository
        git_dir = None
        current_dir = cwd
        while current_dir != current_dir.parent:
            if (current_dir / ".git").exists():
                git_dir = current_dir
                break
            current_dir = current_dir.parent

        if not git_dir:
            return git_info

        # Get commit hash
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=git_dir,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                git_info["commit_hash"] = result.stdout.strip()[:8]  # Short hash
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        # Get current branch
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=git_dir,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                git_info["branch"] = result.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        # Get current tag
        try:
            result = subprocess.run(
                ["git", "describe", "--tags", "--exact-match"],
                cwd=git_dir,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                git_info["tag"] = result.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

    except Exception:
        pass

    return git_info


def get_build_info() -> Dict[str, Any]:
    """
    Get comprehensive build information.

    Returns:
        Dict[str, Any]: Dictionary containing build information
    """
    try:
        version = get_version()
    except (FileNotFoundError, ValueError):
        version = "unknown"

    git_info = get_git_info()

    return {
        "version": version,
        "build_date": datetime.utcnow().isoformat() + "Z",
        "git": git_info,
        "environment": {
            "python_version": f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}",
            "platform": os.sys.platform,
        },
    }


# Version info for easy access
__version__ = get_version()
