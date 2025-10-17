import { NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

/**
 * Standard API response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Create a successful API response
 *
 * @param data - Response data
 * @param message - Optional success message
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with success format
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

/**
 * Create an error API response
 *
 * @param error - Error message
 * @param status - HTTP status code (default: 500)
 * @returns NextResponse with error format
 */
export function errorResponse(
  error: string,
  status: number = 500
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

/**
 * Create a paginated API response
 *
 * @param data - Array of items
 * @param page - Current page number
 * @param limit - Items per page
 * @param total - Total number of items
 * @param message - Optional message
 * @returns NextResponse with paginated format
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): NextResponse<PaginatedResponse<T>> {
  const totalPages = Math.ceil(total / limit);

  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
    { status: 200 }
  );
}

/**
 * Validate request body against a Zod schema
 *
 * @param body - Request body to validate
 * @param schema - Zod schema for validation
 * @returns Validation result with typed data or error
 */
export function validateRequest<T>(
  body: unknown,
  schema: ZodSchema<T>
): {
  valid: boolean;
  data?: T;
  error?: string;
} {
  try {
    const data = schema.parse(body);
    return {
      valid: true,
      data,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.errors.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      return {
        valid: false,
        error: errorMessages.join(', '),
      };
    }
    return {
      valid: false,
      error: 'Validation failed',
    };
  }
}

/**
 * Handle API errors consistently
 * Converts various error types to appropriate HTTP responses
 *
 * @param error - Error object
 * @returns NextResponse with appropriate error message and status
 */
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error('API Error:', error);

  // Mongoose validation error
  if (error && typeof error === 'object' && 'name' in error && error.name === 'ValidationError') {
    return errorResponse('Validation error: Invalid data provided', 400);
  }

  // Mongoose duplicate key error
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
    return errorResponse('Duplicate entry: Resource already exists', 409);
  }

  // Mongoose cast error (invalid ObjectId)
  if (error && typeof error === 'object' && 'name' in error && error.name === 'CastError') {
    return errorResponse('Invalid ID format', 400);
  }

  // Standard Error object
  if (error instanceof Error) {
    return errorResponse(error.message, 500);
  }

  // Unknown error
  return errorResponse('An unexpected error occurred', 500);
}

/**
 * Parse pagination parameters from URL search params
 *
 * @param searchParams - URL search params
 * @returns Parsed page and limit with defaults
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Extract search/filter parameters from URL
 *
 * @param searchParams - URL search params
 * @param allowedFields - Array of allowed field names for filtering
 * @returns Object with filter parameters
 */
export function parseFilterParams(
  searchParams: URLSearchParams,
  allowedFields: string[]
): Record<string, string> {
  const filters: Record<string, string> = {};

  allowedFields.forEach((field) => {
    const value = searchParams.get(field);
    if (value) {
      filters[field] = value;
    }
  });

  return filters;
}

/**
 * Build MongoDB query from filter parameters
 * Supports exact match, regex search, and range queries
 *
 * @param filters - Filter parameters
 * @returns MongoDB query object
 */
export function buildMongoQuery(filters: Record<string, any>): Record<string, any> {
  const query: Record<string, any> = {};

  Object.entries(filters).forEach(([key, value]) => {
    // Handle search (case-insensitive regex)
    if (key.endsWith('_search')) {
      const field = key.replace('_search', '');
      query[field] = { $regex: value, $options: 'i' };
    }
    // Handle range queries (gte, lte)
    else if (key.endsWith('_gte')) {
      const field = key.replace('_gte', '');
      query[field] = { ...query[field], $gte: value };
    } else if (key.endsWith('_lte')) {
      const field = key.replace('_lte', '');
      query[field] = { ...query[field], $lte: value };
    }
    // Exact match
    else {
      query[key] = value;
    }
  });

  return query;
}
