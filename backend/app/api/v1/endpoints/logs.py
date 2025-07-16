from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.core.logging_config import get_logger

router = APIRouter(prefix="/logs", tags=["logs"])

logger = get_logger("api.logs")


class ErrorReport(BaseModel):
    message: str
    stack: Optional[str] = None
    url: str
    userAgent: str
    timestamp: str
    requestId: Optional[str] = None
    component: Optional[str] = None
    action: Optional[str] = None


class BusinessEvent(BaseModel):
    event: str
    data: Optional[Dict[str, Any]] = None
    url: str
    timestamp: str


@router.post("/error")
async def log_frontend_error(error_report: ErrorReport, request: Request):
    """Log frontend errors for monitoring and debugging."""
    request_id = getattr(request.state, "request_id", None)

    logger.error(
        f"Frontend error: {error_report.message}",
        extra={
            "frontend_error": True,
            "error_message": error_report.message,
            "error_stack": error_report.stack,
            "url": error_report.url,
            "user_agent": error_report.userAgent,
            "component": error_report.component,
            "action": error_report.action,
            "frontend_request_id": error_report.requestId,
            "backend_request_id": request_id,
            "timestamp": error_report.timestamp,
        },
    )

    return {"status": "logged"}


@router.post("/event")
async def log_business_event(event: BusinessEvent, request: Request):
    """Log frontend business events for analytics."""
    request_id = getattr(request.state, "request_id", None)

    logger.info(
        f"Frontend business event: {event.event}",
        extra={
            "frontend_event": True,
            "event_type": event.event,
            "event_data": event.data,
            "url": event.url,
            "backend_request_id": request_id,
            "timestamp": event.timestamp,
        },
    )

    return {"status": "logged"}
