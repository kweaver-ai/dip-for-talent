import { useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Input,
  Progress,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Tree
} from "antd";
import type { DataNode } from "antd/es/tree";
import {
  BarChartOutlined,
  SearchOutlined,
  RobotOutlined
} from "@ant-design/icons";
import classNames from "classnames";
import { Copilot, type ApplicationContext } from "@kweaver-ai/chatkit";

const { Title, Text } = Typography;

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

const formatPercent = (value: number | null) =>
  isFiniteNumber(value) ? `${value}%` : "--";

const resolveStatus = (node: OrgNode): "good" | "warn" | "risk" => {
  if (node.status) return node.status;
  if (!node.benchmark_value) return "good";
  const deltaRatio = (node.roi_value - node.benchmark_value) / node.benchmark_value;
  if (deltaRatio >= 0) return "good";
  if (Math.abs(deltaRatio) <= 0.2) return "warn";
  return "risk";
};

const buildTreeData = (node: OrgNode): DataNode => {
  const statusKey = resolveStatus(node);
  const status = statusMeta[statusKey];
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
        <div
          className={classNames(
            "rounded-xl border px-4 py-3 shadow-sm transition",
            "hover:shadow-md",
            {
              "border-green-200 bg-green-50": statusKey === "good",
              "border-amber-200 bg-amber-50": statusKey === "warn",
              "border-red-200 bg-red-50": statusKey === "risk"
            }
          )}
        >
          <div className="flex items-center justify-between">
            <div>
            <div className="text-base font-semibold text-ink">{node.name}</div>
            <div className="text-xs text-slate-500">负责人：{node.owner}</div>
          </div>
          <Badge color={status.color} text={status.label} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
          <div>当前 ROI：{formatNumber(node.roi_value)}</div>
          <div>基准值：{formatNumber(node.benchmark_value)}</div>
        </div>
      </div>
    </Tooltip>
  );

  return {
    key: node.id,
    title,
    children: node.children?.map(buildTreeData)
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

  const [drawerOpen, setDrawerOpen] = useState(false);
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
    return [buildTreeData(orgTree.root)];
  }, [orgTree]);

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

  const scoreColumns = [
    {
      title: "指标项",
      dataIndex: "name",
      key: "name"
    },
    {
      title: "当前值",
      dataIndex: "current_value",
      key: "current_value",
      render: (value: number | null, record: ScoreMetric) => (
        <Text>{formatMetricValue(value, record.unit)}</Text>
      )
    },
    {
      title: "基准值",
      dataIndex: "benchmark_value",
      key: "benchmark_value",
      render: (value: number | null, record: ScoreMetric) => (
        <Text type="secondary">{formatMetricValue(value, record.unit)}</Text>
      )
    },
    {
      title: "相关系数 (r)",
      dataIndex: "correlation",
      key: "correlation",
      render: (value: number | null, record: ScoreMetric) =>
        isFiniteNumber(value) ? (
          <Space>
            <Text>{value.toFixed(2)}</Text>
            <Tag color={record.direction === "positive" ? "green" : "volcano"}>
              {record.direction === "positive" ? "正相关" : "负相关"}
            </Tag>
          </Space>
        ) : (
          <Text type="secondary">--</Text>
        )
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-mist via-white to-amber-50 text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <BarChartOutlined />
              人力资本 ROI 分析
            </div>
            <Title level={2} className="!mb-1 !mt-2">
              人才洞察与ROI决策工作台
            </Title>
            <Text type="secondary">
              总览 → 组织结构 → 驱动因子，全局掌握ROI表现与关键风险。
            </Text>
          </div>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={() => openChat({ type: "copilot", title: "ROI Copilot" })}
          >
            ROI Copilot
          </Button>
        </div>

        <Divider className="!my-8" />

        <section>
          <div className="flex items-end justify-between">
            <div>
              <Title level={4} className="!mb-0">
                核心 ROI 指标总览
              </Title>
              <Text type="secondary">查看关键ROI指标与基准完成度</Text>
            </div>
            <Text type="secondary">
              {summary?.updated_at ? `更新于 ${summary.updated_at}` : "--"}
            </Text>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {summary?.metrics.length ? (
              summary.metrics.map((metric) => (
                <Card
                  key={metric.id}
                  className="rounded-2xl border-0 shadow-sm"
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
                    <div>
                      <div className="text-xs text-slate-500">{metric.id}</div>
                      <div className="text-lg font-semibold text-ink">
                        {metric.name}
                      </div>
                    </div>
                    {metric.change_pct === null ? (
                      <Tag>--</Tag>
                    ) : (
                      <Tag color={metric.trend === "up" ? "green" : "volcano"}>
                        {metric.trend === "up" ? "↑" : "↓"}
                        {formatPercent(metric.change_pct)}
                      </Tag>
                    )}
                  </div>

                  <div className="mt-4 text-3xl font-semibold">
                    {formatMetricValue(metric.current_value, metric.unit)}
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-slate-500">
                    <div>
                      同比变化 {formatPercent(metric.change_pct)} · 基准值{" "}
                      {formatMetricValue(metric.benchmark_value, metric.unit)}
                    </div>
                    <div>达成率 {formatPercent(metric.achievement_pct)}</div>
                  </div>
                  <div className="mt-4">
                    {isFiniteNumber(metric.achievement_pct) ? (
                      <>
                        <Progress
                          percent={metric.achievement_pct}
                          showInfo={false}
                          strokeColor="#b45309"
                        />
                        <div className="mt-1 text-xs text-slate-500">
                          达成率 {formatPercent(metric.achievement_pct)}
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-xs text-slate-500">
                        达成率 --
                      </div>
                    )}
                  </div>
                  <Button
                    type="link"
                    className="mt-2 !px-0"
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
                    查看指标计算规则和趋势
                  </Button>
                </Card>
              ))
            ) : (
              <div className="text-slate-500">--</div>
            )}
          </div>
        </section>

        <Divider className="!my-10" />

        <section>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Title level={4} className="!mb-0">
                组织结构 & ROI 分布
              </Title>
              <Text type="secondary">
                树状结构下钻组织层级，定位ROI异常区域
              </Text>
            </div>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索组织"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="max-w-xs"
            />
          </div>

          <div className="mt-6 rounded-2xl bg-white/70 p-4 shadow-sm">
            {treeData.length > 0 ? (
              <Tree
                showLine
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
                  const node = keyIndex.find((item) => item.key === selected);
                  if (!node) return;
                  setSelectedOrg(node.name);
                  openChat({ type: "org", id: selected, title: node.name });
                }}
              />
            ) : (
              <div className="py-8 text-center text-slate-500">--</div>
            )}
          </div>
        </section>

        <Divider className="!my-10" />

        <section>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Title level={4} className="!mb-0">
                人效关联指标
              </Title>
              <Text type="secondary">
                仅展示与ROI相关系数 |r| ≥ 0.8 的指标
              </Text>
            </div>
            <Text type="secondary">
              {score?.updated_at ? `更新于 ${score.updated_at}` : "--"}
            </Text>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_2fr]">
            <Card className="rounded-2xl border-0 shadow-sm">
              <div className="text-xs text-slate-500">人效评分</div>
              <div className="mt-4 text-5xl font-semibold text-ink">
                {isFiniteNumber(score?.score) ? score!.score.toFixed(1) : "--"}
              </div>
              <div className="mt-3 text-sm text-slate-500">
                综合业务与人力指标计算结果
              </div>
              <div className="mt-3 text-xs text-slate-400">
                {selectedOrg ? `已选组织：${selectedOrg}` : "选择组织节点以联动查看"}
              </div>
              <Button
                type="primary"
                className="mt-6"
                onClick={() => openChat({ type: "score", title: "人效评分" })}
              >
                查看评分解读
              </Button>
            </Card>

            <Card className="rounded-2xl border-0 shadow-sm">
              <Table
                dataSource={score?.metrics ?? []}
                columns={scoreColumns}
                rowKey="id"
                pagination={false}
                size="middle"
                locale={{ emptyText: "--" }}
                onRow={(record) => ({
                  onClick: () =>
                    openChat({
                      type: "score",
                      id: record.id,
                      title: record.name,
                      modelId: SCORE_METRIC_CONFIG.find(
                        (item) => item.code === record.id
                      )?.modelId,
                      benchmarkModelId: SCORE_METRIC_CONFIG.find(
                        (item) => item.code === record.id
                      )?.benchmarkModelId
                    })
                })}
              />
            </Card>
          </div>
        </section>
      </div>

      <div className="copilot-floating">
        <Copilot
          agentKey={CHATKIT_AGENT_ID}
          ref={chatKitRef}
          title={chatContext?.title ?? "ROI Copilot"}
          visible={drawerOpen}
          className="copilot-drawer"
          onClose={() => {
            setDrawerOpen(false);
            chatKitRef.current?.removeApplicationContext();
          }}
          baseUrl={CHATKIT_BASE_URL}
          agentId={CHATKIT_AGENT_ID}
          token={chatkitToken}
          businessDomain={CHATKIT_BUSINESS_DOMAIN}
        />
      </div>
    </div>
  );
};

export default App;
