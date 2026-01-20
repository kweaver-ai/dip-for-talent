import React from 'react';
import { Button, Card, Col, Row, Table, Tag, message, Select, Modal, Form, Input } from 'antd';
import SectionHeader from '../components/SectionHeader';
import InsightCard from '../components/InsightCard';
import OrganizationTree from '../components/OrganizationTree';
import { generateAction, getMock, listActions, simulateJobFit, updateAction } from '../api';
import { OrganizationMetrics, useOrganization } from '../context/OrganizationContext';
import { jobFitMock, jobFitMockByOrg } from '../data/mock';

const defaultData = jobFitMock;

const TrendLineChart = ({ data }: { data: { period: string; score: number }[] }) => {
  if (!data || data.length === 0) {
    return <div className="mt-4 text-sm text-ink-500">暂无趋势数据。</div>;
  }

  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const scores = data.map((item) => item.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const padding = 16;
  const width = 360;
  const height = 140;
  const range = Math.max(1, max - min);

  const chartPoints = data.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, data.length - 1);
    const y = padding + ((max - item.score) / range) * (height - padding * 2);
    return { x, y, item };
  });

  const points = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const hoveredPoint = hoverIndex !== null ? chartPoints[hoverIndex] : null;

  return (
    <div className="mt-4 relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[140px] w-full">
        <polyline
          points={points}
          fill="none"
          stroke="#2F6CF6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {chartPoints.map((point, index) => {
          return (
            <g key={point.item.period}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#2F6CF6"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              />
              <text x={point.x} y={height - 6} textAnchor="middle" fontSize="10" fill="#6B7A90">
                {point.item.period}
              </text>
            </g>
          );
        })}
      </svg>
      {hoveredPoint ? (
        <div
          className="absolute rounded-md bg-white px-2 py-1 text-xs text-ink-700 shadow-card"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`,
            transform: 'translate(-50%, -120%)',
            pointerEvents: 'none',
          }}
        >
          {hoveredPoint.item.period}：{hoveredPoint.item.score}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
        <span>最低 {min}</span>
        <span>最高 {max}</span>
      </div>
    </div>
  );
};

const fireAction = async (objectType: 'Organization' | 'Employee' | 'Position', objectId: string, actionType: string) => {
  try {
    await generateAction({ object_type: objectType, object_id: objectId, action_type: actionType });
    message.success('操作已提交');
  } catch (error) {
    message.error('操作失败，请稍后重试');
  }
};

const calcTrendDelta = (series: { period: string; score: number }[] | undefined) => {
  if (!series || series.length < 2) return null;
  const latest = series[series.length - 1].score;
  const previous = series[series.length - 2].score;
  return Math.round(latest - previous);
};

const formatTrendLabel = (delta: number | null) => {
  if (delta === null) return '趋势 —';
  return `趋势 ${delta > 0 ? `+${delta}` : delta}`;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getOrgMatchScore = (metrics?: OrganizationMetrics) => {
  if (!metrics) return null;
  if (typeof metrics.job_fit === 'number') return clampScore(metrics.job_fit);
  return clampScore(metrics.health_score * 0.9);
};

const getMatchLevel = (score: number) => {
  if (score >= 80) return '高匹配';
  if (score >= 70) return '中匹配';
  return '低匹配';
};

const getMatchRisk = (score: number) => {
  if (score >= 80) return '低';
  if (score >= 70) return '中';
  return '高';
};

const formatEffortTime = (effort?: string) => {
  if (!effort) return '';
  const parts = effort.split('/');
  if (parts.length > 1) return parts[parts.length - 1].trim();
  return effort.replace(/¥[0-9]+万\s*/g, '').trim();
};

const parseEffort = (effort?: string) => {
  if (!effort) return { cost: '', time: '' };
  const parts = effort.split('/');
  if (parts.length > 1) {
    return { cost: parts[0].trim(), time: parts[parts.length - 1].trim() };
  }
  if (effort.includes('¥')) return { cost: effort.trim(), time: '' };
  return { cost: '', time: effort.trim() };
};

const parseEmployeeLabel = (label?: string) => {
  if (!label) return { name: '', department: '', role: '' };
  const parts = label.split('｜').map((item) => item.trim());
  return {
    name: parts[0] ?? '',
    department: parts[1] ?? '',
    role: parts[2] ?? '',
  };
};

const getRiskTextClass = (risk: string) => {
  if (risk === '高') return 'text-red-500';
  if (risk === '中') return 'text-yellow-500';
  if (risk === '低') return 'text-green-500';
  return 'text-surge-600';
};

const calcRoleMatchScore = (
  model: { capability: string; weight: number; target: number; current: number }[]
) => {
  if (!model || model.length === 0) return 0;
  const weighted = model.reduce((sum, item) => {
    return sum + item.current * item.weight;
  }, 0);
  return Math.round(weighted);
};

const getKeyGaps = (gaps: { capability: string; gap: number; type: string }[]) => {
  if (!gaps || gaps.length === 0) return [];
  const count = Math.max(1, Math.ceil(gaps.length * 0.2));
  return [...gaps].sort((a, b) => b.gap - a.gap).slice(0, count);
};

type ActionSuggestion = (typeof defaultData)['actionSuggestions'][number] & {
  id: string;
  actionId?: string;
  execution?: string;
  status?: string;
  plan?: string;
  effortCost?: string;
  effortTime?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'ai';
  content: string;
};

type ActionItem = {
  id: string;
  target_object_type: string;
  target_object_id: string;
  action_type: string;
  status: string;
  expected_impact?: string;
  title?: string;
  effort?: string;
  execution_method?: string;
  plan?: string;
  effort_cost?: string;
  effort_time?: string;
};

const findEmployeeByInput = (
  input: string,
  options: { label: string; value: string }[] | undefined
) => {
  if (!input || !options) return null;
  const hit = options.find((option) => option.label.includes(input.trim()));
  if (hit) return hit.value;
  const nameHit = options.find((option) => option.label.split('｜')[0] === input.trim());
  return nameHit ? nameHit.value : null;
};

const findRoleByInput = (
  input: string,
  options: { label: string; value: string }[] | undefined
) => {
  if (!input || !options) return null;
  const hit = options.find((option) => option.label.includes(input.trim()));
  return hit ? hit.value : null;
};

const buildPersonSuggestions = (singleMatch: typeof defaultData.singleMatch, employeeId: string): ActionSuggestion[] => {
  const missing = singleMatch.missingCapabilities ?? [];
  const surplus = singleMatch.surplusCapabilities ?? [];
  const suggestions: ActionSuggestion[] = [];

  if (missing.length > 0) {
    const focus = missing.slice(0, 2).join('、');
    suggestions.push({
      id: `${employeeId}-person-gap`,
      title: `补齐${focus}能力`,
      priority: missing.length >= 2 ? 'P0' : 'P1',
      effect: `匹配度提升 ${Math.min(8, missing.length * 3)} 分`,
      effort: '1-2个月',
      actionType: 'job_transfer',
      targetType: 'Employee',
      targetId: employeeId,
      rationale: `个人能力差距：${missing.join('、')}`,
      execution: '直属主管辅导 + HRBP 跟进',
    });
  }

  if (singleMatch.hardMismatch) {
    suggestions.push({
      id: `${employeeId}-person-rotation`,
      title: '启动轮岗评估与导师辅导',
      priority: 'P0',
      effect: '风险等级下降 1 级',
      effort: '2周',
      actionType: 'job_transfer',
      targetType: 'Employee',
      targetId: employeeId,
      rationale: '存在硬性不匹配',
      execution: '业务负责人评估 + HRBP 协同',
    });
  }

  if (surplus.length > 0) {
    suggestions.push({
      id: `${employeeId}-person-advantage`,
      title: `发挥${surplus[0]}优势参与关键项目`,
      priority: 'P1',
      effect: '优势能力转化为绩效提升',
      effort: '1个月',
      actionType: 'org_optimization',
      targetType: 'Employee',
      targetId: employeeId,
      rationale: `优势能力：${surplus.join('、')}`,
      execution: '项目负责人牵头安排',
    });
  }

  return suggestions;
};

type RoleProfileModel = { capability: string; weight: number; target: number; current: number };
type RoleBusinessIndicator = { metric: string; value: number; trend: string; relatedCapabilities?: string[] };
type RoleProfileData = { model: RoleProfileModel[]; businessIndicators?: RoleBusinessIndicator[] };

const buildPersonInsight = (singleMatch: typeof defaultData.singleMatch, matchScore?: number) => {
  if (!singleMatch || singleMatch.employee === '—') {
    return '请先选择员工以生成整体分析。';
  }
  const gap = (singleMatch.missingCapabilities ?? []).slice(0, 2).join('、');
  const advantage = (singleMatch.surplusCapabilities ?? []).slice(0, 1).join('、');
  const score = matchScore ?? singleMatch.match;
  return `匹配度 ${score}，风险 ${singleMatch.risk}，主要差距在${gap || '关键能力'}，优势为${advantage || '核心能力'}。`;
};

const buildPersonProfileModel = (singleMatch: typeof defaultData.singleMatch) => {
  if (!singleMatch || singleMatch.employee === '—') return [];
  const missing = singleMatch.missingCapabilities ?? [];
  const surplus = singleMatch.surplusCapabilities ?? [];
  const fallback = singleMatch.keyFactors ?? [];
  const base = [...missing, ...surplus];
  const capabilities = base.length > 0 ? base : fallback;
  return capabilities.map((capability, index) => {
    const weight = [0.4, 0.35, 0.25][index % 3];
    const target = 86 + (index % 3) * 2;
    const current = missing.includes(capability) ? target - 12 : target - 4;
    const gap = Math.max(0, target - current);
    return { capability, weight, target, current, gap };
  });
};

const buildRoleInsight = (roleProfile: RoleProfileData | undefined) => {
  if (!roleProfile?.model?.length) return '岗位画像数据不足，建议补全关键能力与权重。';
  const matchScore = calcRoleMatchScore(roleProfile.model);
  const scored = roleProfile.model
    .map((item) => ({ ...item, gap: Math.max(0, item.target - item.current) }))
    .sort((a, b) => b.gap - a.gap);
  const focus = scored[0]?.capability ?? '关键能力';
  const indicator = roleProfile.businessIndicators?.find((item) => item.value >= 85);
  if (matchScore < 75 && indicator) {
    return `岗位匹配度偏低，但${indicator.metric}表现优秀，建议调整${focus}权重并校准匹配度规则。`;
  }
  return `岗位匹配度 ${matchScore}，主要差距集中在${focus}，建议优化岗位画像权重配置。`;
};

const mapActionToSuggestion = (action: ActionItem): ActionSuggestion => ({
  id: `action-${action.id}`,
  actionId: action.id,
  title: action.title ?? '行动建议',
  priority: action.status === 'active' ? 'P0' : 'P1',
  effect: action.expected_impact ?? '行动执行中',
  effort: action.effort ?? '2周',
  actionType: action.action_type ?? 'org_optimization',
  targetType: action.target_object_type ?? 'Organization',
  targetId: action.target_object_id ?? '',
  rationale: '基于组织/岗位/个人匹配度分析生成',
  plan: action.plan ?? '',
  effortCost: action.effort_cost ?? '',
  effortTime: action.effort_time ?? '',
  status: action.status,
});

const mergeSuggestions = (base: ActionSuggestion[], injected: ActionSuggestion[]) => {
  const seen = new Set(injected.map((item) => item.actionId).filter(Boolean));
  const merged = [...injected];
  base.forEach((item) => {
    if (item.actionId && seen.has(item.actionId)) return;
    merged.push(item);
  });
  return merged;
};

const toTrackable = (list: ActionSuggestion[]) =>
  list.filter((item) => item.actionId || item.status === 'active' || item.status === 'draft');

const groupSuggestions = (list: ActionSuggestion[]) => {
  const bucket = new Map<string, ActionSuggestion>();
  list.forEach((item) => {
    const key = `${item.actionType}:${item.targetType}:${item.title}`;
    const existing = bucket.get(key);
    if (!existing) {
      bucket.set(key, item);
      return;
    }
    if (existing.priority === 'P1' && item.priority === 'P0') {
      bucket.set(key, item);
    }
  });
  return Array.from(bucket.values());
};

const buildRoleSuggestions = (
  roleProfile: RoleProfileData | undefined,
  roleId: string
): ActionSuggestion[] => {
  if (!roleProfile || !roleProfile.model) return [];
  const matchScore = calcRoleMatchScore(roleProfile.model);
  const scored = roleProfile.model
    .map((item) => ({
      ...item,
      gap: Math.max(0, item.target - item.current),
      weightedGap: Math.max(0, item.target - item.current) * item.weight,
    }))
    .sort((a, b) => b.weightedGap - a.weightedGap);
  const top = scored.slice(0, 2);
  const suggestions: ActionSuggestion[] = [];

  const indicators = roleProfile.businessIndicators ?? [];
  const bestIndicator = indicators
    .slice()
    .sort((a, b) => b.value - a.value)[0];
  const strongIndicator = indicators.find((item) => item.value >= 85);
  const linkedCapability =
    strongIndicator?.relatedCapabilities?.[0] ?? bestIndicator?.relatedCapabilities?.[0] ?? top[0]?.capability;

  if (matchScore < 75 && strongIndicator) {
    suggestions.push({
      id: `${roleId}-role-reweight`,
      title: `匹配度偏低但${strongIndicator.metric}表现优秀，建议上调${linkedCapability ?? '关键能力'}权重`,
      priority: 'P0',
      effect: '匹配度与业务表现更一致',
      effort: '2周',
      actionType: 'org_optimization',
      targetType: 'Position',
      targetId: roleId,
      rationale: `业务指标${strongIndicator.metric}为${strongIndicator.value}（${strongIndicator.trend}）`,
      execution: '业务负责人评审 + HRBP 校准',
    });
    suggestions.push({
      id: `${roleId}-role-rule`,
      title: '引入业务结果修正系数，优化匹配度计算规则',
      priority: 'P1',
      effect: '低匹配但高绩效岗位的评估更准确',
      effort: '3周',
      actionType: 'org_optimization',
      targetType: 'Position',
      targetId: roleId,
      rationale: '业务指标显著高于匹配度评分',
      execution: 'HRBP 牵头 + 数据分析支持',
    });
  }

  if (top[0]) {
    suggestions.push({
      id: `${roleId}-role-weight`,
      title: `岗位画像优化：提高${top[0].capability}权重`,
      priority: top[0].gap >= 10 ? 'P0' : 'P1',
      effect: '关键能力达标率提升 10%',
      effort: '2周',
      actionType: 'org_optimization',
      targetType: 'Position',
      targetId: roleId,
      rationale: `最大差距能力：${top[0].capability}`,
      execution: '业务负责人评审',
    });
  }

  if (top[1]) {
    suggestions.push({
      id: `${roleId}-role-calibration`,
      title: `岗位画像优化：补充${top[1].capability}为必备项`,
      priority: 'P1',
      effect: '岗位画像准确度提升',
      effort: '2周',
      actionType: 'org_optimization',
      targetType: 'Position',
      targetId: roleId,
      rationale: `次高差距能力：${top[1].capability}`,
      execution: 'HRBP 牵头',
    });
  }

  return suggestions;
};

const overview = (
  data: typeof defaultData,
  trendSeries: { period: string; score: number }[],
  currentMatch: number,
  onOpenDetail: (level: 'high' | 'medium' | 'low' | 'hardMismatch', scope?: 'person' | 'role') => void,
  onOpenActionDetail: (suggestion: ActionSuggestion) => void,
  onSuggestAction: (suggestion: ActionSuggestion) => void,
  onIgnoreSuggestion: (id: string) => void,
  onTrackAction: (actionId?: string) => void,
  onOpenHistory: () => void,
  suggestions: ActionSuggestion[]
) => {
  const trendDelta = calcTrendDelta(trendSeries);
  const keyGaps = getKeyGaps(data.capabilityGaps);
  const roleDistributionList = data.positionDistribution ?? [];
  const roleTotals = roleDistributionList.reduce(
    (acc, item) => {
      const bucketOrder = [
        { key: 'high' as const, value: item.high },
        { key: 'medium' as const, value: item.medium },
        { key: 'low' as const, value: item.low },
      ];
      const bucket = bucketOrder.reduce((best, current) => (current.value > best.value ? current : best), bucketOrder[0])
        .key;
      acc[bucket] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
  return (
  <div className="space-y-6">
    <Row gutter={[24, 24]}>
      <Col xs={24} lg={12}>
        <InsightCard
          label="AI 匹配度总结论"
          title={`当前匹配度 ${currentMatch}`}
          description={`关键发现：${data.summary.keyFinding}`}
          footer={
            <div className="flex flex-wrap gap-2 text-sm text-ink-500">
              <Tag color="blue">{formatTrendLabel(trendDelta)}</Tag>
              <Tag color="orange">匹配等级 {data.summary.level}</Tag>
              <Tag color="red">风险 {data.summary.risk}</Tag>
            </div>
          }
          className="card-gradient h-full"
        />
      </Col>
      <Col xs={24} lg={12}>
        <Card className="shadow-card h-full">
          <SectionHeader title="匹配度变化趋势" description="近 12 期匹配度变化" />
          <TrendLineChart data={trendSeries} />
        </Card>
      </Col>
    </Row>
    <Row gutter={[24, 24]}>
      <Col xs={24} lg={12}>
        <Card className="shadow-card h-full">
          <SectionHeader title="个人匹配度" description="高/中/低匹配人数" />
          <div className="mt-4 space-y-3 text-sm">
            <div
              className="flex cursor-pointer items-center justify-between rounded-lg bg-mist-50 p-3 transition hover:shadow-sm"
              onClick={() => onOpenDetail('high', 'person')}
            >
              <span className="text-ink-900">高匹配</span>
              <span className="text-ink-900">{data.distribution.high} 人</span>
            </div>
            <div
              className="flex cursor-pointer items-center justify-between rounded-lg bg-mist-50 p-3 transition hover:shadow-sm"
              onClick={() => onOpenDetail('medium', 'person')}
            >
              <span className="text-ink-900">中匹配</span>
              <span className="text-ink-900">{data.distribution.medium} 人</span>
            </div>
            <div
              className="flex cursor-pointer items-center justify-between rounded-lg bg-mist-50 p-3 transition hover:shadow-sm"
              onClick={() => onOpenDetail('low', 'person')}
            >
              <span className="text-ink-900">低匹配</span>
              <span className="text-ink-900">{data.distribution.low} 人</span>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card className="shadow-card h-full">
          <SectionHeader title="岗位匹配度" description="高/中/低匹配岗位" />
          <div className="mt-4 space-y-3 text-sm">
            <div
              className="flex cursor-pointer items-center justify-between rounded-lg bg-mist-50 p-3 transition hover:shadow-sm"
              onClick={() => onOpenDetail('high', 'role')}
            >
              <span className="text-ink-900">高匹配</span>
              <span className="text-ink-900">{roleTotals.high} 个</span>
            </div>
            <div
              className="flex cursor-pointer items-center justify-between rounded-lg bg-mist-50 p-3 transition hover:shadow-sm"
              onClick={() => onOpenDetail('medium', 'role')}
            >
              <span className="text-ink-900">中匹配</span>
              <span className="text-ink-900">{roleTotals.medium} 个</span>
            </div>
            <div
              className="flex cursor-pointer items-center justify-between rounded-lg bg-mist-50 p-3 transition hover:shadow-sm"
              onClick={() => onOpenDetail('low', 'role')}
            >
              <span className="text-ink-900">低匹配</span>
              <span className="text-ink-900">{roleTotals.low} 个</span>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
    <Card className="shadow-card">
      <SectionHeader title="关键能力差距" />
      <div className="mt-4 space-y-3 text-sm">
        <div className="grid gap-2 text-xs text-ink-400 sm:grid-cols-4">
          <span className="text-left">能力项</span>
          <span className="text-center">目标</span>
          <span className="text-center">现状</span>
          <span className="text-right">差距</span>
        </div>
        {keyGaps.map((gap) => (
          <div
            key={gap.capability}
            className="grid gap-2 rounded-lg bg-mist-50 p-3 text-sm sm:grid-cols-4"
          >
            <div className="flex items-center justify-start gap-2">
              <span className="text-left font-medium text-ink-900">{gap.capability}</span>
            </div>
            <div className="text-center text-ink-500">{gap.target ?? '—'}</div>
            <div className="text-center text-ink-500">{gap.current ?? '—'}</div>
            <div className="text-right text-ink-500">{gap.gap}</div>
          </div>
        ))}
      </div>
    </Card>
    <Card className="shadow-card">
      <SectionHeader
        title="行动建议"
        description="基于组织、岗位、个人匹配度实时分析生成"
        extra={
          <Button type="link" className="p-0 text-surge-600" onClick={onOpenHistory}>
            历史行动
          </Button>
        }
      />
      <div className="mt-4 space-y-4">
        {suggestions.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-mist-100 p-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <Tag color={item.priority === 'P0' ? 'red' : 'orange'}>{item.priority}</Tag>
                <p className="text-lg font-semibold text-ink-900">{item.title}</p>
              </div>
              <p className="mt-2 text-sm text-ink-500">依据：{item.rationale}</p>
              <p className="text-sm text-ink-500">
                行动详情：{item.plan || item.rationale || '结合匹配度差距制定专项优化计划。'}
              </p>
              <p className="text-sm text-ink-500">预计效果：{item.effect}</p>
              <p className="text-sm text-ink-500">
                预计投入：
                {(() => {
                  const parsed = parseEffort(item.effort);
                  const cost = item.effortCost || parsed.cost;
                  const time = item.effortTime || parsed.time;
                  if (cost && time) return ` 成本 ${cost} | 周期 ${time}`;
                  if (cost) return ` 成本 ${cost}`;
                  if (time) return ` 周期 ${time}`;
                  return ' 无额外投入';
                })()}
              </p>
            </div>
          </div>
        ))}
        {suggestions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-mist-200 p-6 text-sm text-ink-500">
            暂无行动建议，可在历史行动中查看已完成记录。
          </div>
        ) : null}
      </div>
    </Card>
  </div>
  );
};

const personProfile = (
  data: typeof defaultData,
  employee: string,
  singleMatch: typeof defaultData.singleMatch,
  personSimResult: {
    match: number;
    performance: number;
    risk: number;
    reason: string;
  } | null,
  onEmployeeChange: (value?: string) => void,
  insight: string,
  onGenerateInsightAction: () => void,
  isEmpty: boolean,
  chatMessages: ChatMessage[],
  chatInput: string,
  onChatInputChange: (value: string) => void,
  onSendChat: () => void,
  onExportReport: () => void,
  onGenerateChatSuggestion: () => void,
  onOpenActionDetail: (suggestion: ActionSuggestion) => void,
  onSuggestAction: (suggestion: ActionSuggestion) => void,
  onIgnoreSuggestion: (id: string) => void,
  onTrackAction: (actionId?: string) => void,
  onOpenHistory: () => void,
  suggestions: ActionSuggestion[]
) => {
  const selectedLabel = data.employeeOptions.find((option) => option.value === employee)?.label as
    | string
    | undefined;
  const { department } = parseEmployeeLabel(selectedLabel);
  const profileModel = buildPersonProfileModel(singleMatch);
  const profileMatchScore = profileModel.length
    ? Math.round(profileModel.reduce((sum, item) => sum + item.current * item.weight, 0))
    : 0;
  const quickPrompts = [
    { label: '生成个人岗位匹配度分析', type: 'text' as const },
    { label: '识别关键能力差距', type: 'text' as const },
    { label: '生成行动建议', type: 'action' as const },
    { label: '导出分析报告', type: 'export' as const },
  ];
  const recentDialogs =
    chatMessages.filter((msg) => msg.role === 'ai').slice(-2).map((msg) => ({
      title: 'AI 总结',
      content: msg.content,
    })) || [];
  const fallbackDialogs = [
    {
      title: '匹配诊断',
      content: '当前岗位匹配度略低，关键差距集中在数据洞察与协作能力。',
    },
    {
      title: '能力建议',
      content: '建议优先补齐业务洞察路径，并安排重点项目协作训练。',
    },
  ];
  return (
  <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
    <div className="space-y-6">
      <Card className="shadow-card">
        <SectionHeader title="个人岗位匹配度" />
        <div className="mt-4 rounded-xl border border-mist-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm text-ink-500">员工</p>
              <p className="text-xs font-normal text-surge-600">{isEmpty ? '—' : singleMatch.employee}</p>
            </div>
            <div>
              <p className="text-sm text-ink-500">部门</p>
              <p className="text-xs font-normal text-surge-600">{isEmpty ? '—' : department || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-ink-500">岗位</p>
              <p className="text-xs font-normal text-surge-600">{isEmpty ? '—' : singleMatch.role}</p>
            </div>
            <div>
              <p className="text-sm text-ink-500">匹配度</p>
              <p className="text-xs font-normal text-surge-600">
                {isEmpty ? '—' : profileMatchScore}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-500">风险等级</p>
              <p
                className={`text-base font-semibold ${
                  isEmpty ? 'text-surge-600' : getRiskTextClass(singleMatch.risk)
                }`}
              >
                {isEmpty ? '—' : singleMatch.risk}
              </p>
            </div>
            {!isEmpty && singleMatch.hardMismatch ? <Tag color="red">硬性不匹配</Tag> : null}
          </div>
        </div>
        {personSimResult ? (
          <div className="mt-4 rounded-xl border border-mist-100 p-4">
            <SectionHeader title="调岗模拟结果" />
            <div className="mt-3 text-sm text-surge-600">
              匹配度提升至 {personSimResult.match}，绩效提升 {personSimResult.performance}%，风险 {personSimResult.risk}%。
            </div>
            <div className="mt-2 text-xs text-ink-500">{personSimResult.reason}</div>
          </div>
        ) : null}
      </Card>
      <Card className="shadow-card">
        <SectionHeader title="个人岗位能力现状" />
        {isEmpty || profileModel.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-mist-200 p-4 text-sm text-surge-600">
            暂无个人画像数据
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-ink-500">
            <div className="grid gap-2 text-xs text-ink-400 sm:grid-cols-5">
              <span className="text-left">能力项</span>
              <span className="text-center">权重</span>
              <span className="text-center">目标</span>
              <span className="text-center">现状</span>
              <span className="text-right">差距</span>
            </div>
            {profileModel.map((item) => (
              <div
                key={item.capability}
                className="grid gap-2 rounded-lg bg-mist-50 p-3 text-[11px] text-surge-600 sm:grid-cols-5"
              >
                <div className="text-left">{item.capability}</div>
                <div className="text-center">{Math.round(item.weight * 100)}%</div>
                <div className="text-center">{item.target}</div>
                <div className="text-center">{item.current}</div>
                <div className="text-right">{item.gap}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
    <div className="space-y-6">
      <Card className="shadow-card">
        <SectionHeader title="人岗动态匹配分析助手" />
        <div className="mt-4 space-y-4">
          <Input.TextArea
            rows={4}
            value={chatInput}
            onChange={(event) => onChatInputChange(event.target.value)}
            placeholder="输入问题或指令，AI 将实时生成洞察…"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="primary" className="bg-ink-900" onClick={onSendChat} disabled={!chatInput.trim()}>
              发送
            </Button>
          </div>
        </div>
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink-900">快捷提示</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <Button
                key={prompt.label}
                className="rounded-full border border-mist-200 bg-white text-ink-700"
                onClick={() => {
                  if (prompt.type === 'action') {
                    onGenerateChatSuggestion();
                    return;
                  }
                  if (prompt.type === 'export') {
                    onExportReport();
                    return;
                  }
                  onChatInputChange(prompt.label);
                }}
              >
                {prompt.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink-900">最近对话</p>
          <div className="mt-3 space-y-3">
            {(recentDialogs.length > 0 ? recentDialogs : fallbackDialogs).map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-xl bg-mist-50 p-4 text-sm text-ink-700">
                <p className="font-semibold text-ink-900">{item.title}</p>
                <p className="mt-2 text-ink-700">{item.content}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  </div>
  );
};

const roleProfile = (
  data: typeof defaultData,
  role: string,
  positionDistribution: typeof defaultData.positionDistribution,
  onRoleChange: (value?: string) => void,
  onOrgChange: (value: string) => void,
  orgOptions: { label: string; value: string }[],
  roleOptions: { label: string; value: string }[],
  roleOrgId: string,
  roleProfile?: RoleProfileData,
  insight?: string,
  onGenerateInsightAction?: () => void,
  isEmpty?: boolean,
  chatMessages?: ChatMessage[],
  chatInput?: string,
  onChatInputChange?: (value: string) => void,
  onSendChat?: () => void,
  onExportReport?: () => void,
  onGenerateChatSuggestion?: () => void,
  onOpenActionDetail?: (suggestion: ActionSuggestion) => void,
  onSuggestAction?: (suggestion: ActionSuggestion) => void,
  onIgnoreSuggestion?: (id: string) => void,
  onTrackAction?: (actionId?: string) => void,
  onOpenHistory?: () => void,
  suggestions: ActionSuggestion[] = []
) => {
  const safeChatMessages = chatMessages ?? [];
  const quickPrompts = [
    { label: '生成岗位匹配度诊断', type: 'text' as const },
    { label: '总结关键能力差距', type: 'text' as const },
    { label: '生成行动建议', type: 'action' as const },
    { label: '导出分析报告', type: 'export' as const },
  ];
  const recentDialogs =
    safeChatMessages.filter((msg) => msg.role === 'ai').slice(-2).map((msg) => ({
      title: 'AI 总结',
      content: msg.content,
    })) || [];
  const fallbackDialogs = [
    {
      title: '岗位诊断',
      content: '岗位匹配度偏低，核心能力项权重需要进一步校准。',
    },
    {
      title: '优化建议',
      content: '建议优化关键能力权重，并补充缺口能力为必备项。',
    },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card className="shadow-card">
          <SectionHeader title="岗位匹配分布" description="高/中/低匹配人数" />
          <div className="mt-4 grid gap-4 rounded-xl border border-mist-100 p-4 md:grid-cols-3">
            <Select
              showSearch
              value={role || undefined}
              onChange={onRoleChange}
              options={roleOptions}
              optionFilterProp="label"
              allowClear
              placeholder="搜索并选择岗位"
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
            <Select
              showSearch
              value={roleOrgId}
              onChange={onOrgChange}
              options={orgOptions}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
            <div className="rounded-lg bg-mist-50 p-3 text-sm text-ink-500">岗位画像版本：V2.1</div>
          </div>
          {isEmpty ? (
            <div className="mt-4 rounded-lg border border-dashed border-mist-200 p-4 text-sm text-ink-500">
              请选择岗位以查看匹配分布
            </div>
          ) : (
            <Table
              className="mt-4"
              pagination={false}
              columns={[
                { title: '岗位', dataIndex: 'role' },
                { title: '高匹配', dataIndex: 'high' },
                { title: '中匹配', dataIndex: 'medium' },
                { title: '低匹配', dataIndex: 'low' },
              ]}
              dataSource={positionDistribution.map((item, index) => ({ key: `${item.role}-${index}`, ...item }))}
            />
          )}
        </Card>
        <Card className="shadow-card">
          {roleProfile && !isEmpty ? (
            <>
              <SectionHeader title={`岗位匹配度 ${calcRoleMatchScore(roleProfile.model)}`} />
              <div className="mt-4 space-y-3 text-sm text-ink-500">
                <div className="grid gap-2 text-xs text-ink-400 sm:grid-cols-5">
                  <span className="text-left">能力项</span>
                  <span className="text-center">权重</span>
                  <span className="text-center">目标</span>
                  <span className="text-center">现状</span>
                  <span className="text-right">差距</span>
                </div>
                {roleProfile.model.map((item) => {
                  const gap = Math.max(0, item.target - item.current);
                  return (
                    <div
                      key={item.capability}
                      className="grid gap-2 rounded-lg bg-mist-50 p-3 text-sm sm:grid-cols-5"
                    >
                      <div className="text-left text-ink-900">{item.capability}</div>
                      <div className="text-center text-ink-500">{Math.round(item.weight * 100)}%</div>
                      <div className="text-center text-ink-500">{item.target}</div>
                      <div className="text-center text-ink-500">{item.current}</div>
                      <div className="text-right text-ink-500">{gap}</div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-mist-200 p-4 text-sm text-ink-500">
              暂无岗位画像数据
            </div>
          )}
        </Card>
        <Card className="shadow-card">
          <SectionHeader
            title="整体分析"
            description={insight}
            extra={
              <Button type="primary" className="bg-ink-900" onClick={onGenerateInsightAction}>
                生成行动建议
              </Button>
            }
          />
        </Card>
      </div>
      <div className="space-y-6">
        <Card className="shadow-card">
          <SectionHeader title="人岗动态匹配分析助手" />
          <div className="mt-4 space-y-4">
            <Input.TextArea
              rows={4}
              value={chatInput}
              onChange={(event) => onChatInputChange?.(event.target.value)}
              placeholder="输入问题或指令，AI 将实时生成洞察…"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="primary" className="bg-ink-900" onClick={onSendChat} disabled={!chatInput?.trim()}>
                发送
              </Button>
            </div>
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-ink-900">快捷提示</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt.label}
                  className="rounded-full border border-mist-200 bg-white text-ink-700"
                  onClick={() => {
                    if (prompt.type === 'action') {
                      onGenerateChatSuggestion?.();
                      return;
                    }
                    if (prompt.type === 'export') {
                      onExportReport?.();
                      return;
                    }
                    onChatInputChange?.(prompt.label);
                  }}
                >
                  {prompt.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-ink-900">最近对话</p>
            <div className="mt-3 space-y-3">
              {(recentDialogs.length > 0 ? recentDialogs : fallbackDialogs).map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-xl bg-mist-50 p-4 text-sm text-ink-700">
                  <p className="font-semibold text-ink-900">{item.title}</p>
                  <p className="mt-2 text-ink-700">{item.content}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const simulator = (
  employee: string,
  role: string,
  result: { match: number; performance: number; risk: number; reason: string } | null,
  onSimulate: () => void,
  onChange: (key: 'employee' | 'role', value: string) => void,
  data: typeof defaultData
) => (
  <div className="space-y-6">
    <Card className="shadow-card">
      <SectionHeader
        title="调岗模拟器"
        description="选择员工与岗位进行模拟"
        extra={
          <Button type="primary" className="bg-ink-900" onClick={onSimulate}>
            触发模拟
          </Button>
        }
      />
      <div className="mt-4 grid gap-4 rounded-xl border border-mist-100 p-4 md:grid-cols-2">
        <Select value={employee} onChange={(value) => onChange('employee', value)} options={data.employeeOptions} />
        <Select
          value={role}
          onChange={(value) => onChange('role', value)}
          options={data.roleOptions}
        />
      </div>
    </Card>
    <InsightCard
      label="模拟结果洞察"
      title={result ? `匹配度提升至 ${result.match}` : '匹配度提升至 —'}
      description={
        result
          ? `调岗后绩效预期提升 ${result.performance}%，流失风险 ${result.risk}%。原因：${result.reason}`
          : '选择员工与岗位后生成模拟结果。'
      }
      className="card-gradient"
    />
    <Card className="shadow-card">
      <SectionHeader title="多调岗方案对比" description="AI 推荐最优方案" />
      <Table
        pagination={false}
        columns={[
          { title: '方案', dataIndex: 'plan' },
          { title: '匹配度', dataIndex: 'fit' },
          { title: '绩效提升', dataIndex: 'performance' },
          { title: '风险', dataIndex: 'risk' },
        ]}
        dataSource={[
          { key: '1', plan: '战略产品经理', fit: '84', performance: '+10%', risk: '低' },
          { key: '2', plan: '增长产品经理', fit: '80', performance: '+7%', risk: '中' },
          { key: '3', plan: '解决方案顾问', fit: '76', performance: '+4%', risk: '中' },
        ]}
      />
    </Card>
  </div>
);

export default function JobFit() {
  const { selectedOrgId, organizations } = useOrganization();
  const [mockData, setMockData] = React.useState(defaultData);
  const [loadedOrgId, setLoadedOrgId] = React.useState<string | null>(null);
  const [employee, setEmployee] = React.useState('');
  const [role, setRole] = React.useState('');
  const [roleOrgId, setRoleOrgId] = React.useState('all');
  const [personSelected, setPersonSelected] = React.useState(false);
  const [roleSelected, setRoleSelected] = React.useState(false);
  const [result, setResult] = React.useState<{
    match: number;
    performance: number;
    risk: number;
    reason: string;
  } | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLevel, setDetailLevel] = React.useState<'high' | 'medium' | 'low' | 'hardMismatch'>('high');
  const [detailScope, setDetailScope] = React.useState<'person' | 'role'>('person');
  const [actionDetailOpen, setActionDetailOpen] = React.useState(false);
  const [actionDraft, setActionDraft] = React.useState<{
    id: string;
    title: string;
    effect: string;
    effort: string;
    execution: string;
    scope: 'overview' | 'person' | 'role';
  } | null>(null);
  const [actionForm] = Form.useForm();
  const [suggestions, setSuggestions] = React.useState<ActionSuggestion[]>([]);
  const [personSuggestions, setPersonSuggestions] = React.useState<ActionSuggestion[]>([]);
  const [roleSuggestions, setRoleSuggestions] = React.useState<ActionSuggestion[]>([]);
  const [actions, setActions] = React.useState<ActionItem[]>([]);
  const [personChatMessages, setPersonChatMessages] = React.useState<ChatMessage[]>([]);
  const [personChatInput, setPersonChatInput] = React.useState('');
  const [roleChatMessages, setRoleChatMessages] = React.useState<ChatMessage[]>([]);
  const [roleChatInput, setRoleChatInput] = React.useState('');
  const [personSimResult, setPersonSimResult] = React.useState<{
    match: number;
    performance: number;
    risk: number;
    reason: string;
  } | null>(null);
  const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null);
  const [chatHistoryOpen, setChatHistoryOpen] = React.useState(false);
  const [actionStatusMap, setActionStatusMap] = React.useState<Record<string, string>>({});
  const [actionHistoryOpen, setActionHistoryOpen] = React.useState(false);
  const [historyActions, setHistoryActions] = React.useState<
    { id: string; action_type: string; status: string; expected_impact: string; target_object_id: string }[]
  >([]);
  const lastGeneratedKey = React.useRef<string | null>(null);

  const singleMatch = React.useMemo(() => {
    if (!personSelected || !employee) {
      return {
        employee: '—',
        role: '—',
        match: 0,
        level: '—',
        risk: '—',
        hardMismatch: false,
        missingCapabilities: [],
        surplusCapabilities: [],
        keyFactors: [],
      };
    }
    if (mockData.singleMatchByEmployee && mockData.singleMatchByEmployee[employee]) {
      return mockData.singleMatchByEmployee[employee];
    }
    return mockData.singleMatch;
  }, [mockData, employee]);

  const roleDistribution = React.useMemo(() => {
    if (!roleSelected || !role) return [];
    if (mockData.roleDistributionById && mockData.roleDistributionById[role]) {
      return mockData.roleDistributionById[role];
    }
    return mockData.positionDistribution;
  }, [mockData, role, roleSelected]);

  const roleProfileData = React.useMemo(() => {
    if (!roleSelected || !role) return undefined;
    return mockData.roleProfilesById ? mockData.roleProfilesById[role] : undefined;
  }, [mockData, role, roleSelected]);
  const personInsight = React.useMemo(() => {
    const profileModel = buildPersonProfileModel(singleMatch);
    const score = profileModel.length
      ? Math.round(profileModel.reduce((sum, item) => sum + item.current * item.weight, 0))
      : undefined;
    return buildPersonInsight(singleMatch, score);
  }, [singleMatch]);
  const roleInsight = React.useMemo(() => buildRoleInsight(roleProfileData), [roleProfileData]);
  const activeActions = React.useMemo(
    () => actions.filter((item) => item.status !== 'completed'),
    [actions]
  );
  const personActionSuggestions = React.useMemo(() => {
    if (!employee) {
      return activeActions.map(mapActionToSuggestion);
    }
    return activeActions
      .filter((item) => item.target_object_type === 'Employee' && item.target_object_id === employee)
      .map(mapActionToSuggestion);
  }, [activeActions, employee]);
  const roleActionSuggestions = React.useMemo(() => {
    if (!role) {
      return activeActions.map(mapActionToSuggestion);
    }
    return activeActions
      .filter((item) => item.target_object_type === 'Position' && item.target_object_id === role)
      .map(mapActionToSuggestion);
  }, [activeActions, role]);
  const orgActionSuggestions = React.useMemo(() => {
    if (!selectedOrgId) return [];
    return activeActions
      .filter((item) => item.target_object_type === 'Organization' && item.target_object_id === selectedOrgId)
      .map(mapActionToSuggestion);
  }, [activeActions, selectedOrgId]);

  const handleSimulate = async () => {
    try {
      if (!selectedOrgId) return;
      const response = await simulateJobFit({ employee, role, org_id: selectedOrgId });
      setResult(response.data);
      message.success('模拟完成');
    } catch (error) {
      message.error('模拟失败，请稍后重试');
    }
  };

  React.useEffect(() => {
    const orgId = selectedOrgId || 'org_group';
    getMock('job_fit', { org_id: orgId })
      .then((result) => {
        setMockData(result.data as typeof defaultData);
        setLoadedOrgId(orgId);
      })
      .catch(() => {
        setMockData(jobFitMockByOrg[orgId] ?? defaultData);
        setLoadedOrgId(orgId);
      });
  }, [selectedOrgId]);

  React.useEffect(() => {
    const employeeValues = mockData.employeeOptions?.map((option) => option.value) ?? [];
    if (personSelected && employeeValues.length > 0 && !employeeValues.includes(employee)) {
      setEmployee(employeeValues[0]);
    }
    const roleValues = mockData.roleOptions?.map((option) => option.value) ?? [];
    if (roleSelected && roleValues.length > 0 && !roleValues.includes(role)) {
      setRole(roleValues[0]);
    }
  }, [employee, mockData.employeeOptions, mockData.roleOptions, personSelected, role, roleSelected]);

  const roleOrgOptions = React.useMemo(
    () => [
      { label: '全部组织', value: 'all' },
      { label: '销售事业部', value: 'org_bu_sales' },
      { label: '产品事业部', value: 'org_bu_product' },
      { label: '北区销售部', value: 'org_dept_north_sales' },
      { label: '增长产品部', value: 'org_dept_growth' },
    ],
    []
  );

  const roleOptions = React.useMemo(() => {
    if (roleOrgId === 'all') {
      return mockData.roleOptions ?? [];
    }
    const scoped = jobFitMockByOrg[roleOrgId]?.roleOptions ?? [];
    return scoped.length > 0 ? scoped : mockData.roleOptions ?? [];
  }, [mockData.roleOptions, roleOrgId]);

  React.useEffect(() => {
    if (roleOrgId === 'all') return;
    const scopedRoles = jobFitMockByOrg[roleOrgId]?.roleOptions ?? [];
    const values = scopedRoles.map((option) => option.value);
    if (values.length > 0 && !values.includes(role)) {
      setRole(values[0]);
    }
  }, [role, roleOrgId]);

  React.useEffect(() => {
    if (!selectedOrgId) return;
    const payload = { object_type: 'Organization' as const, object_id: selectedOrgId };
    const key = `overview:${payload.object_type}:${payload.object_id}`;
    if (lastGeneratedKey.current === key) return;
    lastGeneratedKey.current = key;
    generateAction({
      ...payload,
      action_type: 'job_transfer',
    }).catch(() => null);
  }, [selectedOrgId]);

  React.useEffect(() => {
    lastGeneratedKey.current = null;
  }, [selectedOrgId]);

  React.useEffect(() => {
    const seeded = (mockData.actionSuggestions ?? []).map((item: any, index) => ({
      ...item,
      id: `${loadedOrgId ?? 'org'}-${index}-${item.title}`,
      execution: item.execution ?? 'HRBP 牵头 + 业务负责人配合',
      plan: item.plan ?? '',
      effortCost: item.effortCost ?? item.effort_cost ?? '',
      effortTime: item.effortTime ?? item.effort_time ?? '',
    }));
    setSuggestions(seeded);
  }, [loadedOrgId, mockData.actionSuggestions]);

  React.useEffect(() => {
    if (!personSelected || !employee) {
      setPersonSuggestions([]);
      return;
    }
    setPersonSuggestions(buildPersonSuggestions(singleMatch, employee));
  }, [employee, personSelected, singleMatch]);

  React.useEffect(() => {
    setRoleSuggestions(buildRoleSuggestions(roleProfileData, role));
  }, [role, roleProfileData]);

  const refreshActionStatus = React.useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const response = await listActions(selectedOrgId);
      const map: Record<string, string> = {};
      response.data.forEach((item) => {
        map[item.id] = item.status;
      });
      setActions(response.data as ActionItem[]);
      setActionStatusMap(map);
      setHistoryActions(response.data.filter((item) => item.status === 'completed'));
    } catch (error) {
      setActions([]);
      setActionStatusMap({});
      setHistoryActions([]);
    }
  }, [selectedOrgId]);

  React.useEffect(() => {
    refreshActionStatus();
  }, [refreshActionStatus]);

  const handleChange = (key: 'employee' | 'role', value?: string) => {
    if (key === 'employee') {
      setEmployee(value ?? '');
      setPersonSelected(Boolean(value));
    }
    if (key === 'role') {
      setRole(value ?? '');
      setRoleSelected(Boolean(value));
    }
  };

  const handleGeneratePersonInsightAction = () => {
    const suggestion: ActionSuggestion = {
      id: `person-insight-${employee || 'unknown'}-${Date.now()}`,
      title: `针对${singleMatch.employee || '该员工'}的匹配优化建议`,
      priority: singleMatch.risk === '高' ? 'P0' : 'P1',
      effect: '匹配度提升 3-5 分',
      effort: '2周',
      actionType: 'job_transfer',
      targetType: 'Employee',
      targetId: employee || 'emp_001',
      rationale: `整体分析：${personInsight}`,
      execution: '直属主管辅导 + HRBP 跟进',
      status: 'draft',
    };
    setPersonSuggestions((prev) => [suggestion, ...prev]);
  };

  const handleGenerateRoleInsightAction = () => {
    if (!roleSelected || !role) {
      message.info('请先选择岗位');
      return;
    }
    const matchScore = roleProfileData?.model ? calcRoleMatchScore(roleProfileData.model) : 0;
    const suggestion: ActionSuggestion = {
      id: `role-insight-${role}-${Date.now()}`,
      title: `岗位画像优化建议`,
      priority: matchScore < 75 ? 'P0' : 'P1',
      effect: '岗位匹配度提升 3-5 分',
      effort: '3周',
      actionType: 'org_optimization',
      targetType: 'Position',
      targetId: role,
      rationale: `整体分析：${roleInsight}`,
      execution: '业务负责人评审 + HRBP 跟进',
      status: 'draft',
    };
    setRoleSuggestions((prev) => [suggestion, ...prev]);
  };

  const handleSendPersonChat = () => {
    if (!personChatInput.trim()) return;
    const input = personChatInput.trim();
    const employeeId = findEmployeeByInput(input, mockData.employeeOptions);
    const roleId = findRoleByInput(input, mockData.roleOptions);
    const fallbackEmployee = mockData.employeeOptions?.[0]?.value;
    const resolvedEmployee = employeeId ?? (employee || fallbackEmployee);
    if (employeeId) {
      setEmployee(employeeId);
      setPersonSelected(true);
    }
    if (!employeeId && resolvedEmployee && resolvedEmployee !== employee) {
      setEmployee(resolvedEmployee);
      setPersonSelected(true);
    }
    if (roleId) {
      setRole(roleId);
      setRoleSelected(true);
    }
    const matchData =
      resolvedEmployee && mockData.singleMatchByEmployee
        ? mockData.singleMatchByEmployee[resolvedEmployee]
        : mockData.singleMatch;
    if (!resolvedEmployee || !matchData) {
      message.info('未识别到员工，请在指令中包含姓名');
      return;
    }
    const profileModel = buildPersonProfileModel(matchData);
    const computedScore = profileModel.length
      ? Math.round(profileModel.reduce((sum, item) => sum + item.current * item.weight, 0))
      : matchData.match;
    const userMessage: ChatMessage = {
      id: `person-user-${Date.now()}`,
      role: 'user',
      content: input,
    };
    const isSimulate = input.includes('调岗') || input.includes('模拟');
    const simulated = {
      match: Math.min(95, computedScore + 6),
      performance: 8,
      risk: Math.max(5, 20 - Math.round(computedScore / 6)),
      reason: '岗位匹配提升后，关键能力差距收敛，风险下降。',
    };
    const missingCaps = (matchData.missingCapabilities ?? []).slice(0, 2);
    const surplusCaps = (matchData.surplusCapabilities ?? []).slice(0, 1);
    const suggestionText = isSimulate
      ? '建议结合目标岗位补齐关键能力，并设置 2-4 周过渡期跟踪风险变化。'
      : `建议优先提升${missingCaps.join('、') || '关键能力'}，通过项目实践快速补齐；${
          surplusCaps.length ? `同时强化${surplusCaps.join('、')}作为优势带教。` : '同步优化协作路径与反馈机制。'
        }`;
    const aiMessage: ChatMessage = {
      id: `person-ai-${Date.now() + 1}`,
      role: 'ai',
      content: isSimulate
        ? `已完成调岗模拟：匹配度提升至 ${simulated.match}，绩效提升 ${simulated.performance}%，流失风险 ${simulated.risk}%。建议：${suggestionText}`
        : `已完成个人画像分析：匹配度 ${computedScore}，风险 ${matchData.risk}，关键差距 ${(
            matchData.missingCapabilities ?? []
          ).join('、') || '暂无'}。建议：${suggestionText}`,
    };
    setPersonChatMessages((prev) => [...prev, userMessage, aiMessage]);
    if (isSimulate) {
      setPersonSimResult(simulated);
    } else {
      setPersonSimResult(null);
    }
    setPersonChatInput('');
  };

  const handleSendRoleChat = () => {
    if (!roleChatInput.trim()) return;
    const userMessage: ChatMessage = {
      id: `role-user-${Date.now()}`,
      role: 'user',
      content: roleChatInput.trim(),
    };
    const aiMessage: ChatMessage = {
      id: `role-ai-${Date.now() + 1}`,
      role: 'ai',
      content: roleInsight,
    };
    setRoleChatMessages((prev) => [...prev, userMessage, aiMessage]);
    setRoleChatInput('');
  };

  const handleExportPersonReport = () => {
    if (!employee) {
      message.info('请先选择员工');
      return;
    }
    const selectedLabel = mockData.employeeOptions?.find((option) => option.value === employee)?.label as
      | string
      | undefined;
    const { department, role: employeeRole } = parseEmployeeLabel(selectedLabel);
    const report = [
      '个人岗位匹配度分析报告',
      `员工：${singleMatch.employee}`,
      `部门：${department || '—'}`,
      `岗位：${employeeRole || singleMatch.role || '—'}`,
      `匹配度：${singleMatch.match}`,
      `风险等级：${singleMatch.risk}`,
      `能力差距：${(singleMatch.missingCapabilities ?? []).join('、') || '—'}`,
      `优势能力：${(singleMatch.surplusCapabilities ?? []).join('、') || '—'}`,
      `整体分析：${personInsight}`,
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `个人岗位匹配度分析报告-${singleMatch.employee || '报告'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportRoleReport = () => {
    if (!role) {
      message.info('请先选择岗位');
      return;
    }
    const roleLabel = mockData.roleOptions?.find((option) => option.value === role)?.label ?? role;
    const matchScore = roleProfileData?.model ? calcRoleMatchScore(roleProfileData.model) : 0;
    const report = [
      '岗位匹配度分析报告',
      `岗位：${roleLabel}`,
      `岗位匹配度：${matchScore}`,
      `整体分析：${roleInsight}`,
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `岗位匹配度分析报告-${roleLabel}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleGeneratePersonChatSuggestion = () => {
    handleGeneratePersonInsightAction();
    setPersonChatMessages((prev) => [
      ...prev,
      { id: `person-ai-suggest-${Date.now()}`, role: 'ai', content: '已生成一条行动建议，请确认执行。' },
    ]);
  };

  const handleGenerateRoleChatSuggestion = () => {
    if (!roleSelected || !role) {
      message.info('请先选择岗位');
      return;
    }
    handleGenerateRoleInsightAction();
    setRoleChatMessages((prev) => [
      ...prev,
      { id: `role-ai-suggest-${Date.now()}`, role: 'ai', content: '已生成一条行动建议，请确认执行。' },
    ]);
  };

  const handleOpenDetail = (level: 'high' | 'medium' | 'low' | 'hardMismatch', scope: 'person' | 'role' = 'person') => {
    setDetailLevel(level);
    setDetailScope(scope);
    setDetailOpen(true);
  };

  const handleDownloadDetail = () => {
    if (detailScope === 'role') {
      const rows = (mockData.positionDistribution ?? []).filter((item) => {
        const bucketOrder = [
          { key: 'high' as const, value: item.high },
          { key: 'medium' as const, value: item.medium },
          { key: 'low' as const, value: item.low },
        ];
        const bucket = bucketOrder.reduce((best, current) => (current.value > best.value ? current : best), bucketOrder[0])
          .key;
        return bucket === detailLevel;
      });
      const header = ['岗位', '匹配度', '等级', '风险'];
      const lines = rows.map((item) => {
        const total = item.high + item.medium + item.low;
        const fallbackScore = total
          ? Math.round((item.high * 85 + item.medium * 75 + item.low * 60) / total)
          : 0;
        const roleId = mockData.roleOptions?.find((option) => option.label === item.role)?.value;
        const profile = roleId ? mockData.roleProfilesById?.[roleId] : undefined;
        const matchScore = profile?.model ? calcRoleMatchScore(profile.model) : fallbackScore;
        return [item.role, matchScore, getMatchLevel(matchScore), getMatchRisk(matchScore)];
      });
      const csv = [header, ...lines].map((line) => line.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `岗位匹配度明细-${detailLevel}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    const rows = (mockData.matrix ?? []).filter((item) => {
      if (detailLevel === 'high') return item.level === '高匹配' || item.level === '高';
      if (detailLevel === 'medium') return item.level === '中匹配' || item.level === '中';
      if (detailLevel === 'low') return item.level === '低匹配' || item.level === '低';
      return item.level === '硬性不匹配';
    });
    const header = ['员工', '岗位', '匹配度', '等级', '风险'];
    const lines = rows.map((item) => [item.employee, item.role, item.match, item.level, item.risk]);
    const csv = [header, ...lines].map((line) => line.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `匹配度明细-${detailLevel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenActionDetail = (suggestion: ActionSuggestion, scope: 'overview' | 'person' | 'role') => {
    const draft = {
      id: suggestion.id,
      title: suggestion.title,
      effect: suggestion.effect,
      effort: formatEffortTime(suggestion.effort),
      execution: suggestion.execution ?? 'HRBP 牵头 + 业务负责人配合',
      scope,
    };
    setActionDraft(draft);
    actionForm.setFieldsValue(draft);
    setActionDetailOpen(true);
  };

  const handleConfirmActionDetail = async () => {
    const values = await actionForm.validateFields();
    if (!actionDraft) return;
    const updateList = (list: ActionSuggestion[]) =>
      list.map((item) => (item.id === actionDraft.id ? { ...item, ...values } : item));
    if (actionDraft.scope === 'overview') {
      setSuggestions(updateList);
    } else {
      setPersonSuggestions(updateList);
    }
    const source =
      actionDraft.scope === 'overview'
        ? suggestions
        : actionDraft.scope === 'person'
          ? personSuggestions
          : roleSuggestions;
    const target = source.find((item) => item.id === actionDraft.id);
    if (target?.actionId) {
      try {
        await updateAction({
          id: target.actionId,
          title: values.title,
          expected_impact: values.effect,
          effort: values.effort,
          execution_method: values.execution,
        });
        await refreshActionStatus();
        message.success('行动已同步更新');
      } catch (error) {
        message.error('行动同步失败，请稍后重试');
      }
    }
    setActionDetailOpen(false);
  };

  const handleSuggestionAction = async (item: ActionSuggestion, scope: 'overview' | 'person' | 'role') => {
    try {
      const response = await generateAction({
        object_type: item.targetType,
        object_id: item.targetId,
        action_type: item.actionType,
      });
      const actionId = response.data.action_id;
      await updateAction({
        id: actionId,
        title: item.title,
        expected_impact: item.effect,
        effort: item.effort,
        execution_method: item.execution,
      });
      const updateList = (list: ActionSuggestion[]) =>
        list.map((suggestion) => (suggestion.id === item.id ? { ...suggestion, actionId } : suggestion));
      if (scope === 'overview') {
        setSuggestions(updateList);
      } else if (scope === 'person') {
        setPersonSuggestions(updateList);
      } else {
        setRoleSuggestions(updateList);
      }
      await refreshActionStatus();
      message.success('行动建议已生成');
      setActionHistoryOpen(true);
    } catch (error) {
      message.error('行动生成失败，请稍后重试');
    }
  };

  const handleIgnoreSuggestion = (id: string, scope: 'overview' | 'person' | 'role') => {
    if (scope === 'overview') {
      setSuggestions((prev) => prev.filter((item) => item.id !== id));
    } else if (scope === 'person') {
      setPersonSuggestions((prev) => prev.filter((item) => item.id !== id));
    } else {
      setRoleSuggestions((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleTrackAction = (actionId?: string) => {
    if (!actionId) return;
    setActionHistoryOpen(true);
  };

  const detailData =
    detailScope === 'role'
      ? (mockData.positionDistribution ?? [])
          .filter((item) => {
            const bucketOrder = [
              { key: 'high' as const, value: item.high },
              { key: 'medium' as const, value: item.medium },
              { key: 'low' as const, value: item.low },
            ];
            const bucket = bucketOrder.reduce(
              (best, current) => (current.value > best.value ? current : best),
              bucketOrder[0]
            ).key;
            return bucket === detailLevel;
          })
          .map((item) => {
            const total = item.high + item.medium + item.low;
            const fallbackScore = total
              ? Math.round((item.high * 85 + item.medium * 75 + item.low * 60) / total)
              : 0;
            const roleId = mockData.roleOptions?.find((option) => option.label === item.role)?.value;
            const profile = roleId ? mockData.roleProfilesById?.[roleId] : undefined;
            const matchScore = profile?.model ? calcRoleMatchScore(profile.model) : fallbackScore;
            return {
              role: item.role,
              match: matchScore,
              level: getMatchLevel(matchScore),
              risk: getMatchRisk(matchScore),
            };
          })
      : (mockData.matrix ?? []).filter((item) => {
          if (detailLevel === 'high') return item.level === '高匹配' || item.level === '高';
          if (detailLevel === 'medium') return item.level === '中匹配' || item.level === '中';
          if (detailLevel === 'low') return item.level === '低匹配' || item.level === '低';
          return item.level === '硬性不匹配';
        });
  const personSuggestionView = mergeSuggestions(
    toTrackable(
      personSuggestions.filter((item) => !(item.actionId && actionStatusMap[item.actionId] === 'completed'))
    ),
    personActionSuggestions
  );
  const roleSuggestionView = mergeSuggestions(
    toTrackable(roleSuggestions.filter((item) => !(item.actionId && actionStatusMap[item.actionId] === 'completed'))),
    roleActionSuggestions
  );
  const overviewSuggestionView = mergeSuggestions(
    toTrackable(suggestions.filter((item) => !(item.actionId && actionStatusMap[item.actionId] === 'completed'))),
    orgActionSuggestions
  );
  const groupedOverviewSuggestions = groupSuggestions(overviewSuggestionView).slice(5);
  const selectedOrg = organizations.find((org) => org.id === selectedOrgId);
  const orgMatchScore = getOrgMatchScore(selectedOrg?.metrics);
  const baseTrendSeries = mockData.trendSeries ?? [];
  const syncedTrendSeries =
    orgMatchScore !== null && baseTrendSeries.length > 0
      ? baseTrendSeries.map((item, index) =>
          index === baseTrendSeries.length - 1 ? { ...item, score: orgMatchScore } : item
        )
      : baseTrendSeries;
  const currentMatch =
    orgMatchScore ??
    (syncedTrendSeries.length > 0
      ? syncedTrendSeries[syncedTrendSeries.length - 1].score
      : mockData.summary.avgMatch);

  React.useEffect(() => {
    if (!personSelected || !employee) {
      return;
    }
    setPersonChatMessages((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          id: `person-user-${employee}`,
          role: 'user',
          content: `请对${singleMatch.employee}做个人画像分析`,
        },
        {
          id: `person-ai-${employee}`,
          role: 'ai',
          content: `已完成对${singleMatch.employee}的匹配分析：${personInsight}`,
        },
      ];
    });
  }, [employee, personInsight, personSelected, singleMatch.employee]);

  React.useEffect(() => {
    if (!roleSelected || !role) {
      setRoleChatMessages([]);
      return;
    }
    setRoleChatMessages([
      {
        id: `role-ai-${role}`,
        role: 'ai',
        content: `岗位画像分析结论：${roleInsight}`,
      },
    ]);
  }, [role, roleInsight, roleSelected]);

  const handleContinueChat = () => {
    setSelectedChatId(null);
  };

  return (
    <>
      <div className="relative">
        <div className="w-full space-y-4 lg:pr-[384px]">
          <OrganizationTree variant="jobfit" title="匹配度组织树" />
          {overview(
            mockData,
            syncedTrendSeries,
            currentMatch,
            handleOpenDetail,
            (item) => handleOpenActionDetail(item, 'overview'),
            (item) => handleSuggestionAction(item, 'overview'),
            (id) => handleIgnoreSuggestion(id, 'overview'),
            handleTrackAction,
            () => setActionHistoryOpen(true),
            groupedOverviewSuggestions
          )}
        </div>
        <div className="mt-6 w-full space-y-4 lg:fixed lg:right-6 lg:top-24 lg:mt-0 lg:h-[calc(100vh-120px)] lg:w-[360px]">
          <div className="h-full">
            <Card className="shadow-card flex h-full min-h-[420px] flex-col">
              <SectionHeader title="人岗动态匹配分析助手" />
              <div className="mt-6 flex flex-1 flex-col">
                <div className="mb-6 flex-1 space-y-4 overflow-y-auto">
                  {personChatMessages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm ${
                            isUser
                              ? 'border-surge-200 bg-surge-50 text-ink-900'
                              : 'border-mist-100 bg-mist-50 text-ink-600'
                          }`}
                        >
                          <div className="mb-1 text-xs font-semibold text-ink-500">
                            {isUser ? '我' : 'Copilot'}
                          </div>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-auto space-y-3 pb-2">
                  <Input.TextArea
                    rows={2}
                    value={personChatInput}
                    onChange={(event) => setPersonChatInput(event.target.value)}
                    placeholder="输入问题或指令，AI 将基于当前组织、岗位、个人匹配度生成建议…"
                  />
                  <div className="flex justify-end">
                    <Button type="primary" className="bg-blue-600" onClick={handleSendPersonChat}>
                      发送
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    className="text-sm font-semibold text-ink-700 hover:text-ink-900"
                    onClick={() => setChatHistoryOpen((prev) => !prev)}
                  >
                    查看历史记录
                  </button>
                  {chatHistoryOpen ? (
                    <div className="mt-4 space-y-5 text-sm text-ink-600">
                      {(() => {
                        const aiMessages = (personChatMessages.length > 0 ? personChatMessages : []).filter(
                          (msg) => msg.role === 'ai'
                        );
                        if (aiMessages.length === 0) {
                          return <div className="text-sm text-ink-400">无内容</div>;
                        }
                        const recent = aiMessages.slice(-5);
                        const older = aiMessages.slice(0, -5);
                        return (
                          <>
                            <div>
                              <div className="text-xs font-semibold text-ink-400">7天内</div>
                              <div className="mt-3 space-y-3">
                                {recent.map((msg) => (
                                  <button
                                    key={`summary-${msg.id}`}
                                    type="button"
                                    className="flex w-full items-center gap-3 text-left"
                                    onClick={() => setSelectedChatId(msg.id)}
                                  >
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-ink-200 text-xs text-ink-400">
                                      ···
                                    </span>
                                    <span className="line-clamp-1">
                                      {msg.content.length > 20 ? `${msg.content.slice(0, 20)}...` : msg.content}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            {older.length > 0 ? (
                              <div>
                                <div className="text-xs font-semibold text-ink-400">30天内</div>
                                <div className="mt-3 space-y-3">
                                  {older.map((msg) => (
                                    <button
                                      key={`summary-older-${msg.id}`}
                                      type="button"
                                      className="flex w-full items-center gap-3 text-left"
                                      onClick={() => setSelectedChatId(msg.id)}
                                    >
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-ink-200 text-xs text-ink-400">
                                        ···
                                      </span>
                                      <span className="line-clamp-1">
                                        {msg.content.length > 20 ? `${msg.content.slice(0, 20)}...` : msg.content}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <Modal
        title="完整对话"
        open={Boolean(selectedChatId)}
        onCancel={() => setSelectedChatId(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedChatId(null)}>
            关闭
          </Button>,
          <Button key="continue" type="primary" className="bg-ink-900" onClick={handleContinueChat}>
            继续对话
          </Button>,
        ]}
      >
        {(() => {
          const msg = personChatMessages.find((item) => item.id === selectedChatId);
          if (!msg) return <div className="text-sm text-ink-500">未找到对话内容。</div>;
          return (
            <div className="space-y-2 text-sm text-ink-700">
              <div className="font-semibold text-ink-900">{msg.role === 'ai' ? 'AI' : '用户'}</div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          );
        })()}
      </Modal>
      <Modal
        title={detailScope === 'role' ? '岗位匹配度明细' : '匹配度明细'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={[
          <Button key="download" onClick={handleDownloadDetail}>
            下载明细
          </Button>,
          <Button key="close" type="primary" onClick={() => setDetailOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <Table
          pagination={false}
          columns={
            detailScope === 'role'
              ? [
                  { title: '岗位', dataIndex: 'role' },
                  { title: '匹配度', dataIndex: 'match' },
                  { title: '等级', dataIndex: 'level' },
                  { title: '风险', dataIndex: 'risk' },
                ]
              : [
                  { title: '员工', dataIndex: 'employee' },
                  { title: '岗位', dataIndex: 'role' },
                  { title: '匹配度', dataIndex: 'match' },
                  { title: '等级', dataIndex: 'level' },
                  { title: '风险', dataIndex: 'risk' },
                ]
          }
          dataSource={
            detailScope === 'role'
              ? detailData.map((item, index) => ({ key: `${item.role}-${index}`, ...item }))
              : detailData.map((item, index) => ({ key: `${item.employee}-${index}`, ...item }))
          }
        />
      </Modal>
      <Modal
        title="行动详情"
        open={actionDetailOpen}
        onCancel={() => setActionDetailOpen(false)}
        onOk={handleConfirmActionDetail}
        okText="确认执行方式"
      >
        <Form form={actionForm} layout="vertical">
          <Form.Item label="行动标题" name="title" rules={[{ required: true, message: '请输入行动标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="预期效果" name="effect" rules={[{ required: true, message: '请输入预期效果' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="预计投入" name="effort" rules={[{ required: true, message: '请输入预计投入' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="执行方式" name="execution" rules={[{ required: true, message: '请输入执行方式' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="历史行动"
        open={actionHistoryOpen}
        onCancel={() => setActionHistoryOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setActionHistoryOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <Table
          pagination={false}
          columns={[
            { title: '行动类型', dataIndex: 'action_type' },
            { title: '目标对象', dataIndex: 'target_object_id' },
            { title: '状态', dataIndex: 'status' },
            { title: '预期影响', dataIndex: 'expected_impact' },
            {
              title: '操作',
              dataIndex: 'id',
              render: (id: string) => (
                <Button size="small" onClick={() => handleTrackAction(id)}>
                  查看
                </Button>
              ),
            },
          ]}
          dataSource={historyActions.map((item) => ({ key: item.id, ...item }))}
        />
      </Modal>
    </>
  );
}
