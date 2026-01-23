import { useEffect, useMemo, useRef, useState } from "react";
import {
  AutoComplete,
  Button,
  Card,
  Input,
  Progress,
  Skeleton,
  Tag,
  Tooltip
} from "antd";
import {
  DownOutlined,
  InfoCircleOutlined,
  RightOutlined,
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
  "01KCNETG4CKP5TVRJ7KK44CFJH";
const DEFAULT_CHATKIT_TOKEN = DEFAULT_TOKEN;
const CHATKIT_BUSINESS_DOMAIN =
  import.meta.env.VITE_DIP_CHATKIT_BUSINESS_DOMAIN ?? "bd_public";
const REQUEST_TIMEOUT_MS = 60_000;
type MetricTimeRange = {
  start: number;
  end: number;
};

const METRIC_TIME_RANGE: MetricTimeRange = {
  start: Date.UTC(2025, 0, 1, 0, 0, 0, 0),
  end: Date.UTC(2025, 11, 31, 23, 59, 59, 999)
};
const shiftMetricRange = (
  range: MetricTimeRange,
  years: number
): MetricTimeRange => {
  const start = new Date(range.start);
  const end = new Date(range.end);
  start.setUTCFullYear(start.getUTCFullYear() + years);
  end.setUTCFullYear(end.getUTCFullYear() + years);
  return { start: start.getTime(), end: end.getTime() };
};
const PREVIOUS_METRIC_TIME_RANGE = shiftMetricRange(METRIC_TIME_RANGE, -1);
const ORG_CURRENT_NUMERATOR_MODEL_ID = "d4sjri5g5lk40hvh4800";
const ORG_CURRENT_DENOMINATOR_MODEL_ID = "d4t7hqdg5lk40hvh486g";
const ORG_SALES_HEADCOUNT_MODEL_ID = "d4t7o6lg5lk40hvh4870";
const ORG_KN_ID = "d4rok5r5s3q8va76m88g";
const ORG_OT_ID = "d4rsbjb5s3q8va76m8cg";
const ORG_ROOT_NAME = "大客户销售线";
const ORG_DIMENSION_FIELD = "dep_code";
const SCORE_DIMENSION_CANDIDATES = [
  "project_owner_dep2_code",
  "project_owner_dep_code",
  "dep_code",
  "dept_code",
  "department_code",
  "org_code",
  "org_id"
];
type ScoreFilterMode = "self" | "dep2";

const SCORE_DIMENSION_OVERRIDES: Record<string, string | null> = {
  d4skbjtg5lk40hvh4820: "project_owner_dep2_code",
  d4t5iflg5lk40hvh483g: "project_owner_dep2_code",
  d4skcddg5lk40hvh482g: "project_owner_dep2_code",
  d4sk4blg5lk40hvh480g: "dept_code",
  d4t8n0dg5lk40hvh487g: "dept_code",
  d5fn0ffmisa6vs0oncrg: "dep_code"
};
const SCORE_FILTER_MODE_OVERRIDES: Record<string, ScoreFilterMode> = {
  d4skbjtg5lk40hvh4820: "dep2",
  d4t5iflg5lk40hvh483g: "dep2",
  d4skcddg5lk40hvh482g: "dep2",
  d4sk4blg5lk40hvh480g: "dep2",
  d4t8n0dg5lk40hvh487g: "dep2",
  d5fn0ffmisa6vs0oncrg: "self"
};

const roiDimensionCache = new Map<string, string | null>();
const fetchRoiDimensionField = async (
  apiBase: string,
  authorization: string,
  modelId: string
) => {
  if (roiDimensionCache.has(modelId)) {
    const cached = roiDimensionCache.get(modelId) ?? null;
    if (cached) return cached;
    roiDimensionCache.delete(modelId);
  }
  const field = await fetchMetricDimensionField(
    apiBase,
    authorization,
    modelId,
    ORG_DIMENSION_CANDIDATES
  );
  if (field) {
    roiDimensionCache.set(modelId, field);
  }
  return field;
};
const ORG_DIMENSION_CANDIDATES = [
  "project_owner_dep2_code",
  "project_owner_dep_code",
  "dep_code",
  "department",
  "department_code",
  "dept_code",
  "dep1",
  "dep2",
  "dep3",
  "dep4",
  "dep5",
  "org_code",
  "org_id",
  "depcode",
  "deptcode"
];
const ORG_FALLBACK_KEYS = {
  name: ["dep_name", "department_name", "name"],
  id: ["dep_code", "department_code", "code", "id"],
  parent: ["p_code", "parent_code", "parent_id"],
  level: ["dep_level", "level"],
  status: ["status"],
  owner: ["manager_name", "owner", "leader", "manager"],
  headcount: ["staffs_number", "headcount", "zaizhi_num", "staff_num"]
};
const ORG_REQUEST_PROPERTIES = [
  "dep_code",
  "p_code",
  "dep_name",
  "dep_level",
  "status",
  "manager_name",
  "staffs_number",
  "headcount",
  "zaizhi_num",
  "staff_num"
];

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

type OrgRecord = {
  id: string;
  name: string;
  nameAliases: string[];
  owner: string | null;
  headcount: number | null;
  currentValue: number | null;
  benchmarkValue: number | null;
  status: "good" | "warn" | "risk" | "unknown";
  parentId: string | null;
  level: number | null;
  levelLabel: string | null;
};

type OrgTypeProperty = {
  name: string;
  display_name?: string;
};

type OrgObjectType = {
  display_key?: string;
  primary_keys?: string[];
  data_properties?: OrgTypeProperty[];
  logic_properties?: OrgTypeProperty[];
};

type OrgObjectResponse = {
  object_type?: OrgObjectType;
  datas?: Record<string, unknown>[];
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
  risk: { label: "低于基准>20%", color: "#ef4444" },
  unknown: { label: "暂无数据", color: "#94a3b8" }
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

const toPrimitive = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return toPrimitive(value[0]);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("value" in record) return toPrimitive(record.value);
    if ("values" in record) return toPrimitive(record.values);
    if ("display" in record) return toPrimitive(record.display);
  }
  return null;
};

