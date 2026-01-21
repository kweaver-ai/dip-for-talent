import { useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "react";
import {
  Button,
  Card,
  Input,
  Progress,
  Tag,
  Tooltip,
  Tree
} from "antd";
import type { DataNode } from "antd/es/tree";
import {
  InfoCircleOutlined,
  SearchOutlined
} from "@ant-design/icons";
import classNames from "classnames";
import { Copilot, type ApplicationContext } from "@kweaver-ai/chatkit";

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const DEFAULT_TOKEN = import.meta.env.VITE_DIP_TOKEN ?? "";
const CHATKIT_BASE_URL =
  import.meta.env.VITE_DIP_CHATKIT_BASE_URL ?? "/api/agent-app/v1";
const CHATKIT_AGENT_ID =
  import.meta.env.VITE_DIP_CHATKIT_AGENT_ID ??
  "01KCNETG4CKP5TVRJ7KHNRN3KV";
const DEFAULT_CHATKIT_TOKEN = DEFAULT_TOKEN;
const CHATKIT_BUSINESS_DOMAIN =
  import.meta.env.VITE_DIP_CHATKIT_BUSINESS_DOMAIN ?? "bd_public";
const REQUEST_TIMEOUT_MS = 60_000;
const METRIC_TIME_RANGE = {
  start: Date.UTC(2025, 0, 1, 0, 0, 0, 0),
  end: Date.UTC(2025, 11, 31, 23, 59, 59, 999)
};

type RoiMetric = {
  id: string;
  name: string;
  current_value: number | null;
  benchmark_value: number | null;
  change_pct: number | null;
  achievement_pct: number | null;
  unit: string;
  trend?: "up" | "down";
};

type RoiSummary = {
  updated_at: string | null;
  metrics: RoiMetric[];
};

type OrgNode = {
  id: string;
  name: string;
  owner: string;
  roi_value: number;
  benchmark_value: number;
  status?: "good" | "warn" | "risk";
  headcount: number;
  sales_per_10k: number;
  sales_per_capita: number;
  cost_per_capita: number;
  children: OrgNode[];
};

type OrgTreeResponse = {
  updated_at: string;
  root: OrgNode;
};

type ScoreMetric = {
  id: string;
  name: string;
  current_value: number | null;
  benchmark_value: number | null;
  correlation: number | null;
  direction?: "positive" | "negative";
  unit: string;
};

type ScoreResponse = {
  updated_at: string | null;
  score: number | null;
  metrics: ScoreMetric[];
};

type ChatContext = {
  type: "metric" | "org" | "score" | "copilot";
  id?: string;
  title: string;
  modelId?: string;
  benchmarkModelId?: string;
};

const statusMeta = {
  good: { label: "优于基准", color: "#22c55e" },
  warn: { label: "低于基准≤20%", color: "#f59e0b" },
  risk: { label: "低于基准>20%", color: "#ef4444" }
} as const;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);

const formatMetricValue = (value: number | null, unit?: string) => {
  if (!isFiniteNumber(value)) return "--";
  if (!unit) return formatNumber(value);
  const suffix = unit === "%" ? "%" : ` ${unit}`;
  return `${formatNumber(value)}${suffix}`;
};

const formatPercentNumber = (value: number) =>
  new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);

const formatPercent = (value: number | null) =>
  isFiniteNumber(value) ? `${formatPercentNumber(value)}%` : "--";

const formatSignedPercent = (value: number | null) =>
  isFiniteNumber(value)
    ? `${value > 0 ? "+" : ""}${formatPercentNumber(value)}%`
    : "--";

const resolveStatus = (node: OrgNode): "good" | "warn" | "risk" => {
  if (node.status) return node.status;
  if (!node.benchmark_value) return "good";
  const deltaRatio = (node.roi_value - node.benchmark_value) / node.benchmark_value;
  if (deltaRatio >= 0) return "good";
  if (Math.abs(deltaRatio) <= 0.2) return "warn";
  return "risk";
};

