import os
import uuid
from datetime import date, timedelta

from flask import Flask, jsonify, request

app = Flask(__name__)

ORGANIZATIONS = [
    {
        "id": "org_group",
        "name": "集团总部",
        "parent_id": None,
        "level": "group",
        "metrics": {"roi": 1.42, "health_score": 86, "job_fit": 78},
    },
    {
        "id": "org_bu_sales",
        "name": "销售事业部",
        "parent_id": "org_group",
        "level": "bu",
        "metrics": {"roi": 1.35, "health_score": 82, "job_fit": 72},
    },
    {
        "id": "org_bu_product",
        "name": "产品事业部",
        "parent_id": "org_group",
        "level": "bu",
        "metrics": {"roi": 1.58, "health_score": 88, "job_fit": 81},
    },
    {
        "id": "org_dept_north_sales",
        "name": "北区销售部",
        "parent_id": "org_bu_sales",
        "level": "department",
        "metrics": {"roi": 1.21, "health_score": 78, "job_fit": 66},
    },
    {
        "id": "org_dept_growth",
        "name": "增长产品部",
        "parent_id": "org_bu_product",
        "level": "department",
        "metrics": {"roi": 1.62, "health_score": 90, "job_fit": 84},
    },
]

POSITIONS = [
    {
        "id": "pos_sales_manager",
        "organization_id": "org_dept_north_sales",
        "required_skills": ["客户关系", "谈判", "数据分析"],
    },
    {
        "id": "pos_product_manager",
        "organization_id": "org_dept_growth",
        "required_skills": ["产品规划", "增长策略", "数据洞察"],
    },
    {
        "id": "pos_data_analyst",
        "organization_id": "org_dept_growth",
        "required_skills": ["数据建模", "指标拆解", "业务洞察"],
    },
    {
        "id": "pos_customer_success",
        "organization_id": "org_dept_north_sales",
        "required_skills": ["客户成功", "项目协同", "复盘能力"],
    },
    {
        "id": "pos_operations_lead",
        "organization_id": "org_dept_north_sales",
        "required_skills": ["运营规划", "数据洞察", "流程优化"],
    },
]

EMPLOYEES = [
    {
        "id": "emp_001",
        "organization_id": "org_dept_growth",
        "position_id": "pos_product_manager",
        "risk_level": "medium",
    },
    {
        "id": "emp_002",
        "organization_id": "org_dept_growth",
        "position_id": "pos_data_analyst",
        "risk_level": "low",
    },
    {
        "id": "emp_003",
        "organization_id": "org_dept_growth",
        "position_id": "pos_product_manager",
        "risk_level": "medium",
    },
    {
        "id": "emp_101",
        "organization_id": "org_dept_north_sales",
        "position_id": "pos_sales_manager",
        "risk_level": "high",
    },
    {
        "id": "emp_102",
        "organization_id": "org_dept_north_sales",
        "position_id": "pos_operations_lead",
        "risk_level": "medium",
    },
    {
        "id": "emp_103",
        "organization_id": "org_dept_north_sales",
        "position_id": "pos_customer_success",
        "risk_level": "medium",
    },
]

ACTIONS = [
    {
        "id": "action_org_active_1",
        "target_object_type": "Organization",
        "target_object_id": "org_group",
        "action_type": "org_optimization",
        "status": "active",
        "title": "组织匹配度提升专项",
        "expected_impact": "匹配度提升 3-5 分",
        "effort": "3周",
        "execution_method": "HRBP 牵头 + 业务负责人配合",
        "assignee": "HRBP 张敏",
        "due_date": (date.today() + timedelta(days=21)).isoformat(),
        "progress": 25,
    },
    {
        "id": "action_emp_active_1",
        "target_object_type": "Employee",
        "target_object_id": "emp_101",
        "action_type": "job_transfer",
        "status": "active",
        "title": "个人能力差距提升计划",
        "expected_impact": "匹配度提升 4 分",
        "effort": "2周",
        "execution_method": "直属主管跟进",
        "assignee": "HRBP 李婷",
        "due_date": (date.today() + timedelta(days=14)).isoformat(),
        "progress": 35,
    },
]

