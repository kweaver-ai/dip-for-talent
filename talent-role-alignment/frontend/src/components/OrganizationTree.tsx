import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Spin, Tree } from 'antd';
import { getOrganizations } from '../api';
import { Organization, useOrganization } from '../context/OrganizationContext';

type TreeVariant = 'jobfit';

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function metricLabel(org: Organization, _variant: TreeVariant) {
  const metrics = org.metrics;
  return `匹配度 ${metrics.job_fit ?? clampScore(metrics.health_score * 0.9)}`;
}

function buildTree(orgs: Organization[], variant: TreeVariant) {
  const nodeMap = new Map<string, any>();
  const roots: any[] = [];

  orgs.forEach((org) => {
    nodeMap.set(org.id, {
      key: org.id,
      title: (
        <div className="flex items-center justify-between">
          <span>{org.name}</span>
          <span className="text-xs text-ink-500">{metricLabel(org, variant)}</span>
        </div>
      ),
      children: [],
    });
  });

  orgs.forEach((org) => {
    const node = nodeMap.get(org.id);
    if (org.parent_id && nodeMap.has(org.parent_id)) {
      nodeMap.get(org.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default function OrganizationTree({
  variant = 'jobfit',
  title = '组织树',
}: {
  variant?: TreeVariant;
  title?: string;
}) {
  const { organizations, selectedOrgId, setSelectedOrgId, setOrganizations } = useOrganization();
  const [loading, setLoading] = useState(false);
  const treeData = useMemo(() => buildTree(organizations, variant), [organizations, variant]);

  useEffect(() => {
    if (organizations.length > 0) return;
    setLoading(true);
    getOrganizations()
      .then((result) => {
        setOrganizations(result.data);
        if (!selectedOrgId && result.data.length > 0) {
          setSelectedOrgId(result.data[0].id);
        }
      })
      .catch(() => {
        setOrganizations([]);
      })
      .finally(() => setLoading(false));
  }, [organizations.length, selectedOrgId, setOrganizations, setSelectedOrgId]);

  return (
    <Card className="shadow-card">
      <div className="text-sm uppercase tracking-[0.2em] text-ink-500">{title}</div>
      {loading ? (
        <div className="mt-4 flex items-center justify-center">
          <Spin />
        </div>
      ) : organizations.length === 0 ? (
        <div className="mt-4">
          <Empty description="暂无组织数据" />
        </div>
      ) : (
        <Tree
          className="mt-3"
          treeData={treeData}
          selectedKeys={[selectedOrgId]}
          onSelect={(keys) => {
            const id = keys[0] as string | undefined;
            if (id) setSelectedOrgId(id);
          }}
        />
      )}
    </Card>
  );
}
