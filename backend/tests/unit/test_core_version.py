import pytest
from unittest.mock import patch, mock_open, MagicMock
from pathlib import Path
import subprocess
from app.core.version import get_version, get_git_info, get_build_info, __version__


def test_get_version_success():
    """Test successful version retrieval from VERSION file."""
    with patch("builtins.open", mock_open(read_data="1.2.3")):
        with patch("pathlib.Path.exists", return_value=True):
            version = get_version()
            assert version == "1.2.3"


def test_get_version_file_not_found():
    """Test version retrieval when VERSION file is not found."""
    with patch("pathlib.Path.exists", return_value=False):
        with pytest.raises(FileNotFoundError, match="VERSION file not found"):
            get_version()


def test_get_version_empty_file():
    """Test version retrieval when VERSION file is empty."""
    with patch("builtins.open", mock_open(read_data="")):
        with patch("pathlib.Path.exists", return_value=True):
            with pytest.raises(ValueError, match="VERSION file is empty"):
                get_version()


def test_get_version_whitespace_only():
    """Test version retrieval when VERSION file contains only whitespace."""
    with patch("builtins.open", mock_open(read_data="   \n\t  ")):
        with patch("pathlib.Path.exists", return_value=True):
            with pytest.raises(ValueError, match="VERSION file is empty"):
                get_version()


def test_get_version_file_read_error():
    """Test version retrieval when file read fails."""
    with patch("builtins.open", side_effect=PermissionError("Access denied")):
        with patch("pathlib.Path.exists", return_value=True):
            with pytest.raises(ValueError, match="Error reading VERSION file"):
                get_version()


def test_get_version_strips_whitespace():
    """Test that version string is properly stripped of whitespace."""
    with patch("builtins.open", mock_open(read_data="  1.2.3  \n")):
        with patch("pathlib.Path.exists", return_value=True):
            version = get_version()
            assert version == "1.2.3"


@patch("subprocess.run")
def test_get_git_info_success(mock_run):
    """Test successful git info retrieval."""
    # Mock successful git commands
    mock_run.side_effect = [
        MagicMock(returncode=0, stdout="abc12345\n"),  # commit hash
        MagicMock(returncode=0, stdout="main\n"),  # branch
        MagicMock(returncode=0, stdout="v1.2.3\n"),  # tag
    ]

    with patch("pathlib.Path.cwd", return_value=Path("/test/repo")):
        with patch("pathlib.Path.exists", return_value=True):
            git_info = get_git_info()

            assert git_info["commit_hash"] == "abc12345"
            assert git_info["branch"] == "main"
            assert git_info["tag"] == "v1.2.3"


@patch("subprocess.run")
def test_get_git_info_no_git_dir(mock_run):
    """Test git info when no .git directory is found."""
    with patch("pathlib.Path.cwd", return_value=Path("/test/repo")):
        with patch("pathlib.Path.exists", return_value=False):
            git_info = get_git_info()

            assert git_info["commit_hash"] == "unknown"
            assert git_info["branch"] == "unknown"
            assert git_info["tag"] == "unknown"


@patch("subprocess.run")
def test_get_git_info_git_not_found(mock_run):
    """Test git info when git command is not found."""
    mock_run.side_effect = FileNotFoundError("git command not found")

    with patch("pathlib.Path.cwd", return_value=Path("/test/repo")):
        with patch("pathlib.Path.exists", return_value=True):
            git_info = get_git_info()

            assert git_info["commit_hash"] == "unknown"
            assert git_info["branch"] == "unknown"
            assert git_info["tag"] == "unknown"


@patch("subprocess.run")
def test_get_git_info_timeout(mock_run):
    """Test git info when git commands timeout."""
    mock_run.side_effect = subprocess.TimeoutExpired("git", 5)

    with patch("pathlib.Path.cwd", return_value=Path("/test/repo")):
        with patch("pathlib.Path.exists", return_value=True):
            git_info = get_git_info()

            assert git_info["commit_hash"] == "unknown"
            assert git_info["branch"] == "unknown"
            assert git_info["tag"] == "unknown"


@patch("subprocess.run")
def test_get_git_info_partial_failure(mock_run):
    """Test git info when some git commands fail."""
    mock_run.side_effect = [
        MagicMock(returncode=0, stdout="abc12345\n"),  # commit hash succeeds
        MagicMock(returncode=1, stdout=""),  # branch fails
        MagicMock(returncode=128, stdout=""),  # tag fails (no tag)
    ]

    with patch("pathlib.Path.cwd", return_value=Path("/test/repo")):
        with patch("pathlib.Path.exists", return_value=True):
            git_info = get_git_info()

            assert git_info["commit_hash"] == "abc12345"
            assert git_info["branch"] == "unknown"
            assert git_info["tag"] == "unknown"


@patch("app.core.version.get_version")
@patch("app.core.version.get_git_info")
def test_get_build_info_success(mock_get_git_info, mock_get_version):
    """Test successful build info generation."""
    mock_get_version.return_value = "1.2.3"
    mock_get_git_info.return_value = {
        "commit_hash": "abc12345",
        "branch": "main",
        "tag": "v1.2.3",
    }

    build_info = get_build_info()

    assert build_info["version"] == "1.2.3"
    assert "build_date" in build_info
    assert build_info["git"]["commit_hash"] == "abc12345"
    assert build_info["git"]["branch"] == "main"
    assert build_info["git"]["tag"] == "v1.2.3"
    assert "environment" in build_info


@patch("app.core.version.get_version")
@patch("app.core.version.get_git_info")
def test_get_build_info_version_error(mock_get_git_info, mock_get_version):
    """Test build info when version retrieval fails."""
    mock_get_version.side_effect = FileNotFoundError("VERSION file not found")
    mock_get_git_info.return_value = {
        "commit_hash": "abc12345",
        "branch": "main",
        "tag": "v1.2.3",
    }

    build_info = get_build_info()

    assert build_info["version"] == "unknown"
    assert "build_date" in build_info
    assert build_info["git"]["commit_hash"] == "abc12345"


@patch("app.core.version.get_version")
@patch("app.core.version.get_git_info")
def test_get_build_info_all_unknown_git(mock_get_git_info, mock_get_version):
    """Test build info when all git info is unknown."""
    mock_get_version.return_value = "1.2.3"
    mock_get_git_info.return_value = {
        "commit_hash": "unknown",
        "branch": "unknown",
        "tag": "unknown",
    }

    build_info = get_build_info()

    assert build_info["version"] == "1.2.3"
    assert "build_date" in build_info
    assert "git" not in build_info  # Should not include git if all unknown
    assert "environment" in build_info


@patch("app.core.version.get_version")
@patch("app.core.version.get_git_info")
def test_get_build_info_partial_git(mock_get_git_info, mock_get_version):
    """Test build info when some git info is available."""
    mock_get_version.return_value = "1.2.3"
    mock_get_git_info.return_value = {
        "commit_hash": "abc12345",
        "branch": "unknown",
        "tag": "unknown",
    }

    build_info = get_build_info()

    assert build_info["version"] == "1.2.3"
    assert "build_date" in build_info
    assert (
        "git" in build_info
    )  # Should include git if at least one value is not unknown
    assert build_info["git"]["commit_hash"] == "abc12345"


@patch("app.core.version.get_version")
def test___version___success(mock_get_version):
    """Test __version__ function."""
    mock_get_version.return_value = "1.2.3"

    version = __version__()

    assert version == "1.2.3"
    mock_get_version.assert_called_once()
