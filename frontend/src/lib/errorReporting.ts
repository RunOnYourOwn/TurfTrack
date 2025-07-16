/**
 * Frontend error reporting utility
 * Sends client-side errors to the backend for logging in Loki
 */

interface ErrorReport {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  requestId?: string;
  component?: string;
  action?: string;
}

class ErrorReporter {
  private apiUrl: string;

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || "";
  }

  /**
   * Report an error to the backend
   */
  async reportError(
    error: Error | string,
    context?: {
      component?: string;
      action?: string;
      requestId?: string;
    }
  ): Promise<void> {
    try {
      const errorReport: ErrorReport = {
        message: typeof error === "string" ? error : error.message,
        stack: error instanceof Error ? error.stack : undefined,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        requestId: context?.requestId,
        component: context?.component,
        action: context?.action,
      };

      // Send to backend (you'll need to create an endpoint for this)
      await fetch(`${this.apiUrl}/api/v1/logs/error`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(errorReport),
      });
    } catch (reportingError) {
      // Fallback to console if error reporting fails
      console.error("Failed to report error:", reportingError);
      console.error("Original error:", error);
    }
  }

  /**
   * Report a business event (user action)
   */
  async reportBusinessEvent(
    event: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const eventReport = {
        event,
        data,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      };

      await fetch(`${this.apiUrl}/api/v1/logs/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventReport),
      });
    } catch (error) {
      console.error("Failed to report business event:", error);
    }
  }

  /**
   * Set up global error handlers
   */
  setupGlobalHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.reportError(event.reason, {
        component: "global",
        action: "unhandled_promise_rejection",
      });
    });

    // Handle JavaScript errors
    window.addEventListener("error", (event) => {
      this.reportError(event.error || event.message, {
        component: "global",
        action: "javascript_error",
      });
    });
  }
}

// Create singleton instance
export const errorReporter = new ErrorReporter();

// Auto-setup global handlers in development
if (import.meta.env.DEV) {
  errorReporter.setupGlobalHandlers();
}

export default errorReporter;
