import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.core.logging_config import log_request_start, log_request_end, log_exception


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())

        # Add request ID to request state for use in other parts of the application
        request.state.request_id = request_id

        # Get request details
        method = request.method
        path = request.url.path
        query_params = str(request.query_params) if request.query_params else ""
        full_path = f"{path}?{query_params}" if query_params else path

        # Get client info
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        # Log request start
        log_request_start(
            request_id=request_id,
            method=method,
            path=full_path,
            client_ip=client_ip,
            user_agent=user_agent,
        )

        # Track timing
        start_time = time.time()

        try:
            # Process the request
            response = await call_next(request)

            # Calculate response time
            response_time = (time.time() - start_time) * 1000

            # Log request completion
            log_request_end(
                request_id=request_id,
                method=method,
                path=full_path,
                status_code=response.status_code,
                response_time_ms=response_time,
                client_ip=client_ip,
                user_agent=user_agent,
            )

            # Add request ID to response headers for debugging
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as exc:
            # Calculate response time
            response_time = (time.time() - start_time) * 1000

            # Log the exception
            log_exception(
                request_id=request_id,
                exc=exc,
                method=method,
                path=full_path,
                response_time_ms=response_time,
                client_ip=client_ip,
                user_agent=user_agent,
            )

            # Re-raise the exception
            raise
