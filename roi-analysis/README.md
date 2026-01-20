# dip-for-talent

极简启动说明（本地开发）。

## 1. 获取代码
```bash
git clone https://github.com/maozy13/dip-for-talent.git
cd dip-for-talent
```

## 2. 配置环境变量（前端）
编辑 `.env.development`，至少填写 Token：
```bash
VITE_DIP_TOKEN=your_token_here
VITE_API_BASE=/api
VITE_DIP_CHATKIT_BASE_URL=/api/agent-app/v1
```

## 3. 安装依赖
前端：
```bash
npm install
```

## 4. 启动服务
前端（新终端）：
```bash
npm run dev
```

## 5. 试运行

前端访问：
```
http://localhost:5173
```
