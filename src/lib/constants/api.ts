/**
 * API Endpoint Constants
 */

// FastAPI Base URL (from .env.local)
export const FASTAPI_BASE_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

// FastAPI Endpoints
export const FASTAPI_ENDPOINTS = {
  CHAT_COMPLETION: '/chat/completion',
  SYNC_EMBEDDINGS: '/sync_embeddings',
} as const;

// Full URLs
export const getApiUrl = (endpoint: string) => `${FASTAPI_BASE_URL}${endpoint}`;
