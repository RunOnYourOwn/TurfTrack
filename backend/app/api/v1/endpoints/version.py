"""
Version endpoint for TurfTrack API.
Provides version information and build details.
"""

from fastapi import APIRouter, HTTPException
from app.core.version import get_build_info

router = APIRouter()


@router.get("/version")
async def get_version():
    """
    Get version information for the TurfTrack application.

    Returns:
        dict: Version information including version number, build date, git info, and environment details
    """
    try:
        return get_build_info()
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve version information: {str(e)}"
        )
