import type { ApiErrorResponse } from "../../types";

/**
 * Creates a JSON Response with proper Content-Type header.
 * @param data - The data to serialize as JSON body
 * @param status - HTTP status code (default: 200)
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates a standardized error Response following the ApiErrorResponse format.
 * @param code - Application-level error code (e.g. "UNAUTHORIZED", "VALIDATION_ERROR")
 * @param message - Human-readable error message
 * @param status - HTTP status code (default: 400)
 * @param details - Optional field-level validation errors
 */
export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: Array<{ field: string; message: string }>
): Response {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