const toNumber = (value: unknown): number | null => {
  const primitive = toPrimitive(value);
  if (typeof primitive === "number" && Number.isFinite(primitive)) return primitive;
  if (typeof primitive === "string") {
    const parsed = Number(primitive);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeOrgId = (value: unknown): string | null => {
  const primitive = toPrimitive(value);
  if (primitive === null || primitive === undefined) return null;
  const text = String(primitive).trim();
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (normalized === "0" || normalized === "null" || normalized === "undefined") {
    return null;
  }
  const compact = text.replace(/\s+/g, "");
  const normalizedId = /^[a-z0-9_-]+$/i.test(compact)
    ? compact.toUpperCase()
    : compact;
  return normalizedId;
};

const parseLevelNumber = (value: unknown): number | null => {
  const primitive = toPrimitive(value);
  if (typeof primitive === "number" && Number.isFinite(primitive)) return primitive;
  if (typeof primitive !== "string") return null;
  const match = primitive.match(/\d+/);
  if (match) {
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const map: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };
  const found = Object.keys(map).find((key) => primitive.includes(key));
  return found ? map[found] : null;
};

const normalizeFieldName = (value: string) =>
  value.replace(/[_.-]/g, "").toLowerCase();

const getLabelValue = (
  labels: Record<string, unknown> | undefined,
  fieldName: string
) => {
  if (!labels) return null;
  const target = normalizeFieldName(fieldName);
  for (const [key, value] of Object.entries(labels)) {
    if (normalizeFieldName(key) === target) {
      return normalizeOrgId(value);
    }
  }
  return null;
};

const normalizeText = (value?: string) => (value ?? "").toLowerCase();
const normalizeSearchText = (value?: string) => (value ?? "").trim().toLowerCase();
const normalizeMatchText = (value?: string) =>
  (value ?? "").replace(/\s+/g, "").toLowerCase();

const pickPropertyKey = (
  objectType: OrgObjectType | undefined,
  matchers: string[]
) => {
  const properties = [
    ...(objectType?.data_properties ?? []),
    ...(objectType?.logic_properties ?? [])
  ];
  const normalizedMatchers = matchers.map((item) => item.toLowerCase());
  for (const property of properties) {
    const display = normalizeText(property.display_name);
    const name = normalizeText(property.name);
    if (normalizedMatchers.some((matcher) => display.includes(matcher))) {
      return property.name;
    }
    if (normalizedMatchers.some((matcher) => name.includes(matcher))) {
      return property.name;
    }
  }
  return undefined;
};

const getRecordValue = (
  record: Record<string, unknown>,
  key?: string
): unknown => {
  if (!key) return null;
  if (key in record) return record[key];
  const nested = record.properties;
  if (nested && typeof nested === "object" && key in nested) {
    return (nested as Record<string, unknown>)[key];
  }
  const identities = record.unique_identities;
  if (identities && typeof identities === "object" && key in identities) {
    return (identities as Record<string, unknown>)[key];
  }
  return null;
};

const hasRecordKey = (record: Record<string, unknown>, key: string) => {
  if (key in record) return true;
  const nested = record.properties;
  if (nested && typeof nested === "object") {
    return key in (nested as Record<string, unknown>);
  }
  const identities = record.unique_identities;
  if (identities && typeof identities === "object") {
    return key in (identities as Record<string, unknown>);
  }
  return false;
};

const pickFallbackKey = (
  record: Record<string, unknown>,
  candidates: string[]
) => candidates.find((key) => hasRecordKey(record, key));

const isDisabledOrgStatus = (value: unknown) => {
  const primitive = toPrimitive(value);
  if (primitive === null || primitive === undefined) return false;
  if (typeof primitive === "boolean") return !primitive;
  if (typeof primitive === "number") return primitive === 0;
  const normalized = String(primitive).trim().toLowerCase();
  return (
    normalized === "0" ||
    normalized === "false" ||
    normalized === "disabled" ||
    normalized === "inactive" ||
    normalized === "停用" ||
    normalized === "禁用" ||
    normalized === "失效"
  );
};

const resolveOrgStatus = (
  currentValue: number | null,
  benchmarkValue: number | null
): "good" | "warn" | "risk" | "unknown" => {
  if (!isFiniteNumber(currentValue) || !isFiniteNumber(benchmarkValue)) {
    return "unknown";
  }
  if (benchmarkValue === 0) return "unknown";
  const deltaRatio = (currentValue - benchmarkValue) / benchmarkValue;
  if (deltaRatio >= 0) return "good";
  if (Math.abs(deltaRatio) <= 0.2) return "warn";
  return "risk";
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

const buildMetricQuery = (
  withGrowth: boolean,
  filters?: { name: string; value: (string | number | boolean)[]; operation: string }[],
  range: MetricTimeRange = METRIC_TIME_RANGE
) => ({
  instant: true,
  start: range.start,
  end: range.end,
  ...(filters?.length ? { filters } : {}),
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
  withGrowth: boolean,
  filters?: { name: string; value: (string | number | boolean)[]; operation: string }[],
  range: MetricTimeRange = METRIC_TIME_RANGE
): Promise<
  {
    id: string;
    result: Record<string, any>;
    value: number | null;
    growthRate: number | null;
  }[]
> => {
  const body =
    ids.length === 1
      ? buildMetricQuery(withGrowth, filters, range)
      : ids.map(() => buildMetricQuery(withGrowth, filters, range));
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

const fetchMetricLabels = async (
  apiBase: string,
  authorization: string,
  modelId: string
): Promise<string[]> => {
  const response = await fetchWithTimeout(
    `${apiBase}/mdl-uniquery/v1/metric-models/${modelId}/labels`,
    {
      method: "GET",
      headers: {
        ...(authorization ? { Authorization: authorization } : {})
      }
    }
  );
  if (!response.ok) {
    throw new Error(`Metric labels query failed: ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
};

const fetchMetricFields = async (
  apiBase: string,
  authorization: string,
  modelId: string
): Promise<string[]> => {
  const response = await fetchWithTimeout(
    `${apiBase}/mdl-uniquery/v1/metric-models/${modelId}/fields`,
    {
      method: "GET",
      headers: {
        ...(authorization ? { Authorization: authorization } : {})
      }
    }
  );
  if (!response.ok) {
    throw new Error(`Metric fields query failed: ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item) {
        return String((item as { name?: unknown }).name ?? "");
      }
      return "";
    })
    .filter(Boolean);
};

const pickDimensionField = (labels: string[], candidates: string[]) => {
  const normalized = labels.map((item) => normalizeFieldName(item));
  const candidate = candidates.find((item) =>
    normalized.includes(normalizeFieldName(item))
  );
  if (candidate) {
    const matched = labels.find(
      (item) => normalizeFieldName(item) === normalizeFieldName(candidate)
    );
    return matched ?? candidate;
  }
  return null;
};

const fetchMetricDimensionField = async (
  apiBase: string,
  authorization: string,
  modelId: string,
  candidates: string[] = ORG_DIMENSION_CANDIDATES
): Promise<string | null> => {
  try {
    const labels = await fetchMetricLabels(apiBase, authorization, modelId);
    const fromLabels = pickDimensionField(labels, candidates);
    if (fromLabels) return fromLabels;
  } catch (error) {
    console.warn("metric labels unavailable", modelId, error);
  }
  try {
    const fields = await fetchMetricFields(apiBase, authorization, modelId);
    const fromFields = pickDimensionField(fields, candidates);
    if (fromFields) return fromFields;
  } catch (error) {
    console.warn("metric fields unavailable", modelId, error);
  }
  return null;
};

const scoreDimensionCache = new Map<string, string | null>();
const fetchScoreDimensionField = async (
  apiBase: string,
  authorization: string,
  modelId: string
) => {
  if (modelId in SCORE_DIMENSION_OVERRIDES) {
    const override = SCORE_DIMENSION_OVERRIDES[modelId];
    if (override) {
      scoreDimensionCache.set(modelId, override);
    }
    return override;
  }
  if (scoreDimensionCache.has(modelId)) {
    const cached = scoreDimensionCache.get(modelId) ?? null;
    if (cached) return cached;
    scoreDimensionCache.delete(modelId);
  }
  const field = await fetchMetricDimensionField(
    apiBase,
    authorization,
    modelId,
    SCORE_DIMENSION_CANDIDATES
  );
  if (field) {
    scoreDimensionCache.set(modelId, field);
  }
  return field;
};

const fetchOrgMetricMap = async (
  apiBase: string,
  authorization: string,
  modelId: string,
  dimensionField: string | null,
  range: MetricTimeRange = METRIC_TIME_RANGE
): Promise<Record<string, number>> => {
  if (!dimensionField) {
    return {};
  }
  const response = await fetchWithTimeout(
    `${apiBase}/mdl-uniquery/v1/metric-models/${modelId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HTTP-Method-Override": "GET",
        ...(authorization ? { Authorization: authorization } : {})
      },
      body: JSON.stringify({
        instant: true,
        start: range.start,
        end: range.end,
        analysis_dimensions: [dimensionField]
      })
    }
  );
  if (!response.ok) {
    throw new Error(`Org metric query failed: ${response.status}`);
  }
  const payload = await response.json();
  const result = Array.isArray(payload) ? payload[0] : payload;
  const datas = result?.datas ?? [];
  const map: Record<string, number> = {};
  datas.forEach((item: Record<string, unknown>) => {
    const labels = item.labels as Record<string, unknown> | undefined;
    const labelValue = getLabelValue(labels, dimensionField);
    if (!labelValue) return;
    const value = extractFirstValue((item.values as unknown[]) ?? []);
    if (!isFiniteNumber(value)) return;
    map[labelValue] = value;
  });
  return map;
};

const emptyMetricResult = (id: string) => ({
  id,
  result: {},
  value: null,
  growthRate: null
});

const resolveScoreFilterValue = (
  dimensionField: string,
  depCode: string | null,
  dep2Code?: string | null,
  filterMode?: ScoreFilterMode
) => {
  if (!dimensionField) return null;
  const normalized = normalizeFieldName(dimensionField);
  const resolvedMode: ScoreFilterMode =
    filterMode ??
    (normalized.includes("dep2") || normalized === "deptcode"
      ? "dep2"
      : "self");
  if (resolvedMode === "dep2") {
    return dep2Code ?? null;
  }
  return depCode ?? null;
};

const fetchScoreMetricResults = async (
  apiBase: string,
  authorization: string,
  ids: string[],
  depCode: string | null,
  dep2Code?: string | null,
  dep2Codes?: string[]
) => {
  const results = new Map<
    string,
    { id: string; result: Record<string, any>; value: number | null; growthRate: number | null }
  >();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const dimensionField = await fetchScoreDimensionField(
          apiBase,
          authorization,
          id
        );
        if (!dimensionField) {
          results.set(id, emptyMetricResult(id));
          return;
        }
        const filterMode = SCORE_FILTER_MODE_OVERRIDES[id];
        let filterValues: string[] | null = null;
        if (filterMode === "dep2") {
          if (dep2Codes && dep2Codes.length) {
            filterValues = dep2Codes;
          } else if (dep2Code) {
            filterValues = [dep2Code];
          }
        } else {
          const filterValue = resolveScoreFilterValue(
            dimensionField,
            depCode,
            dep2Code,
            filterMode
          );
          if (filterValue) {
            filterValues = [filterValue];
          }
        }
        if (!filterValues) {
          results.set(id, emptyMetricResult(id));
          return;
        }
        const [metric] = await fetchMetricResults(
          apiBase,
          authorization,
          [id],
          false,
          [
            {
              name: dimensionField,
              value: filterValues,
              operation: "in"
            }
          ]
        );
        results.set(id, metric ?? emptyMetricResult(id));
      } catch (error) {
        console.warn("Score metric query failed", id, error);
        results.set(id, emptyMetricResult(id));
      }
    })
  );
  return results;
};

const resolveRoiFilterValues = (
  dimensionField: string,
  depCode?: string | null,
  dep2Code?: string | null,
  dep2Codes?: string[]
) => {
  const normalized = normalizeFieldName(dimensionField);
  if (normalized.includes("dep2")) {
    if (dep2Codes && dep2Codes.length) return dep2Codes;
    if (dep2Code) return [dep2Code];
    return null;
  }
  return depCode ? [depCode] : null;
};

const fetchRoiSummary = async (
  apiBase: string,
  authorization: string,
  depCode?: string | null,
  dep2Code?: string | null,
  dep2Codes?: string[]
): Promise<RoiSummary> => {
  const currentResults = await Promise.all(
    ROI_METRIC_CONFIG.map(async (metric) => {
      if (!depCode) {
        const [result] = await fetchMetricResults(
          apiBase,
          authorization,
          [metric.modelId],
          true
        );
        return result ?? emptyMetricResult(metric.modelId);
      }
      const dimensionField = await fetchRoiDimensionField(
        apiBase,
        authorization,
        metric.modelId
      );
      if (!dimensionField) {
        const [result] = await fetchMetricResults(
          apiBase,
          authorization,
          [metric.modelId],
          true
        );
        return result ?? emptyMetricResult(metric.modelId);
      }
      const filterValues = resolveRoiFilterValues(
        dimensionField,
        depCode,
        dep2Code,
        dep2Codes
      );
      if (!filterValues) {
        return emptyMetricResult(metric.modelId);
      }
      const [result] = await fetchMetricResults(
        apiBase,
        authorization,
        [metric.modelId],
        true,
        [
          {
            name: dimensionField,
            value: filterValues,
            operation: "in"
          }
        ]
      );
      return result ?? emptyMetricResult(metric.modelId);
    })
  );

  const benchmarkResults = await Promise.all(
    ROI_METRIC_CONFIG.map(async (metric) => {
      if (!depCode) {
        const [result] = await fetchMetricResults(
          apiBase,
          authorization,
          [metric.benchmarkModelId],
          false
        );
        return result ?? emptyMetricResult(metric.benchmarkModelId);
      }
      const dimensionField = await fetchRoiDimensionField(
        apiBase,
        authorization,
        metric.benchmarkModelId
      );
      if (!dimensionField) {
        const [result] = await fetchMetricResults(
          apiBase,
          authorization,
          [metric.benchmarkModelId],
          false
        );
        return result ?? emptyMetricResult(metric.benchmarkModelId);
      }
      const filterValues = resolveRoiFilterValues(
        dimensionField,
        depCode,
        dep2Code,
        dep2Codes
      );
      if (!filterValues) {
        return emptyMetricResult(metric.benchmarkModelId);
      }
      const [result] = await fetchMetricResults(
        apiBase,
        authorization,
        [metric.benchmarkModelId],
        false,
        [
          {
            name: dimensionField,
            value: filterValues,
            operation: "in"
          }
        ]
      );
      return result ?? emptyMetricResult(metric.benchmarkModelId);
    })
  );

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
  authorization: string,
  depCode?: string | null,
  dep2Code?: string | null,
  dep2Codes?: string[]
): Promise<ScoreResponse> => {
  const currentIds = SCORE_METRIC_CONFIG.map((metric) => metric.modelId);
  const benchmarkIds = SCORE_METRIC_CONFIG.map(
    (metric) => metric.benchmarkModelId
  );
  if (!depCode) {
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
  }
  const [currentResults, benchmarkResults] = await Promise.all([
    fetchScoreMetricResults(
      apiBase,
      authorization,
      currentIds,
      depCode,
      dep2Code,
      dep2Codes
    ),
    fetchScoreMetricResults(
      apiBase,
      authorization,
      benchmarkIds,
      depCode,
      dep2Code,
      dep2Codes
    )
  ]);

  const metrics: ScoreMetric[] = SCORE_METRIC_CONFIG.map((config) => {
    const current = currentResults.get(config.modelId);
    const benchmark = benchmarkResults.get(config.benchmarkModelId);
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

const fetchOrgRecords = async (
  apiBase: string,
  authorization: string
): Promise<OrgRecord[]> => {
  const response = await fetchWithTimeout(
    `${apiBase}/ontology-query/v1/knowledge-networks/${ORG_KN_ID}/object-types/${ORG_OT_ID}?include_type_info=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HTTP-Method-Override": "GET",
        ...(authorization ? { Authorization: authorization } : {})
      },
      body: JSON.stringify({ limit: 10000, properties: ORG_REQUEST_PROPERTIES })
    }
  );
  if (!response.ok) {
    throw new Error(`Org query failed: ${response.status}`);
  }
  const payload = (await response.json()) as OrgObjectResponse & {
    type?: OrgObjectType;
  };
  const objectType = payload.object_type ?? payload.type;
  const sample = (payload.datas ?? [])[0] ?? {};
  const fallbackNameKey = pickFallbackKey(sample, ORG_FALLBACK_KEYS.name);
  const fallbackIdKey = pickFallbackKey(sample, ORG_FALLBACK_KEYS.id);
  const fallbackParentKey = pickFallbackKey(sample, ORG_FALLBACK_KEYS.parent);
  const fallbackLevelKey = pickFallbackKey(sample, ORG_FALLBACK_KEYS.level);
  const fallbackStatusKey = pickFallbackKey(sample, ORG_FALLBACK_KEYS.status);
  const fallbackOwnerKey = pickFallbackKey(sample, ORG_FALLBACK_KEYS.owner);
  const fallbackHeadcountKey = pickFallbackKey(
    sample,
    ORG_FALLBACK_KEYS.headcount
  );
  const fallbackNameKeys = ORG_FALLBACK_KEYS.name;
  const nameKey =
    objectType?.display_key ??
    pickPropertyKey(objectType, ["名称", "name", "组织", "部门", "机构"]) ??
    fallbackNameKey;
  const ownerKey = pickPropertyKey(objectType, [
    "负责人",
    "主管",
    "owner",
    "manager",
    "leader"
  ]) ?? fallbackOwnerKey;
  const headcountKey =
    pickPropertyKey(objectType, ["人员规模", "在岗人数", "编制", "headcount"]) ??
    fallbackHeadcountKey;
  const currentKey = pickPropertyKey(objectType, [
    "当前",
    "现值",
    "current",
    "roi",
    "指标"
  ]);
  const benchmarkKey = pickPropertyKey(objectType, [
    "基准",
    "目标",
    "benchmark",
    "target"
  ]);
  const levelKey =
    pickPropertyKey(objectType, ["层级", "级别", "level"]) ?? fallbackLevelKey;
  const parentKey = pickPropertyKey(objectType, [
    "上级",
    "父",
    "所属",
    "parent",
    "上层"
  ]) ?? fallbackParentKey;
  const statusKey =
    pickPropertyKey(objectType, ["状态", "status", "启用", "有效"]) ??
    fallbackStatusKey;
  const primaryKey = fallbackIdKey ?? objectType?.primary_keys?.[0];

  return (payload.datas ?? [])
    .map((item, index) => {
      const statusValue = statusKey ? getRecordValue(item, statusKey) : null;
      if (isDisabledOrgStatus(statusValue)) {
        return null;
      }
      const idValue =
        (primaryKey ? getRecordValue(item, primaryKey) : null) ??
        item.id ??
        (nameKey ? getRecordValue(item, nameKey) : null) ??
        index;
      const id = normalizeOrgId(idValue) ?? String(index);
      const name =
        String(
          toPrimitive(
            nameKey
              ? getRecordValue(item, nameKey)
              : item.name ?? item.title ?? item.display
          ) ?? "--"
        ) || "--";
      const aliasSet = new Set<string>();
      const addAlias = (value: unknown) => {
        const primitive = toPrimitive(value);
        if (primitive === null || primitive === undefined) return;
        const text = String(primitive).trim();
        if (!text || text === name) return;
        aliasSet.add(text);
      };
      fallbackNameKeys.forEach((key) => {
        addAlias(getRecordValue(item, key));
      });
      if (nameKey && nameKey !== fallbackNameKey) {
        addAlias(getRecordValue(item, nameKey));
      }
      const owner = toPrimitive(
        ownerKey ? getRecordValue(item, ownerKey) : null
      );
      const headcount = toNumber(
        headcountKey ? getRecordValue(item, headcountKey) : null
      );
      const currentValue = toNumber(
        currentKey ? getRecordValue(item, currentKey) : null
      );
      const benchmarkValue = toNumber(
        benchmarkKey ? getRecordValue(item, benchmarkKey) : null
      );
      const levelRaw = levelKey ? getRecordValue(item, levelKey) : null;
      const levelLabel =
        levelRaw !== null && levelRaw !== undefined
          ? String(toPrimitive(levelRaw) ?? "")
          : null;
      const levelValue = parseLevelNumber(levelRaw);
      const parentValue = toPrimitive(
        parentKey ? getRecordValue(item, parentKey) : null
      );
      const parentId = normalizeOrgId(parentValue);
      return {
        id,
        name,
        nameAliases: Array.from(aliasSet),
        owner: owner ? String(owner) : null,
        headcount,
        currentValue,
        benchmarkValue,
        status: resolveOrgStatus(currentValue, benchmarkValue),
        parentId,
        level: isFiniteNumber(levelValue) ? levelValue : null,
        levelLabel: levelLabel && levelLabel.length ? levelLabel : null
      };
    })
    .filter((record): record is OrgRecord => Boolean(record));
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
  const [orgRecords, setOrgRecords] = useState<OrgRecord[]>([]);
  const [orgMetricValues, setOrgMetricValues] = useState<{
    current: Record<string, number>;
    benchmark: Record<string, number>;
  }>({ current: {}, benchmark: {} });
  const [orgKpiValues, setOrgKpiValues] = useState<
    Record<string, Record<string, number>>
  >({});
  const [orgKpiBenchmarks, setOrgKpiBenchmarks] = useState<
    Record<string, Record<string, number>>
  >({});
  const [orgKpiYoY, setOrgKpiYoY] = useState<
    Record<string, Record<string, number>>
  >({});
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roiLoading, setRoiLoading] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [chatWidth, setChatWidth] = useState(360);
  const [isLargeScreen, setIsLargeScreen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  const [searchValue, setSearchValue] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [expandedPath, setExpandedPath] = useState<string[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(true);
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);
  const chatKitRef = useRef<Copilot>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const resizeStateRef = useRef({ startX: 0, startWidth: 360 });
  const isResizingRef = useRef(false);
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
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsLargeScreen(event.matches);
    };
    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [apiBase, authorization]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current || !layoutRef.current) return;
      const delta = event.clientX - resizeStateRef.current.startX;
      const containerWidth = layoutRef.current.getBoundingClientRect().width;
      const minWidth = 320;
      const maxWidth = Math.max(minWidth, containerWidth - 320);
      const nextWidth = Math.min(
        maxWidth,
        Math.max(minWidth, resizeStateRef.current.startWidth - delta)
      );
      setChatWidth(Math.round(nextWidth));
    };
    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [apiBase, authorization]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const baseResults = await Promise.allSettled([
        fetchOrgRecords(apiBase, authorization)
      ]);
      const [orgRes] = baseResults;
      if (orgRes.status === "fulfilled") {
        setOrgRecords(orgRes.value);
      }
      const dimensionResults = await Promise.allSettled([
        fetchMetricDimensionField(
          apiBase,
          authorization,
          ORG_CURRENT_NUMERATOR_MODEL_ID
        ),
        fetchMetricDimensionField(
          apiBase,
          authorization,
          ORG_CURRENT_DENOMINATOR_MODEL_ID
        ),
        fetchMetricDimensionField(
          apiBase,
          authorization,
          "d5fh329evebbrr2gqo3g"
        ),
        fetchMetricDimensionField(
          apiBase,
          authorization,
          ORG_SALES_HEADCOUNT_MODEL_ID
        )
      ]);
      const headcountFieldResults = await Promise.allSettled([
        fetchMetricFields(apiBase, authorization, ORG_SALES_HEADCOUNT_MODEL_ID)
      ]);
      const numeratorDimensionField =
        (dimensionResults[0]?.status === "fulfilled"
          ? dimensionResults[0].value
          : null) ?? ORG_DIMENSION_FIELD;
      const denominatorDimensionField =
        (dimensionResults[1]?.status === "fulfilled"
          ? dimensionResults[1].value
          : null) ??
        numeratorDimensionField ??
        ORG_DIMENSION_FIELD;
      const benchmarkDimensionField =
        (dimensionResults[2]?.status === "fulfilled"
          ? dimensionResults[2].value
          : null) ?? ORG_DIMENSION_FIELD;
      const headcountFieldCandidates = [
        "department",
        "dep3",
        "dep2",
        "dep1",
        "dep_code",
        "dept_code",
        "department_code"
      ];
      const headcountFieldFromFields =
        headcountFieldResults[0]?.status === "fulfilled"
          ? pickDimensionField(
              headcountFieldResults[0].value,
              headcountFieldCandidates
            )
          : null;
      const headcountDimensionField =
        headcountFieldFromFields ??
        ((dimensionResults[3]?.status === "fulfilled"
          ? dimensionResults[3].value
          : null) ??
        denominatorDimensionField ??
        numeratorDimensionField ??
        ORG_DIMENSION_FIELD);
      const metricResults = await Promise.allSettled([
        fetchOrgMetricMap(
          apiBase,
          authorization,
          ORG_CURRENT_NUMERATOR_MODEL_ID,
          numeratorDimensionField
        ),
        fetchOrgMetricMap(
          apiBase,
          authorization,
          ORG_CURRENT_DENOMINATOR_MODEL_ID,
          denominatorDimensionField
        ),
        fetchOrgMetricMap(
          apiBase,
          authorization,
          ORG_SALES_HEADCOUNT_MODEL_ID,
          headcountDimensionField
        ),
        fetchOrgMetricMap(
          apiBase,
          authorization,
          "d5fh329evebbrr2gqo3g",
          benchmarkDimensionField
        )
      ]);
      const prevMetricResults = await Promise.allSettled([
        fetchOrgMetricMap(
          apiBase,
          authorization,
          ORG_CURRENT_NUMERATOR_MODEL_ID,
          numeratorDimensionField,
          PREVIOUS_METRIC_TIME_RANGE
        ),
        fetchOrgMetricMap(
          apiBase,
          authorization,
          ORG_CURRENT_DENOMINATOR_MODEL_ID,
          denominatorDimensionField,
          PREVIOUS_METRIC_TIME_RANGE
        ),
        fetchOrgMetricMap(
          apiBase,
          authorization,
          ORG_SALES_HEADCOUNT_MODEL_ID,
          headcountDimensionField,
          PREVIOUS_METRIC_TIME_RANGE
        )
      ]);
      const kpiMapResults = await Promise.allSettled(
        ROI_METRIC_CONFIG.map(async (metric) => {
          const dimensionField = await fetchRoiDimensionField(
            apiBase,
            authorization,
            metric.modelId
          );
          const values = await fetchOrgMetricMap(
            apiBase,
            authorization,
            metric.modelId,
            dimensionField
          );
          return { code: metric.code, values };
        })
      );
      const kpiBenchmarkMapResults = await Promise.allSettled(
        ROI_METRIC_CONFIG.map(async (metric) => {
          const dimensionField = await fetchRoiDimensionField(
            apiBase,
            authorization,
            metric.benchmarkModelId
          );
          const values = await fetchOrgMetricMap(
            apiBase,
            authorization,
            metric.benchmarkModelId,
            dimensionField
          );
          return { code: metric.code, values };
        })
      );
      const [
        orgNumeratorRes,
        orgDenominatorRes,
        orgHeadcountRes,
        orgBenchmarkRes
      ] = metricResults;
      const [
        orgPrevNumeratorRes,
        orgPrevDenominatorRes,
        orgPrevHeadcountRes
      ] = prevMetricResults;
      const orgList = orgRes.status === "fulfilled" ? orgRes.value : [];
      const orgIdByNormalized = new Map<string, string>();
      const orgIdByName = new Map<string, string>();
      orgList.forEach((record) => {
        const normalizedId = normalizeOrgId(record.id);
        if (normalizedId) {
          orgIdByNormalized.set(normalizedId, record.id);
        }
        const normalizedName = normalizeSearchText(record.name);
        if (normalizedName) {
          orgIdByName.set(normalizedName, record.id);
        }
        const compactName = normalizeMatchText(record.name);
        if (compactName) {
          orgIdByName.set(compactName, record.id);
        }
        record.nameAliases.forEach((alias) => {
          const normalizedAlias = normalizeSearchText(alias);
          if (normalizedAlias) {
            orgIdByName.set(normalizedAlias, record.id);
          }
          const compactAlias = normalizeMatchText(alias);
          if (compactAlias) {
            orgIdByName.set(compactAlias, record.id);
          }
        });
      });
      const remapOrgMetricMap = (baseMap: Record<string, number>) => {
        const remapped: Record<string, number> = {};
        Object.entries(baseMap).forEach(([rawKey, value]) => {
          if (!isFiniteNumber(value)) return;
          const normalizedId = normalizeOrgId(rawKey);
          const matchedId =
            (normalizedId && orgIdByNormalized.get(normalizedId)) ?? null;
          if (matchedId) {
            remapped[matchedId] = value;
            return;
          }
          const normalizedName = normalizeSearchText(rawKey);
          const nameMatch = normalizedName ? orgIdByName.get(normalizedName) : null;
          if (nameMatch) {
            remapped[nameMatch] = value;
            return;
          }
          const compactName = normalizeMatchText(rawKey);
          const compactMatch = compactName ? orgIdByName.get(compactName) : null;
          if (compactMatch) {
            remapped[compactMatch] = value;
          }
        });
        return remapped;
      };
      const byParent = new Map<string, string[]>();
      orgList.forEach((record) => {
        if (!record.parentId) return;
        const list = byParent.get(record.parentId) ?? [];
        list.push(record.id);
        byParent.set(record.parentId, list);
      });
      const buildAggregatedMap = (
        baseMap: Record<string, number>
      ): Record<string, number> => {
        const cache = new Map<string, number | null>();
        const resolve = (id: string): number | null => {
          if (cache.has(id)) return cache.get(id) ?? null;
          const direct = baseMap[id];
          if (isFiniteNumber(direct)) {
            cache.set(id, direct);
            return direct;
          }
          let sum = 0;
          let hasChild = false;
          (byParent.get(id) ?? []).forEach((childId) => {
            const childValue = resolve(childId);
            if (!isFiniteNumber(childValue)) return;
            sum += childValue;
            hasChild = true;
          });
          const value = hasChild ? sum : null;
          cache.set(id, value);
          return value;
        };
        const aggregated: Record<string, number> = {};
        orgList.forEach((record) => {
          const value = resolve(record.id);
          if (isFiniteNumber(value)) {
            aggregated[record.id] = value;
          }
        });
        return aggregated;
      };
      const ratioMap: Record<string, number> = {};
      const avgSalesMap: Record<string, number> = {};
      const avgCostMap: Record<string, number> = {};
      if (
        orgNumeratorRes.status === "fulfilled" &&
        orgDenominatorRes.status === "fulfilled"
      ) {
        const numeratorBase = remapOrgMetricMap(orgNumeratorRes.value);
        const denominatorBase = remapOrgMetricMap(orgDenominatorRes.value);
        const numeratorMap = buildAggregatedMap(numeratorBase);
        const denominatorMap = buildAggregatedMap(denominatorBase);
        Object.entries(numeratorMap).forEach(([id, numerator]) => {
          const denominator = denominatorMap[id];
          if (!isFiniteNumber(denominator) || denominator === 0) return;
          ratioMap[id] = numerator / denominator;
        });
        if (orgHeadcountRes.status === "fulfilled") {
          const headcountBase = remapOrgMetricMap(orgHeadcountRes.value);
          const headcountMap = buildAggregatedMap(headcountBase);
          Object.entries(numeratorMap).forEach(([id, numerator]) => {
            const headcount = headcountMap[id];
            if (!isFiniteNumber(headcount) || headcount === 0) return;
            avgSalesMap[id] = numerator / headcount;
          });
          Object.entries(denominatorMap).forEach(([id, denominator]) => {
            const headcount = headcountMap[id];
            if (!isFiniteNumber(headcount) || headcount === 0) return;
            avgCostMap[id] = denominator / headcount;
          });
        }
      }
      const ratioMapPrev: Record<string, number> = {};
      const avgSalesMapPrev: Record<string, number> = {};
      const avgCostMapPrev: Record<string, number> = {};
      if (
        orgPrevNumeratorRes.status === "fulfilled" &&
        orgPrevDenominatorRes.status === "fulfilled"
      ) {
        const prevNumeratorBase = remapOrgMetricMap(orgPrevNumeratorRes.value);
        const prevDenominatorBase = remapOrgMetricMap(orgPrevDenominatorRes.value);
        const prevNumeratorMap = buildAggregatedMap(prevNumeratorBase);
        const prevDenominatorMap = buildAggregatedMap(prevDenominatorBase);
        Object.entries(prevNumeratorMap).forEach(([id, numerator]) => {
          const denominator = prevDenominatorMap[id];
          if (!isFiniteNumber(denominator) || denominator === 0) return;
          ratioMapPrev[id] = numerator / denominator;
        });
        if (orgPrevHeadcountRes.status === "fulfilled") {
          const prevHeadcountBase = remapOrgMetricMap(orgPrevHeadcountRes.value);
          const prevHeadcountMap = buildAggregatedMap(prevHeadcountBase);
          Object.entries(prevNumeratorMap).forEach(([id, numerator]) => {
            const headcount = prevHeadcountMap[id];
            if (!isFiniteNumber(headcount) || headcount === 0) return;
            avgSalesMapPrev[id] = numerator / headcount;
          });
          Object.entries(prevDenominatorMap).forEach(([id, denominator]) => {
            const headcount = prevHeadcountMap[id];
            if (!isFiniteNumber(headcount) || headcount === 0) return;
            avgCostMapPrev[id] = denominator / headcount;
          });
        }
      }
      if (
        orgNumeratorRes.status === "fulfilled" ||
        orgBenchmarkRes.status === "fulfilled"
      ) {
        setOrgMetricValues({
          current: ratioMap,
          benchmark:
            orgBenchmarkRes.status === "fulfilled"
              ? remapOrgMetricMap(orgBenchmarkRes.value)
              : {}
        });
      }
      const nextKpiValues: Record<string, Record<string, number>> = {};
      kpiMapResults.forEach((result) => {
        if (result.status === "fulfilled") {
          nextKpiValues[result.value.code] = remapOrgMetricMap(
            result.value.values
          );
        }
      });
      nextKpiValues[ROI_METRIC_CONFIG[0].code] = ratioMap;
      nextKpiValues[ROI_METRIC_CONFIG[1].code] = avgSalesMap;
      nextKpiValues[ROI_METRIC_CONFIG[2].code] = avgCostMap;
      if (Object.keys(nextKpiValues).length) {
        setOrgKpiValues(nextKpiValues);
      }
      const nextKpiBenchmarkValues: Record<string, Record<string, number>> = {};
      kpiBenchmarkMapResults.forEach((result) => {
        if (result.status === "fulfilled") {
          nextKpiBenchmarkValues[result.value.code] = remapOrgMetricMap(
            result.value.values
          );
        }
      });
      if (Object.keys(nextKpiBenchmarkValues).length) {
        setOrgKpiBenchmarks(nextKpiBenchmarkValues);
      }
      const nextKpiYoY: Record<string, Record<string, number>> = {};
      const buildYoYMap = (
        currentMap: Record<string, number>,
        prevMap: Record<string, number>
      ) => {
        const yoyMap: Record<string, number> = {};
        Object.entries(currentMap).forEach(([id, currentValue]) => {
          const prevValue = prevMap[id];
          if (!isFiniteNumber(prevValue) || prevValue === 0) return;
          yoyMap[id] = ((currentValue - prevValue) / prevValue) * 100;
        });
        return yoyMap;
      };
      nextKpiYoY[ROI_METRIC_CONFIG[0].code] = buildYoYMap(
        ratioMap,
        ratioMapPrev
      );
      nextKpiYoY[ROI_METRIC_CONFIG[1].code] = buildYoYMap(
        avgSalesMap,
        avgSalesMapPrev
      );
      nextKpiYoY[ROI_METRIC_CONFIG[2].code] = buildYoYMap(
        avgCostMap,
        avgCostMapPrev
      );
      setOrgKpiYoY(nextKpiYoY);
      if (
        baseResults.some((result) => result.status === "rejected") ||
        dimensionResults.some((result) => result.status === "rejected") ||
        metricResults.some((result) => result.status === "rejected") ||
        prevMetricResults.some((result) => result.status === "rejected") ||
        kpiMapResults.some((result) => result.status === "rejected") ||
        kpiBenchmarkMapResults.some((result) => result.status === "rejected")
      ) {
        console.error("Failed to load ROI data", {
          baseResults,
          dimensionResults,
          metricResults,
          prevMetricResults,
          kpiMapResults,
          kpiBenchmarkMapResults
        });
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  const openChat = (context: ChatContext) => {
    setChatContext(context);
    setDrawerOpen(true);
    chatKitRef.current?.injectApplicationContext(buildContext(context));
  };

  const handleOrgSelect = (record: OrgRecord) => {
    setSelectedOrg(record.name);
    setSelectedOrgId(record.id);
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

  const scoreValue = useMemo(() => {
    const metricMap = new Map<string, ScoreMetric>();
    scoreMetricsToRender.forEach((metric) => metricMap.set(metric.id, metric));
    const items = [
      { code: "#MTC-B5E3", weight: 0.25 },
      { code: "#MTC-B5E4", weight: -0.25 },
      { code: "#MTC-B5E5", weight: 0.25 },
      { code: "#MTC-B5Q5", weight: -0.1 },
      { code: "#MTC-E6F6", weight: -0.15 }
    ].map((item) => ({
      ...item,
      value: metricMap.get(item.code)?.current_value ?? null
    }));
    const available = items.filter((item) => isFiniteNumber(item.value));
    if (!available.length) return null;
    const absSum = available.reduce(
      (sum, item) => sum + Math.abs(item.weight),
      0
    );
    if (!absSum) return null;
    const scale = 1 / absSum;
    const weightedSum = available.reduce(
      (sum, item) => sum + item.weight * scale * (item.value as number),
      0
    );
    const result = 80 + weightedSum;
    return Number(result.toFixed(1));
  }, [scoreMetricsToRender]);

  const scoreLevelMeta = useMemo(() => {
    if (!isFiniteNumber(scoreValue)) {
      return {
        label: "--",
        className: "text-slate-400"
      };
    }
    const value = scoreValue;
    if (value >= 80) {
      return {
        label: "正常",
        className: "text-emerald-600"
      };
    }
    if (value >= 60) {
      return {
        label: "预警",
        className: "text-amber-600"
      };
    }
    return {
      label: "风险",
      className: "text-rose-600"
    };
  }, [scoreValue]);

  const orgRecordsForView = useMemo(() => {
    if (!orgRecords.length) return [];
    return orgRecords.map((record) => {
      const current = orgMetricValues.current[record.id];
      const benchmark = orgMetricValues.benchmark[record.id];
      const currentValue = isFiniteNumber(current) ? current : null;
      const benchmarkValue = isFiniteNumber(benchmark) ? benchmark : null;
      return {
        ...record,
        currentValue,
        benchmarkValue,
        status: resolveOrgStatus(currentValue, benchmarkValue)
      };
    });
  }, [orgRecords, orgMetricValues]);

  const orgRecordMap = useMemo(() => {
    const map = new Map<string, OrgRecord>();
    orgRecordsForView.forEach((record) => {
      map.set(record.id, record);
    });
    return map;
  }, [orgRecordsForView]);

  const searchOptions = useMemo(() => {
    const keyword = normalizeSearchText(searchValue);
    const matched = keyword
      ? orgRecordsForView.filter((record) =>
          normalizeSearchText(record.name).includes(keyword)
        )
      : [];
    const uniqueNames = Array.from(
      new Set(matched.map((record) => record.name))
    );
    return uniqueNames.slice(0, 10).map((name) => ({ value: name }));
  }, [orgRecordsForView, searchValue]);

  const handleSearchSubmit = (value?: string) => {
    const keyword = normalizeSearchText(value ?? searchValue);
    if (!keyword || !orgRecordsForView.length) return;
    const match =
      orgRecordsForView.find(
        (record) => normalizeSearchText(record.name) === keyword
      ) ??
      orgRecordsForView.find((record) =>
        normalizeSearchText(record.name).includes(keyword)
      );
    if (!match) return;
    setSelectedOrg(match.name);
    setSelectedOrgId(match.id);
    const path: string[] = [];
    const visited = new Set<string>();
    let current: OrgRecord | undefined = match;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.push(current.id);
      if (!current.parentId) break;
      current = orgRecordMap.get(current.parentId);
    }
    const nextPath = path.reverse();
    if (nextPath.length) {
      setExpandedPath(nextPath);
    }
  };

  const selectedOrgDep2Id = useMemo(() => {
    if (!selectedOrgId) return null;
    let record = orgRecordMap.get(selectedOrgId);
    if (!record) return null;
    if (record.level === 2) return record.id;
    return null;
  }, [orgRecordMap, selectedOrgId]);

  const selectedOrgDep2Codes = useMemo(() => {
    if (!selectedOrgId) return [] as string[];
    const record = orgRecordMap.get(selectedOrgId);
    if (!record || record.level !== 1) return [] as string[];
    return orgRecordsForView
      .filter((item) => item.parentId === record.id)
      .map((item) => item.id);
  }, [orgRecordsForView, orgRecordMap, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId) return;
    const loadScore = async () => {
      setScoreLoading(true);
      try {
        const response = await fetchScoreSummary(
          apiBase,
          authorization,
          selectedOrgId,
          selectedOrgDep2Id,
          selectedOrgDep2Codes
        );
        setScore(response);
      } catch (error) {
        console.error("Failed to load score metrics", error);
        setScore(null);
      } finally {
        setScoreLoading(false);
      }
    };
    loadScore();
  }, [
    apiBase,
    authorization,
    selectedOrgId,
    selectedOrgDep2Id,
    selectedOrgDep2Codes
  ]);

  const orgTree = useMemo(() => {
    const byParent = new Map<string, OrgRecord[]>();
    orgRecordsForView.forEach((record) => {
      if (record.parentId) {
        const list = byParent.get(record.parentId) ?? [];
        list.push(record);
        byParent.set(record.parentId, list);
      }
    });
    return { byParent };
  }, [orgRecordsForView]);

  const orgRoot = useMemo(() => {
    const candidates = orgRecordsForView.filter((record) =>
      record.name.includes(ORG_ROOT_NAME)
    );
    if (!candidates.length) return null;
    return (
      candidates.find(
        (record) =>
          record.level === 1 || record.levelLabel?.includes("一级")
      ) ?? candidates[0]
    );
  }, [orgRecordsForView]);

  const activeOrgId = useMemo(
    () => selectedOrgId ?? orgRoot?.id ?? null,
    [selectedOrgId, orgRoot?.id]
  );

  useEffect(() => {
    if (!activeOrgId) {
      setSummary(null);
      return;
    }
    const metrics: RoiMetric[] = ROI_METRIC_CONFIG.map((config) => {
      const currentMap = orgKpiValues[config.code] ?? {};
      const benchmarkMap = orgKpiBenchmarks[config.code] ?? {};
      const currentRaw = currentMap[activeOrgId];
      const benchmarkRaw = benchmarkMap[activeOrgId];
      const currentValue = isFiniteNumber(currentRaw) ? currentRaw : null;
      const benchmarkValue = isFiniteNumber(benchmarkRaw) ? benchmarkRaw : null;
      const yoyMap = orgKpiYoY[config.code] ?? {};
      const yoyRaw = yoyMap[activeOrgId];
      const changePct = isFiniteNumber(yoyRaw) ? yoyRaw : null;
      const achievementPct =
        isFiniteNumber(currentValue) && isFiniteNumber(benchmarkValue)
          ? benchmarkValue === 0
            ? null
            : (currentValue / benchmarkValue) * 100
          : null;
      const trend = isFiniteNumber(changePct)
        ? changePct >= 0
          ? "up"
          : "down"
        : undefined;
      return {
        id: config.code,
        name: config.name,
        current_value: currentValue,
        benchmark_value: benchmarkValue,
        change_pct: isFiniteNumber(changePct) ? Number(changePct.toFixed(2)) : null,
        achievement_pct: isFiniteNumber(achievementPct)
          ? Number(achievementPct.toFixed(2))
          : null,
        unit: config.unit,
        trend
      };
    });
    setSummary({ updated_at: null, metrics });
  }, [activeOrgId, orgKpiBenchmarks, orgKpiYoY, orgKpiValues]);

  const orgLevelMap = useMemo(() => {
    const byLevel = new Map<number, OrgRecord[]>();
    orgRecordsForView.forEach((record) => {
      if (isFiniteNumber(record.level)) {
        const list = byLevel.get(record.level) ?? [];
        list.push(record);
        byLevel.set(record.level, list);
      }
    });
    return byLevel;
  }, [orgRecordsForView]);

  const level2Records = useMemo(() => {
    if (!orgRoot) return [] as OrgRecord[];
    const byParent = orgRecordsForView.filter(
      (record) => record.parentId === orgRoot.id
    );
    if (byParent.length) return byParent;
    if (isFiniteNumber(orgRoot.level)) {
      return orgLevelMap.get(orgRoot.level + 1) ?? [];
    }
    return [];
  }, [orgRoot, orgRecordsForView, orgLevelMap]);

  const level3Records = useMemo(() => {
    const selectedLevel2Id = expandedPath[1];
    if (!selectedLevel2Id) return [] as OrgRecord[];
    return orgRecordsForView.filter(
      (record) => record.parentId === selectedLevel2Id
    );
  }, [expandedPath, orgRecordsForView]);

  const orgColumns = useMemo(() => {
    if (!orgRoot) return [] as OrgRecord[][];
    const columns: OrgRecord[][] = [[orgRoot]];
    if (!expandedPath[0]) return columns;
    if (level2Records.length) {
      columns.push(level2Records);
    }
    const hasLevel2Selection = level2Records.some(
      (record) => record.id === expandedPath[1]
    );
    if (hasLevel2Selection && level3Records.length) {
      columns.push(level3Records);
    }
    return columns;
  }, [orgRoot, expandedPath, level2Records, level3Records]);

  const renderOrgHoverContent = (record: OrgRecord) => {
    const headcountText = isFiniteNumber(record.headcount)
      ? formatNumber(record.headcount)
      : "--";
    return (
      <div className="min-w-[220px] space-y-2 text-[13px] text-slate-100">
        <div className="flex items-center justify-between gap-4">
          <span>人员规模</span>
          <span className="font-semibold">{headcountText}</span>
        </div>
        {ROI_METRIC_CONFIG.map((metric) => {
          const rawValue = orgKpiValues[metric.code]?.[record.id];
          const value = isFiniteNumber(rawValue) ? rawValue : null;
          return (
            <div
              key={metric.code}
              className="flex items-center justify-between gap-4"
            >
              <span>{metric.name}</span>
              <span className="font-semibold">
                {formatMetricValue(value, metric.unit)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (!orgRoot) return;
    setSelectedOrg(orgRoot.name);
    setSelectedOrgId(orgRoot.id);
    setExpandedPath([orgRoot.id]);
  }, [orgRoot?.id]);

  const renderOrgCard = (record: OrgRecord, levelIndex: number) => {
    const status = statusMeta[record.status];
    const parentChildren = orgTree.byParent.get(record.id) ?? [];
    const hasChildren =
      levelIndex === 0 ? level2Records.length > 0 : parentChildren.length > 0;
    const isExpanded = expandedPath[levelIndex] === record.id;
    const isSelected = record.id === selectedOrgId;
    const actionLabel = hasChildren ? (isExpanded ? "收起" : "展开") : null;
    const ActionIcon = isExpanded ? DownOutlined : RightOutlined;
    const currentValue = isFiniteNumber(record.currentValue)
      ? formatNumber(record.currentValue)
      : "--";
    const benchmarkValue = isFiniteNumber(record.benchmarkValue)
      ? formatNumber(record.benchmarkValue)
      : "--";
    return (
      <Tooltip
        title={renderOrgHoverContent(record)}
        color="#0f172a"
        overlayInnerStyle={{ borderRadius: 12, padding: "10px 14px" }}
        placement="right"
        mouseEnterDelay={0.12}
      >
        <div
          key={record.id}
          className={classNames(
            "mx-auto w-full max-w-[320px] rounded-xl border bg-white px-4 py-3 shadow-sm transition",
            "cursor-pointer hover:shadow-md",
            isSelected ? "border-blue-300" : "border-slate-200"
          )}
          onClick={() => {
            handleOrgSelect(record);
            if (!hasChildren) {
              return;
            }
            setExpandedPath((prev) => {
              const next = prev.slice(0, levelIndex);
              if (prev[levelIndex] === record.id) {
                return next;
              }
              return [...next, record.id];
            });
          }}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-700">
                {record.name || "--"}
              </div>
            <div className="text-xs text-slate-500">
              负责人：{record.owner ?? "--"}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              当前 {currentValue} / 基准 {benchmarkValue}
            </div>
          </div>
          <div className="flex flex-col items-end justify-between gap-2 text-xs text-slate-500">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border-2"
              style={{ borderColor: status.color }}
              aria-label={status.label}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: status.color }}
              />
            </span>
            {actionLabel ? (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <ActionIcon className="text-[10px]" />
                {actionLabel}
              </span>
            ) : null}
          </div>
        </div>
        </div>
      </Tooltip>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-ink flex flex-col lg:h-screen">
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

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6 lg:h-[calc(100vh-72px)] lg:min-h-0 lg:overflow-hidden">
        <div
          ref={layoutRef}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:h-full lg:min-h-0"
          style={
            isLargeScreen
              ? { gridTemplateColumns: `minmax(0,1fr) ${chatWidth}px` }
              : undefined
          }
        >
          <div className="min-w-0 lg:min-h-0 lg:h-full lg:overflow-y-auto lg:pr-2">
            <section>
              <div className="grid gap-4 md:grid-cols-3">
                {isLoading || roiLoading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <Card
                        key={`metric-skeleton-${index}`}
                        className="rounded-2xl border border-slate-200 shadow-sm"
                        bodyStyle={{ padding: 20 }}
                      >
                        <Skeleton
                          active
                          title={{ width: 140 }}
                          paragraph={{ rows: 3 }}
                        />
                      </Card>
                    ))
                  : metricsToRender.map((metric) => (
                      <Card
                        key={metric.id}
                        className="rounded-2xl border border-slate-200 shadow-sm"
                        bodyStyle={{ padding: 20 }}
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
                            {formatMetricValue(
                              metric.benchmark_value,
                              metric.unit
                            )}
                          </span>
                          <span>
                            达成率 {formatPercent(metric.achievement_pct)}
                          </span>
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
                            <div className="text-xs text-slate-400">
                              达成率 --
                            </div>
                          )}
                        </div>
                        <div className="mt-2" />
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
                {isLoading ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <Card
                        key={`org-skeleton-${index}`}
                        className="rounded-xl border border-slate-200 shadow-sm"
                        bodyStyle={{ padding: 16 }}
                      >
                        <Skeleton active title={{ width: 120 }} paragraph={{ rows: 2 }} />
                      </Card>
                    ))}
                  </div>
                ) : orgColumns.length ? (
                  <>
                    <div className="grid auto-cols-fr grid-flow-col gap-6 px-2 text-center text-xs text-slate-400">
                      {orgColumns.map((_, index) => (
                        <div key={`level-${index}`}>Level {index + 1}</div>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-6 overflow-x-auto pb-2">
                      {orgColumns.map((column, levelIndex) => (
                        <div
                          key={`column-${levelIndex}`}
                          className="min-w-[240px] flex-1 space-y-4"
                        >
                          {column.map((record) =>
                            renderOrgCard(record, levelIndex)
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-slate-500">--</div>
                )}
              </Card>
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-base font-semibold text-slate-700">
                  人效关联指标
                </div>
                <AutoComplete
                  value={searchValue}
                  options={searchOptions}
                  onChange={(value) => setSearchValue(value)}
                  onSelect={(value) => {
                    setSearchValue(value);
                    handleSearchSubmit(value);
                  }}
                  className="max-w-xs"
                >
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="搜索部门名称"
                    onPressEnter={(event) =>
                      handleSearchSubmit(
                        (event.target as HTMLInputElement).value
                      )
                    }
                  />
                </AutoComplete>
              </div>

              <Card className="mt-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">
                      人效评分
                    </span>
                    {scoreLoading ? (
                      <>
                        <Skeleton.Button
                          active
                          size="small"
                          className="!h-7 !w-20"
                        />
                        <Skeleton.Button
                          active
                          size="small"
                          className="!h-7 !w-28"
                        />
                      </>
                    ) : (
                      <>
                        <Tooltip title="人效评分 = 80 + 0.25×项目转化率 - 0.25×平均项目转化周期 + 0.25×平均项目价值 - 0.10×新销售产单周期 - 0.15×人员流动性（某项为空时，该项权重按其余项绝对权重比例分配）">
                          <Tag color="blue">
                            评分{" "}
                            {isFiniteNumber(scoreValue) ? scoreValue : "--"}
                          </Tag>
                        </Tooltip>
                        <Tooltip title="评分标准：≥80 正常 | 60-80 预警 | <60 风险">
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
                            风险等级
                            <span
                              className={classNames(
                                "rounded-full border px-2 py-0.5 text-xs",
                                scoreLevelMeta.className
                              )}
                            >
                              {scoreLevelMeta.label}
                            </span>
                          </span>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </div>
                <div className="pt-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] gap-3 text-xs text-slate-400">
                      <div>指标项</div>
                      <div className="text-center">当前值</div>
                      <div className="text-center">基准值</div>
                    </div>
                    {isLoading || scoreLoading
                      ? Array.from({ length: 4 }).map((_, index) => (
                          <div
                            key={`score-skeleton-${index}`}
                            className="rounded-xl border border-slate-100 px-4 py-3"
                          >
                            <Skeleton
                              active
                              title={{ width: 220 }}
                              paragraph={{ rows: 1 }}
                            />
                          </div>
                        ))
                      : scoreMetricsToRender.map((metric) => (
                            <div
                              key={metric.id}
                              className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-3 rounded-xl border border-slate-100 px-4 py-3"
                            >
                              <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                                  {metric.name}
                                </div>
                              </div>
                              <div className="text-center text-xs">
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">
                                  {formatMetricValue(
                                    metric.current_value,
                                    metric.unit
                                  )}
                                </span>
                              </div>
                              <div className="text-center text-xs">
                                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600">
                                  {formatMetricValue(
                                    metric.benchmark_value,
                                    metric.unit
                                  )}
                                </span>
                              </div>
                            </div>
                          ))}
                  </div>
                </div>
                <div className="mt-4 text-xs text-slate-400">
                  {selectedOrg ? `已选组织：${selectedOrg}` : "选择组织节点以联动查看"}
                </div>
              </Card>
            </section>
          </div>

          <aside
            className="relative lg:h-full"
            style={isLargeScreen ? { width: chatWidth } : undefined}
          >
            {isLargeScreen ? (
              <div
                className="chat-resizer"
                onMouseDown={(event) => {
                  isResizingRef.current = true;
                  resizeStateRef.current = {
                    startX: event.clientX,
                    startWidth: chatWidth
                  };
                  document.body.style.cursor = "col-resize";
                  document.body.style.userSelect = "none";
                }}
                role="separator"
                aria-orientation="vertical"
                aria-label="调整聊天面板宽度"
              />
            ) : null}
            <div className="chat-panel rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Copilot
                agentKey={CHATKIT_AGENT_ID}
                ref={chatKitRef}
                title={chatContext?.title ?? "人力资本ROI分析助手"}
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
