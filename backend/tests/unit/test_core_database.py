import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db, Base


@pytest.mark.asyncio
async def test_get_db_success():
    """Test successful database session creation and cleanup."""
    mock_session = AsyncMock()
    mock_context = AsyncMock()
    mock_context.__aenter__.return_value = mock_session

    with patch("app.core.database.async_session_maker", return_value=mock_context):
        gen = get_db()
        async for session in gen:
            assert session == mock_session
            break
        await gen.aclose()  # Ensure generator is closed and __aexit__ is called
        mock_context.__aexit__.assert_called_once()


@pytest.mark.asyncio
async def test_get_db_session_error():
    """Test database session creation with error."""
    mock_context = AsyncMock()
    mock_context.__aenter__.side_effect = SQLAlchemyError("Database error")

    with patch("app.core.database.async_session_maker", return_value=mock_context):
        with pytest.raises(SQLAlchemyError):
            async for session in get_db():
                pass


@pytest.mark.asyncio
async def test_get_db_session_close_error():
    """Test database session cleanup with error."""
    mock_session = AsyncMock()
    mock_context = AsyncMock()
    mock_context.__aenter__.return_value = mock_session
    mock_context.__aexit__.side_effect = Exception("Exit error")

    with patch("app.core.database.async_session_maker", return_value=mock_context):
        # Should raise exception during cleanup
        gen = get_db()
        async for session in gen:
            assert session == mock_session
            break
        with pytest.raises(Exception, match="Exit error"):
            await gen.aclose()


def test_base_class():
    """Test that Base class is properly defined."""
    # Base should be a DeclarativeBase subclass
    from sqlalchemy.orm import DeclarativeBase

    assert issubclass(Base, DeclarativeBase)
