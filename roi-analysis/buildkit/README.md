# buildkit
buildkit 是 DIP 应用自动打包工具，用户可以通过智能体将本地开发的 AI 应用改造并打包成 .dip 格式的 DIP 应用安装包。

# 使用方法
0. 本工具会肆意修改你的不宝贵代码，如果你觉得舍不得，请在使用本工具前备份好你的宝贝代码（至少本地 Commit 一下）。
1. 本项目默认使用 Codex 作为代码改造工具，你可以将 AGENTS.md 更名为适配你的开发工具的名字（例如：CLAUDE.md）。
2. 修改 config.yaml。
3. 把 buildkit 目录放到你的项目根目录下，告诉 AI 工具 “帮我改造项目并完成构建“。
4. 代码不需要反复被改造，在第一次执行完整的改造 + 构建 + 打包之后，可以使用命令只做构建和打包：
```bash
cd buildkit
uv venv
source .venv/bin/activate
uv run scripts/build_package.py --arch=amd64
uv run scripts/build_package.py --arch=arm64
```

# DIP 应用安装包
DIP 应用是运行在 DIP 决策智能平台上的 AI 应用，其安装包结构如下：
```
├── application.key                         ← DIP 应用的唯一标识
├── manifest.yaml                           ← DIP 应用描述文件
├── assets/                   
│   └── icons/                              ← DIP 应用图标目录
│       └── 64.png
├── packages/                   
│   └── images/                             ← 镜像包目录
│       └── dip-for-demo-0.1.0-arm64.tar            
│   └── charts/                             ← Chart 包目录
│       └── dip-for-demo-0.1.0-arm64.tgz            
├── ontologies/                             ← 业务知识网络配置文件目录
│   └── ontology.json
├── agents/                                 ← 智能体配置文件目录
│   └── agent.json     
```

# buildkit 项目结构
buildkit 项目结构如下：
```
├── .cache/                                 ← 构建 & 打包过程中生成的临时目录
│   └── 2026_01_15_15_42/                   ← 执行一次构建 & 打包任务时动态创建的子目录，目录名的格式为：yyyy_MM_dd_hh_mm
│      └── package/                         ← 准备被打包成 .dip 应用安装包的资源存放目录，结构参考：DIP 应用安装包结构
│         └── amd64/                        ← 存放 AMD64 架构的应用安装包资源，以及最终被打包的 AMD64 版本的 DIP 应用安装包
│         └── arm64/                        ← 存放 ARM64 架构的应用安装包资源，以及最终被打包的 ARM64 版本的 DIP 应用安装包
│      └── dist/                            ← 编译后的 DIP 应用代码
│      └── charts/                          ← 用于存放基于 Jinja2 模板生成的 Helm Chart 配置和 Chart 包文件
│      └── Dockerfile                       ← 基于 Jinja2 模板生成的 Dockerfile
│      └── manifest.yaml                    ← 基于 Jinja2 模板生成的 manifest.yaml
│      └── nginx.conf                       ← 基于 Jinja2 模板生成的 Nginx 配置
├── resources/                              ← 将应用改造为 DIP 应用所需的资源文件
│      └── micro-app.yaml                   ← 主应用注入到微应用的方法定义
│      └── public-path.js                   ← 用于动态设置 Webpack / Vite 的 `publicPath`
├── scripts/                                ← 用于执行构建 & 打包任务的脚本
│   └── build_package.py                    ← 自动构建脚本
├── snippets/                               ← 代码改造的示例片段
├── templates/                              ← 构建 & 打包所需的配置模板
│   └── charts/                             ← Helm Chart 配置文件模板
│      └── templates/                       ← Chart Tempaltes
│      └── values.yaml.j2                   ← Chart Values 模板
│      └── Chart.yaml.j2                    ← Chart 定义模板
│   └── Dockerfile.j2                       ← Dockerfile 模板
│   └── manifest.yaml.j2                    ← DIP 应用描述文件模板
│   └── nginx.conf.j2                       ← Nginx 配置文件模板
├── config.yaml                             ← 用于填充配置文件模板的参数
```

# 包呢？
构建完成后，请移步 `.cache` 目录，根据目录名称在 package 下找到 .dip 后缀的 DIP 应用安装包。（请定期打扫 .cache 目录）

# 免责声明
使用本工具对代码造成的任何破坏都是 AI 的行为，本工具开发者不承担任何风险和后果。（再次提醒您：请先备份代码）