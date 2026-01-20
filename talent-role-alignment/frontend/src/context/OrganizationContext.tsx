import React, { createContext, useContext } from 'react';

export type OrganizationMetrics = {
  roi: number;
  health_score: number;
  job_fit?: number;
};

export type Organization = {
  id: string;
  name: string;
  parent_id: string | null;
  level: 'group' | 'bu' | 'department';
  metrics: OrganizationMetrics;
};

type OrganizationContextValue = {
  organizations: Organization[];
  selectedOrgId: string;
  setSelectedOrgId: (id: string) => void;
  setOrganizations: (orgs: Organization[]) => void;
};

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({
  value,
  children,
}: {
  value: OrganizationContextValue;
  children: React.ReactNode;
}) {
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}