const buildTreeData = (node: OrgNode, expandedKeys: Key[]): DataNode => {
  const statusKey = resolveStatus(node);
  const status = statusMeta[statusKey];
  const hasChildren = node.children?.length > 0;
  const isExpanded = expandedKeys.includes(node.id);
  const title = (
    <Tooltip
      title={
        <div className="text-sm">
          <div>人员规模：{node.headcount}</div>
          <div>万元人力成本销售收入：{formatNumber(node.sales_per_10k)}</div>
          <div>人均销售额：{formatNumber(node.sales_per_capita)} 万</div>
          <div>人均人力成本：{formatNumber(node.cost_per_capita)} 万</div>
        </div>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-700">{node.name}</div>
            <div className="text-xs text-slate-500">负责人：{node.owner}</div>
            <div className="mt-2 text-xs text-slate-500">
              当前 {formatNumber(node.roi_value)} / 基准 {formatNumber(node.benchmark_value)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-slate-500">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full border-2"
              style={{ borderColor: status.color }}
              aria-label={status.label}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: status.color }}
              />
            </span>
            {hasChildren ? (
              <span className="text-xs text-slate-500">
                {isExpanded ? "收起" : "展开"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Tooltip>
  );

  return {
    key: node.id,
    title,
    children: node.children?.map((child) => buildTreeData(child, expandedKeys))
  };
};

const buildKeyIndex = (node: OrgNode, parentKey?: string) => {
  const current = [{ key: node.id, name: node.name, parentKey }];
  return node.children.reduce(
    (acc, child) => acc.concat(buildKeyIndex(child, node.id)),
    current
  );
};

const ROI_METRIC_CONFIG = [
  {
    code: "#MTC-A7Q9",
    modelId: "d50hck5g5lk40hvh4880",
    benchmarkModelId: "d5fh329evebbrr2gqo3g",
    name: "万元人力成本销售收入",
    unit: "万元"
  },
  {
    code: "#MTC-0E1C",
    modelId: "d50heldg5lk40hvh488g",
    benchmarkModelId: "d5fh3e9evebbrr2gqo4g",
    name: "人均销售额",
    unit: "万元"
  },
  {
    code: "#MTC-3FE9",
    modelId: "d50hf5tg5lk40hvh4890",
    benchmarkModelId: "d5fh3q1evebbrr2gqo5g",
    name: "人均人力成本",
    unit: "万元"
  }
];

const SCORE_METRIC_CONFIG = [
  {
    code: "#MTC-B5E3",
    modelId: "d4skbjtg5lk40hvh4820",
    benchmarkModelId: "d5fmvlvmisa6vs0oncog",
    name: "项目转化率",
    unit: "%",
    correlation: 0.88
  },
  {
    code: "#MTC-B5E4",
    modelId: "d4t5iflg5lk40hvh483g",
    benchmarkModelId: "d5fn0ffmisa6vs0oncrg",
    name: "平均项目转化周期",
    unit: "天",
    correlation: -0.85
  },
  {
    code: "#MTC-B5E5",
    modelId: "d4skcddg5lk40hvh482g",
    benchmarkModelId: "d5fmvuvmisa6vs0oncpg",
    name: "平均项目价值",
    unit: "万元",
    correlation: 0.84
  },
  {
    code: "#MTC-B5Q5",
    modelId: "d4sk4blg5lk40hvh480g",
    benchmarkModelId: "d5fn09fmisa6vs0oncqg",
    name: "新销售产单周期",
    unit: "天",
    correlation: -0.82
  },
  {
    code: "#MTC-E6F6",
    modelId: "d4t8n0dg5lk40hvh487g",
    benchmarkModelId: "d5fn0m7misa6vs0oncsg",
    name: "人员流动性",
    unit: "%",
    correlation: -0.81
  }
];

const extractFirstValue = (values: unknown[]): number | null => {
  if (!values.length) return null;
  const value = values[0];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const fetchWithTimeout = async (input: RequestInfo, init?: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const buildMetricQuery = (withGrowth: boolean) => ({
  instant: true,
  start: METRIC_TIME_RANGE.start,
  end: METRIC_TIME_RANGE.end,
  ...(withGrowth
    ? {
        metrics: {
          type: "sameperiod",
          sameperiod_config: {
            method: ["growth_rate"],
            offset: 1,
            time_granularity: "year"
          }
        }
      }
    : {})
});

const fetchMetricResults = async (
  apiBase: string,
  authorization: string,
  ids: string[],
  withGrowth: boolean
): Promise<
  {
    id: string;
    result: Record<string, any>;
    value: number | null;
    growthRate: number | null;
  }[]
> => {
  const body = ids.map(() => buildMetricQuery(withGrowth));
  const response = await fetchWithTimeout(
    `${apiBase}/mdl-uniquery/v1/metric-models/${ids.join(",")}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HTTP-Method-Override": "GET",
        ...(authorization ? { Authorization: authorization } : {})
      },
      body: JSON.stringify(body)
    }
  );
  if (!response.ok) {
    throw new Error(`Metric query failed: ${response.status}`);
  }
  const payload = await response.json();
  const results = Array.isArray(payload) ? payload : [payload];

  return ids.map((id, index) => {
    const result = results[index] ?? {};
    const dataItems = result?.datas ?? [];
    const first = dataItems[0] ?? {};
    const growthRates = first.growth_rates ?? [];
    const growthRate =
      growthRates.length > 0 ? extractFirstValue(growthRates) : null;
    return {
      id,
      result,
      value: extractFirstValue(first.values ?? []),
      growthRate
    };
  });
};

const fetchRoiSummary = async (
  apiBase: string,
  authorization: string
): Promise<RoiSummary> => {
  const currentIds = ROI_METRIC_CONFIG.map((metric) => metric.modelId);
  const benchmarkIds = ROI_METRIC_CONFIG.map(
    (metric) => metric.benchmarkModelId
  );
  const [currentResults, benchmarkResults] = await Promise.all([
    fetchMetricResults(apiBase, authorization, currentIds, true),
    fetchMetricResults(apiBase, authorization, benchmarkIds, false)
  ]);

  const metrics: RoiMetric[] = ROI_METRIC_CONFIG.map((config, index) => {
    const current = currentResults[index];
    const benchmark = benchmarkResults[index];
    const model = current?.result?.model ?? {};
    const currentValue = current?.value ?? null;
    const benchmarkValue = benchmark?.value ?? null;
    const changePct = isFiniteNumber(current?.growthRate)
      ? current!.growthRate * 100
      : null;
    const achievementPct =
      isFiniteNumber(currentValue) && isFiniteNumber(benchmarkValue)
        ? (benchmarkValue === 0 ? null : (currentValue / benchmarkValue) * 100)
        : null;
    const trend = isFiniteNumber(changePct)
      ? changePct >= 0
        ? "up"
        : "down"
      : undefined;

    return {
      id: config.code,
      name: model.name ?? config.name,
      current_value: currentValue,
      benchmark_value: benchmarkValue,
      change_pct: isFiniteNumber(changePct) ? Number(changePct.toFixed(2)) : null,
      achievement_pct: isFiniteNumber(achievementPct)
        ? Number(achievementPct.toFixed(2))
        : null,
      unit: model.unit ?? config.unit,
      trend
    };
  });

  return {
    updated_at: null,
    metrics
  };
};

const fetchScoreSummary = async (
  apiBase: string,
  authorization: string
): Promise<ScoreResponse> => {
  const currentIds = SCORE_METRIC_CONFIG.map((metric) => metric.modelId);
  const benchmarkIds = SCORE_METRIC_CONFIG.map(
    (metric) => metric.benchmarkModelId
  );
  const [currentResults, benchmarkResults] = await Promise.all([
    fetchMetricResults(apiBase, authorization, currentIds, false),
    fetchMetricResults(apiBase, authorization, benchmarkIds, false)
  ]);

  const metrics: ScoreMetric[] = SCORE_METRIC_CONFIG.map((config, index) => {
    const current = currentResults[index];
    const benchmark = benchmarkResults[index];
    return {
      id: config.code,
      name: config.name,
      current_value: current?.value ?? null,
      benchmark_value: benchmark?.value ?? null,
      correlation: null,
      unit: config.unit
    };
  });

  return {
    updated_at: null,
    score: null,
    metrics
  };
};

const buildContext = (context: ChatContext): ApplicationContext => {
  if (context.type === "metric") {
    return {
      title: context.title,
      data: {
        metric_id: context.id,
        metric_name: context.title,
        metric_model_id: context.modelId,
        benchmark_model_id: context.benchmarkModelId
      }
    };
  }
  if (context.type === "org") {
    return {
      title: context.title,
      data: { org_id: context.id, org_name: context.title }
    };
  }
  if (context.type === "score") {
    return {
      title: context.title,
      data: {
        score_id: context.id,
        score_name: context.title,
        metric_model_id: context.modelId,
        benchmark_model_id: context.benchmarkModelId
      }
    };
  }
  return {
    title: "人力资本 ROI",
    data: { scope: "roi" }
  };
};

type AppProps = {
  basename?: string;
  token?: {
    accessToken: string;
    refreshToken: () => Promise<{ accessToken: string }>;
    onTokenExpired?: (code?: number) => void;
  };
  user?: {
    id: string;
    vision_name: string;
    account: string;
  };
  setMicroAppState?: (state: Record<string, any>) => boolean;
  onMicroAppStateChange?: (
    callback: (state: any, prev: any) => void,
    fireImmediately?: boolean
  ) => () => void;
};

const App = ({ token, setMicroAppState, onMicroAppStateChange }: AppProps) => {
  const [summary, setSummary] = useState<RoiSummary | null>(null);
  const [orgTree, setOrgTree] = useState<OrgTreeResponse | null>(null);
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(true);
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);
  const hasLoadedRef = useRef(false);
  const chatKitRef = useRef<Copilot>(null);
  const apiBase = DEFAULT_API_BASE;
  const accessToken = token?.accessToken ?? DEFAULT_TOKEN;
  const authorization = accessToken ? `Bearer ${accessToken}` : "";
  const chatkitToken = accessToken || DEFAULT_CHATKIT_TOKEN;

  useEffect(() => {
    if (!onMicroAppStateChange) return;
    const unsubscribe = onMicroAppStateChange(
      (state, prev) => {
        if (state?.language !== prev?.language) {
          console.log("全局状态变化:", state, prev);
        }
      },
      true
    );
    return () => {
      unsubscribe();
    };
  }, [onMicroAppStateChange]);

  useEffect(() => {
    if (!setMicroAppState) return;
    setMicroAppState({
      breadcrumb: [
        { name: "人力资本 ROI 分析", path: "/" },
        { name: "人才洞察与ROI决策工作台", path: "/" }
      ]
    });
  }, [setMicroAppState]);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;
    const loadData = async () => {
      try {
        const [summaryRes, scoreRes] = await Promise.all([
          fetchRoiSummary(apiBase, authorization),
          fetchScoreSummary(apiBase, authorization)
        ]);
        setSummary(summaryRes);
        setScore(scoreRes);
      } catch (error) {
        console.error("Failed to load ROI data", error);
      }
    };
    loadData();
  }, []);

  const treeData = useMemo(() => {
    if (!orgTree) return [];
    return [buildTreeData(orgTree.root, expandedKeys)];
  }, [orgTree, expandedKeys]);

  const keyIndex = useMemo(() => {
    if (!orgTree) return [];
    return buildKeyIndex(orgTree.root);
  }, [orgTree]);

  useEffect(() => {
    if (!searchValue) {
      setAutoExpandParent(true);
      return;
    }
    const matchedKeys = keyIndex
      .filter((item) => item.name.includes(searchValue))
      .map((item) => item.parentKey)
      .filter(Boolean) as string[];
    setExpandedKeys(matchedKeys);
    setAutoExpandParent(true);
  }, [searchValue, keyIndex]);

  const openChat = (context: ChatContext) => {
    setChatContext(context);
    setDrawerOpen(true);
    chatKitRef.current?.injectApplicationContext(buildContext(context));
  };

  const metricsToRender = useMemo(() => {
    const summaryMap = new Map<string, RoiMetric>();
    summary?.metrics?.forEach((metric) => summaryMap.set(metric.id, metric));
    return ROI_METRIC_CONFIG.map((config) => {
      const metric = summaryMap.get(config.code);
      return {
        id: config.code,
        name: metric?.name ?? config.name,
        current_value: metric?.current_value ?? null,
        benchmark_value: metric?.benchmark_value ?? null,
        change_pct: metric?.change_pct ?? null,
        achievement_pct: metric?.achievement_pct ?? null,
        unit: metric?.unit ?? config.unit,
        trend: metric?.trend
      };
    });
  }, [summary]);

  const scoreMetricsToRender = useMemo(() => {
    const scoreMap = new Map<string, ScoreMetric>();
    score?.metrics?.forEach((metric) => scoreMap.set(metric.id, metric));
    return SCORE_METRIC_CONFIG.map((config) => {
      const metric = scoreMap.get(config.code);
      return {
        id: config.code,
        name: metric?.name ?? config.name,
        current_value: metric?.current_value ?? null,
        benchmark_value: metric?.benchmark_value ?? null,
        correlation: metric?.correlation ?? null,
        direction: metric?.direction,
        unit: metric?.unit ?? config.unit
      };
    });
  }, [score]);

  return (
    <div className="h-screen bg-[#f5f6fb] text-ink flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold text-slate-800">
            人力资本ROI分析
          </div>
          <div className="flex items-center gap-3">
            <Button>返回上一层</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 min-h-0 px-6 py-6 overflow-hidden">
        <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 min-h-0 h-full overflow-y-auto pr-2">
            <section>
              <div className="grid gap-4 md:grid-cols-3">
                {metricsToRender.map((metric) => (
                  <Card
                    key={metric.id}
                    className="rounded-2xl border border-slate-200 shadow-sm"
                    bodyStyle={{ padding: 20 }}
                    onClick={() =>
                      openChat({
                        type: "metric",
                        id: metric.id,
                        title: metric.name,
                        modelId: ROI_METRIC_CONFIG.find(
                          (item) => item.code === metric.id
                        )?.modelId,
                        benchmarkModelId: ROI_METRIC_CONFIG.find(
                          (item) => item.code === metric.id
                        )?.benchmarkModelId
                      })
                    }
                    hoverable
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-sm font-semibold text-slate-700">
                        {metric.name}
                      </div>
                      <span
                        className={classNames(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          metric.change_pct === null
                            ? "bg-slate-100 text-slate-400"
                            : metric.trend === "up"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-rose-50 text-rose-600"
                        )}
                      >
                        {metric.change_pct === null
                          ? "--"
                          : `${metric.trend === "up" ? "▲" : "▼"} ${formatSignedPercent(
                              metric.change_pct
                            )}`}
                      </span>
                    </div>

                    <div className="mt-3 text-3xl font-semibold text-slate-900">
                      {formatMetricValue(metric.current_value, metric.unit)}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        基准{" "}
                        {formatMetricValue(metric.benchmark_value, metric.unit)}
                      </span>
                      <span>达成率 {formatPercent(metric.achievement_pct)}</span>
                    </div>
                    <div className="mt-3">
                      {isFiniteNumber(metric.achievement_pct) ? (
                        <Progress
                          percent={metric.achievement_pct}
                          showInfo={false}
                          strokeColor="#3b82f6"
                          trailColor="#e5e7eb"
                          strokeWidth={6}
                        />
                      ) : (
                        <div className="text-xs text-slate-400">达成率 --</div>
                      )}
                    </div>
                    <Button
                      type="link"
                      className="mt-2 !px-0 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        openChat({
                          type: "metric",
                          id: metric.id,
                          title: metric.name,
                          modelId: ROI_METRIC_CONFIG.find(
                            (item) => item.code === metric.id
                          )?.modelId,
                          benchmarkModelId: ROI_METRIC_CONFIG.find(
                            (item) => item.code === metric.id
                          )?.benchmarkModelId
                        });
                      }}
                    >
                      点击查看指标计算规则和趋势
                    </Button>
                  </Card>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-base font-semibold text-slate-700">
                  组织结构图
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                    低于基准值超过20%
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                    低于基准值20%以内
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    大于等于基准值
                  </span>
                </div>
              </div>

              <Card className="mt-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="grid grid-cols-2 gap-6 px-2 text-center text-xs text-slate-400">
                  <div>Level 1</div>
                  <div>Level 2</div>
                </div>
                <div className="mt-4">
                  {treeData.length > 0 ? (
                    <Tree
                      showLine={false}
                      blockNode
                      className="bg-transparent"
                      treeData={treeData}
                      expandedKeys={expandedKeys}
                      autoExpandParent={autoExpandParent}
                      onExpand={(keys) => {
                        setExpandedKeys(keys);
                        setAutoExpandParent(false);
                      }}
                      onSelect={(keys) => {
                        const selected = keys[0] as string | undefined;
                        if (!selected || !orgTree) return;
                        const node = keyIndex.find(
                          (item) => item.key === selected
                        );
                        if (!node) return;
                        setSelectedOrg(node.name);
                        openChat({ type: "org", id: selected, title: node.name });
                      }}
                    />
                  ) : (
                    <div className="py-10 text-center text-slate-500">--</div>
                  )}
                </div>
              </Card>
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-base font-semibold text-slate-700">
                  人效关联指标
                </div>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="搜索部门名称"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  className="max-w-xs"
                />
              </div>

              <Card className="mt-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">
                      人效评分
                    </span>
                    <Tag color="blue">
                      评分{" "}
                      {isFiniteNumber(score?.score)
                        ? score!.score.toFixed(1)
                        : "--"}
                    </Tag>
                    <Tooltip title="综合业务与人力指标计算得出的人效评分">
                      <InfoCircleOutlined className="text-slate-400" />
                    </Tooltip>
                  </div>
                  <div className="text-xs text-slate-400">相关系数≥0.8</div>
                </div>
                <div className="pt-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_140px] gap-3 text-xs text-slate-400">
                      <div>指标项</div>
                      <div className="text-center">当前值</div>
                      <div className="text-center">基准值</div>
                      <div className="text-right">相关系数</div>
                    </div>
                    {scoreMetricsToRender.map((metric) => {
                      const correlation = isFiniteNumber(metric.correlation)
                        ? metric.correlation
                        : null;
                      const direction =
                        isFiniteNumber(correlation) && correlation >= 0
                          ? "positive"
                          : "negative";
                      return (
                        <div
                          key={metric.id}
                          className="grid cursor-pointer grid-cols-[minmax(0,1fr)_120px_120px_140px] items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 transition hover:border-slate-200 hover:bg-slate-50"
                          onClick={() =>
                            openChat({
                              type: "score",
                              id: metric.id,
                              title: metric.name,
                              modelId: SCORE_METRIC_CONFIG.find(
                                (item) => item.code === metric.id
                              )?.modelId,
                              benchmarkModelId: SCORE_METRIC_CONFIG.find(
                                (item) => item.code === metric.id
                              )?.benchmarkModelId
                            })
                          }
                          role="button"
                          tabIndex={0}
                        >
                          <div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                              {metric.name}
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                              指标分析：--
                            </div>
                          </div>
                          <div className="text-center text-xs">
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">
                              {formatMetricValue(metric.current_value, metric.unit)}
                            </span>
                          </div>
                          <div className="text-center text-xs">
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600">
                              {formatMetricValue(metric.benchmark_value, metric.unit)}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-2 text-xs">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-500">
                              |r| ={" "}
                              {isFiniteNumber(correlation)
                                ? correlation.toFixed(2)
                                : "--"}
                            </span>
                            {isFiniteNumber(correlation) ? (
                              <span
                                className={classNames(
                                  "rounded-full px-2 py-0.5",
                                  direction === "positive"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-rose-50 text-rose-600"
                                )}
                              >
                                {direction === "positive" ? "正相关" : "负相关"}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-400">
                                --
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-4 text-xs text-slate-400">
                  {selectedOrg ? `已选组织：${selectedOrg}` : "选择组织节点以联动查看"}
                </div>
              </Card>
            </section>
          </div>

          <aside className="h-full">
            <div className="chat-panel rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Copilot
                agentKey={CHATKIT_AGENT_ID}
                ref={chatKitRef}
                title={chatContext?.title ?? "Copilot"}
                visible={drawerOpen}
                className="copilot-drawer"
                onClose={() => {
                  setDrawerOpen(true);
                }}
                baseUrl={CHATKIT_BASE_URL}
                agentId={CHATKIT_AGENT_ID}
                token={chatkitToken}
                businessDomain={CHATKIT_BUSINESS_DOMAIN}
              />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;