JOB_FIT_BASE = {
    "employeeOptions": [
        {"label": "王敏｜产品事业部｜产品经理", "value": "emp_001"},
        {"label": "李昊｜增长产品部｜数据分析师", "value": "emp_002"},
        {"label": "陈佳｜产品事业部｜增长产品经理", "value": "emp_003"},
    ],
    "roleOptions": [
        {"label": "产品经理", "value": "pos_product_manager"},
        {"label": "数据分析师", "value": "pos_data_analyst"},
        {"label": "销售经理", "value": "pos_sales_manager"},
    ],
    "summary": {
        "avgMatch": 78,
        "level": "中匹配",
        "risk": "中",
        "keyFinding": "关键岗位匹配度稳中有升，算法岗差距仍需关注。",
    },
    "distribution": {"high": 22, "medium": 35, "low": 9, "hardMismatch": 2},
    "trendSeries": [
        {"period": "9月", "score": 76},
        {"period": "10月", "score": 77},
        {"period": "11月", "score": 78},
        {"period": "12月", "score": 78},
        {"period": "1月", "score": 79},
        {"period": "2月", "score": 79},
    ],
    "matrix": [
        {"employee": "王敏", "role": "产品经理", "match": 74, "level": "中匹配", "risk": "中"},
        {"employee": "李昊", "role": "数据分析师", "match": 84, "level": "高匹配", "risk": "低"},
        {"employee": "陈佳", "role": "增长产品经理", "match": 70, "level": "中匹配", "risk": "中"},
        {"employee": "赵航", "role": "销售经理", "match": 58, "level": "低匹配", "risk": "高"},
    ],
    "keyFactors": ["数据建模", "业务洞察", "跨部门协作"],
    "capabilityGaps": [
        {"capability": "数据建模", "gap": 16, "type": "关键差距", "target": 90, "current": 74},
        {"capability": "产品策略", "gap": 11, "type": "关键差距", "target": 88, "current": 77},
        {"capability": "业务洞察", "gap": 9, "type": "关键差距", "target": 85, "current": 76},
        {"capability": "数据分析", "gap": 12, "type": "关键差距", "target": 86, "current": 74},
        {"capability": "跨部门协作", "gap": 8, "type": "可提升", "target": 84, "current": 76},
        {"capability": "指标拆解", "gap": 8, "type": "可提升", "target": 83, "current": 75},
    ],
    "singleMatch": {
        "employee": "王敏",
        "role": "产品经理",
        "match": 74,
        "level": "中匹配",
        "risk": "中",
        "hardMismatch": False,
        "missingCapabilities": ["数据洞察", "战略拆解"],
        "surplusCapabilities": ["协作沟通"],
        "keyFactors": ["产品规划", "市场分析", "跨团队协作"],
    },
    "singleMatchByEmployee": {
        "emp_001": {
            "employee": "王敏",
            "role": "产品经理",
            "match": 74,
            "level": "中匹配",
            "risk": "中",
            "hardMismatch": False,
            "missingCapabilities": ["数据洞察", "战略拆解"],
            "surplusCapabilities": ["协作沟通"],
            "keyFactors": ["产品规划", "市场分析", "跨团队协作"],
        },
        "emp_002": {
            "employee": "李昊",
            "role": "数据分析师",
            "match": 84,
            "level": "高匹配",
            "risk": "低",
            "hardMismatch": False,
            "missingCapabilities": ["业务洞察"],
            "surplusCapabilities": ["数据建模", "逻辑推理"],
            "keyFactors": ["数据建模", "需求拆解", "模型验证"],
        },
        "emp_003": {
            "employee": "陈佳",
            "role": "增长产品经理",
            "match": 70,
            "level": "中匹配",
            "risk": "中",
            "hardMismatch": False,
            "missingCapabilities": ["增长策略"],
            "surplusCapabilities": ["产品规划"],
            "keyFactors": ["用户研究", "指标拆解"],
        },
    },
    "positionDistribution": [
        {"role": "数据分析师", "high": 7, "medium": 4, "low": 1},
        {"role": "产品经理", "high": 6, "medium": 6, "low": 3},
        {"role": "销售经理", "high": 4, "medium": 6, "low": 4},
    ],
    "roleDistributionById": {
        "pos_data_analyst": [{"role": "数据分析师", "high": 7, "medium": 4, "low": 1}],
        "pos_product_manager": [{"role": "产品经理", "high": 6, "medium": 6, "low": 3}],
        "pos_sales_manager": [{"role": "销售经理", "high": 4, "medium": 6, "low": 4}],
    },
    "roleProfilesById": {
        "pos_data_analyst": {
            "model": [
                {"capability": "数据建模", "weight": 0.4, "target": 90, "current": 78},
                {"capability": "指标拆解", "weight": 0.35, "target": 85, "current": 72},
                {"capability": "业务洞察", "weight": 0.25, "target": 88, "current": 74},
            ]
        },
        "pos_product_manager": {
            "model": [
                {"capability": "产品规划", "weight": 0.4, "target": 88, "current": 80},
                {"capability": "用户研究", "weight": 0.35, "target": 86, "current": 72},
                {"capability": "需求拆解", "weight": 0.25, "target": 84, "current": 76},
            ]
        },
        "pos_sales_manager": {
            "model": [
                {"capability": "客户洞察", "weight": 0.4, "target": 86, "current": 70},
                {"capability": "谈判能力", "weight": 0.35, "target": 84, "current": 68},
                {"capability": "销售策略", "weight": 0.25, "target": 82, "current": 70},
            ]
        },
    },
    "actionSuggestions": [
        {
            "title": "补齐算法岗位数据建模能力",
            "priority": "P0",
            "effect": "匹配度提升 6-8 分",
            "effort": "2个月",
            "actionType": "job_transfer",
            "targetType": "Position",
            "targetId": "pos_data_analyst",
            "rationale": "关键差距能力数量 ≥ 2",
        },
        {
            "title": "为低匹配员工启动能力提升计划",
            "priority": "P1",
            "effect": "低匹配人数下降 20%",
            "effort": "1个月",
            "actionType": "org_optimization",
            "targetType": "Organization",
            "targetId": "org_group",
            "rationale": "匹配等级低于 60",
        },
    ],
}

