export const ADMIN_API_BASE = 'https://api.clicknich.com/api/superadmin'

export const ADMIN_TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'

export function adminHeaders(userId: string): HeadersInit {
    return {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
        'x-user-id': userId,
    }
}

export async function adminFetch(
    path: string,
    userId: string,
    init?: RequestInit,
): Promise<Response> {
    return fetch(`${ADMIN_API_BASE}${path}`, {
        ...init,
        headers: {
            ...adminHeaders(userId),
            ...(init?.headers ?? {}),
        },
    })
}
