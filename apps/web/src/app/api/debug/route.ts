import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';

  // 测试后端连通性
  let backendStatus = 'unknown';
  let backendResponse = null;

  try {
    const response = await fetch(`${API_BASE}/versions`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    backendStatus = `${response.status} ${response.statusText}`;
    if (response.ok) {
      backendResponse = await response.json();
    } else {
      backendResponse = await response.text();
    }
  } catch (error) {
    backendStatus = 'error';
    backendResponse = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    API_BASE_USED: API_BASE,
    NODE_ENV: process.env.NODE_ENV,
    backend: {
      url: `${API_BASE}/versions`,
      status: backendStatus,
      response: backendResponse,
    },
    timestamp: new Date().toISOString(),
  });
}