JOB_FIT_BY_ORG = {
    "org_bu_sales": {
        "employeeOptions": [
            {"label": "刘思｜销售事业部｜销售经理", "value": "emp_101"},
            {"label": "吴凯｜销售事业部｜运营主管", "value": "emp_102"},
            {"label": "赵航｜销售事业部｜客户成功", "value": "emp_103"},
        ],
        "roleOptions": [
            {"label": "销售经理", "value": "pos_sales_manager"},
            {"label": "客户成功", "value": "pos_customer_success"},
            {"label": "运营主管", "value": "pos_operations_lead"},
        ],
        "summary": {"avgMatch": 72, "level": "中匹配", "risk": "高", "keyFinding": "销售岗位沟通与数据洞察缺口扩大。"},
        "distribution": {"high": 10, "medium": 18, "low": 8, "hardMismatch": 3},
        "trendSeries": [
            {"period": "9月", "score": 70},
            {"period": "10月", "score": 71},
            {"period": "11月", "score": 72},
            {"period": "12月", "score": 72},
            {"period": "1月", "score": 73},
            {"period": "2月", "score": 73},
        ],
        "matrix": [
            {"employee": "刘思", "role": "销售经理", "match": 58, "level": "低匹配", "risk": "高"},
            {"employee": "吴凯", "role": "运营主管", "match": 70, "level": "中匹配", "risk": "中"},
            {"employee": "赵航", "role": "客户成功", "match": 66, "level": "中匹配", "risk": "中"},
        ],
        "keyFactors": ["客户洞察", "谈判能力", "数据分析"],
    },
    "org_bu_product": {
        "summary": {"avgMatch": 81, "level": "高匹配", "risk": "低", "keyFinding": "产品岗位画像较为稳健，成长岗有提升空间。"},
        "distribution": {"high": 18, "medium": 14, "low": 4, "hardMismatch": 1},
        "trendSeries": [
            {"period": "9月", "score": 79},
            {"period": "10月", "score": 80},
            {"period": "11月", "score": 81},
            {"period": "12月", "score": 81},
            {"period": "1月", "score": 82},
            {"period": "2月", "score": 82},
        ],
    },
}


