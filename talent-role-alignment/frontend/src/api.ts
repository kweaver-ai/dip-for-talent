import type { Organization } from './context/OrganizationContext';

export type ApiResult<T> = {
  data: T;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getOrganizations() {
  return request<ApiResult<Organization[]>>('/api/organizations');
}

export function getMock(resource: 'job_fit', params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  return request<ApiResult<Record<string, unknown>>>(`/api/mock/${resource}${query}`);
}

export function generateAction(payload: { object_type: string; object_id: string; action_type: string }) {
  return request<ApiResult<{ action_id: string; expected_impact: string }>>('/api/action/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listActions(orgId?: string) {
  const query = orgId ? `?org_id=${orgId}` : '';
  return request<
    ApiResult<
      {
        id: string;
        target_object_type: string;
        target_object_id: string;
        action_type: string;
        status: string;
        expected_impact: string;
        assignee?: string;
        due_date?: string;
        progress?: number;
        title?: string;
        effort?: string;
        execution_method?: string;
      }[]
    >
  >(`/api/actions${query}`);
}

export function updateAction(payload: {
  id: string;
  status?: string;
  assignee?: string;
  due_date?: string;
  progress?: number;
  title?: string;
  expected_impact?: string;
  effort?: string;
  execution_method?: string;
}) {
  return request<
    ApiResult<{
      id: string;
      status: string;
      assignee?: string;
      due_date?: string;
      progress?: number;
      title?: string;
      expected_impact?: string;
      effort?: string;
      execution_method?: string;
    }>
  >('/api/action/update', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function simulateJobFit(payload: { employee: string; role: string; org_id: string }) {
  return request<ApiResult<{ match: number; performance: number; risk: number; reason: string }>>(
    '/api/simulate/jobfit',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}