def build_jobfit_action_suggestions(payload, org_id):
    suggestions = []
    distribution = payload.get("distribution", {})
    low_count = distribution.get("low", 0)
    hard_mismatch = distribution.get("hardMismatch", 0)

    if hard_mismatch > 0:
        suggestions.append(
            {
                "title": "清理硬性不匹配岗位",
                "priority": "P0",
                "effect": "硬性不匹配岗位清零",
                "plan": "核查硬性不匹配岗位画像并调整任职门槛，执行调岗与补岗。",
                "effort_time": "2周",
                "effort_cost": "",
                "actionType": "org_optimization",
                "targetType": "Organization",
                "targetId": org_id,
                "rationale": f"硬性不匹配岗位 {hard_mismatch} 个",
            }
        )

    if low_count >= 8:
        suggestions.append(
            {
                "title": "启动低匹配岗位专项提升",
                "priority": "P0",
                "effect": "低匹配岗位下降 30%",
                "plan": "按岗位分组制定能力补齐方案，并设定月度复盘机制。",
                "effort_time": "3周",
                "effort_cost": "¥5万",
                "actionType": "org_optimization",
                "targetType": "Organization",
                "targetId": org_id,
                "rationale": f"低匹配岗位数量 {low_count} 个",
            }
        )

    trend = payload.get("trendSeries", [])
    if len(trend) >= 2 and trend[-1]["score"] < trend[-2]["score"]:
        suggestions.append(
            {
                "title": "匹配度回升专项复盘",
                "priority": "P1",
                "effect": "匹配度回升 2-3 分",
                "plan": "复盘近两期能力差距与业务指标变化，调整岗位权重配置。",
                "effort_time": "2周",
                "effort_cost": "",
                "actionType": "org_optimization",
                "targetType": "Organization",
                "targetId": org_id,
                "rationale": "匹配度环比下降",
            }
        )

    matrix = payload.get("matrix", [])
    if matrix:
        lowest = sorted(matrix, key=lambda item: item.get("match", 0))[0]
        employee_name = lowest.get("employee")
        match_score = lowest.get("match", 0)
        employee_id = None
        for emp_id, detail in payload.get("singleMatchByEmployee", {}).items():
            if detail.get("employee") == employee_name:
                employee_id = emp_id
                break
        suggestions.append(
            {
                "title": f"个人匹配提升计划：{employee_name}",
                "priority": "P0" if match_score < 65 else "P1",
                "effect": "匹配度提升 4-6 分",
                "plan": "基于能力差距制定提升任务，安排导师辅导与岗位实践。",
                "effort_time": "2周",
                "effort_cost": "",
                "actionType": "job_transfer",
                "targetType": "Employee",
                "targetId": employee_id or employee_name,
                "rationale": f"个人匹配度 {match_score}，低于组织目标",
            }
        )

    if payload.get("capabilityGaps") and len(suggestions) < 5:
        top_gap = payload["capabilityGaps"][0]["capability"]
        suggestions.append(
            {
                "title": f"关键能力提升：{top_gap}",
                "priority": "P1",
                "effect": "关键能力达标率提升",
                "plan": "围绕关键能力建立专项训练与认证机制。",
                "effort_time": "2周",
                "effort_cost": "",
                "actionType": "org_optimization",
                "targetType": "Organization",
                "targetId": org_id,
                "rationale": f"关键差距能力 {top_gap}",
            }
        )

    return suggestions[:5]


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.route("/api/<path:_path>", methods=["OPTIONS"])
def options(_path):
    return ("", 204)


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


def create_action(object_type, object_id, action_type, expected_impact):
    action = {
        "id": str(uuid.uuid4()),
        "target_object_type": object_type,
        "target_object_id": object_id,
        "action_type": action_type,
        "status": "draft",
        "expected_impact": expected_impact,
        "title": f"行动任务：{action_type}",
        "effort": None,
        "execution_method": None,
        "assignee": "HRBP",
        "due_date": (date.today() + timedelta(days=14)).isoformat(),
        "progress": 0,
    }
    ACTIONS.insert(0, action)
    return action


def find_org(org_id):
    return next((org for org in ORGANIZATIONS if org["id"] == org_id), None)


@app.get("/api/organizations")
def list_organizations():
    return jsonify({"data": ORGANIZATIONS})


@app.get("/api/mock/<resource>")
def get_mock(resource):
    if resource != "job_fit":
        return jsonify({"error": "mock_not_found"}), 404
    org_id = request.args.get("org_id")
    payload = JOB_FIT_BASE.copy()
    if org_id and org_id in JOB_FIT_BY_ORG:
        payload = {**payload, **JOB_FIT_BY_ORG[org_id]}
    payload["actionSuggestions"] = build_jobfit_action_suggestions(payload, org_id or "org_group")
    return jsonify({"data": payload})


@app.get("/api/actions")
def list_actions():
    org_id = request.args.get("org_id")
    if not org_id:
        return jsonify({"data": ACTIONS})
    scoped = []
    for action in ACTIONS:
        if action["target_object_type"] == "Organization" and action["target_object_id"] == org_id:
            scoped.append(action)
            continue
        if action["target_object_type"] == "Employee":
            employee = next((emp for emp in EMPLOYEES if emp["id"] == action["target_object_id"]), None)
            if employee and employee["organization_id"] == org_id:
                scoped.append(action)
        if action["target_object_type"] == "Position":
            position = next((pos for pos in POSITIONS if pos["id"] == action["target_object_id"]), None)
            if position and position["organization_id"] == org_id:
                scoped.append(action)
    return jsonify({"data": scoped})


@app.post("/api/action/update")
def update_action():
    payload = request.get_json(force=True)
    action_id = payload.get("id")
    if not action_id:
        return jsonify({"error": "missing_action_id"}), 400

    action = next((item for item in ACTIONS if item["id"] == action_id), None)
    if not action:
        return jsonify({"error": "action_not_found"}), 404

    status = payload.get("status")
    if status:
        action["status"] = status

    assignee = payload.get("assignee")
    if assignee:
        action["assignee"] = assignee

    due_date = payload.get("due_date")
    if due_date:
        action["due_date"] = due_date

    progress = payload.get("progress")
    if progress is not None:
        action["progress"] = progress

    title = payload.get("title")
    if title:
        action["title"] = title

    expected_impact = payload.get("expected_impact")
    if expected_impact:
        action["expected_impact"] = expected_impact

    effort = payload.get("effort")
    if effort:
        action["effort"] = effort

    execution_method = payload.get("execution_method")
    if execution_method:
        action["execution_method"] = execution_method

    return jsonify({"data": action})


@app.post("/api/action/generate")
def action_generate():
    payload = request.get_json(silent=True) or {}
    object_type = payload.get("object_type")
    object_id = payload.get("object_id")
    action_type = payload.get("action_type")
    if not object_type or not object_id or not action_type:
        return jsonify({"error": "missing_fields"}), 400
    action = create_action(
        object_type,
        object_id,
        action_type,
        expected_impact="预计提升关键指标 6%",
    )
    return jsonify({"data": {"action_id": action["id"], "expected_impact": action["expected_impact"]}})


@app.post("/api/simulate/jobfit")
def simulate_jobfit():
    payload = request.get_json(silent=True) or {}
    org_id = payload.get("org_id")
    employee_id = payload.get("employee")
    role_id = payload.get("role")
    if not org_id or not employee_id or not role_id:
        return jsonify({"error": "missing_fields"}), 400
    if not find_org(org_id):
        return jsonify({"error": "organization_not_found"}), 404
    base = 72 + (len(employee_id) % 6)
    match = base + (len(role_id) % 8)
    performance = min(15, match - 70)
    risk = max(5, 30 - (match - 70))
    reason = f"{employee_id} 与 {role_id} 的技能匹配度更高。"
    create_action("Employee", employee_id, "job_transfer", "预计匹配度提升 8%")
    return jsonify(
        {
            "data": {
                "match": match,
                "performance": performance,
                "risk": risk,
                "reason": reason,
            }
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    host = os.environ.get("HOST", "127.0.0.1")
    app.run(host=host, port=port, debug=False, use_reloader=False)
