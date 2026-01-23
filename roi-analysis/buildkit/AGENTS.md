将 Web 应用改造成 qiankun 微应用并打包 DIP 应用安装包。

# 规则
- 在进行代码改造、构建或打包任务前，仔细阅读 README.md
- 以本文件所在目录为工作目录
- 使用 uv 作为 Python 项目管理工具
- 在 .venv 虚拟环境中执行 Python
- 在 .cache 目录下创建子目录（后续使用 {task} 引用）存放临时缓存文件
- 不要在项目代码中直接 import 任何代码文件，把代码文件复制到正确的位置后，再从该位置导入代码文件
- 不要修改 templates、resources、scripts 中的原文件。
- 使用 jinja2 作为模板引擎，从 config.yaml 读取变量

# 流程
按以下流程改造代码并打包应用：
1. [ ] 导出 qiankun 生命周期函数
2. [ ] 读取 micro-app.yaml，在项目的 src 目录下生成 micro-app.d.ts 类型定义文件
3. [ ] （仅使用 Webpack 打包时需要）复制 public-path.js 到项目的 src 目录或源代码根路径下，并在入口文件**头部**导入 public-path.js
4. [ ] 改造路由
5. [ ] 将全局状态管理集成进现有代码
6. [ ] 将认证信息管理集成进现有代码
7. [ ] 改造 Webpack / Vite 构建配置
8. [ ] 构建 DIP 应用安装包

## 导出 qiankun 生命周期函数
- 分析项目中的 HTML 代码，找到入口文件。在入口文件导出 `bootstrap`、`mount`、`unmount` 三个 qiankun 生命周期函数：
  * `bootstrap()`：微应用启动时调用，可以在这里做一些初始化工作
  * `mount()`：微应用挂载时调用，在这里渲染应用
  * `unmount()`：微应用卸载时调用，在这里清理资源
- 如果使用的是 Webpack，参考：`snippets/lifecycle.webpack.before.tsx`和`snippets/lifecycle.webpack.after.tsx` 对代码进行改造
- 如果使用的是 Vite，参考：`snippets/lifecycle.vite.before.tsx`和`snippets/lifecycle.vite.after.tsx` 对代码进行改造，注意：
  * 需要引入 `vite-plugin-qiankun`
  * 使用 `renderWithQiankun` 导出生命周期函数
  * 使用 `qiankunWindow.__POWERED_BY_QIANKUN__` 判断是否在 qiankun 环境中运行

## 改造路由
从 props 中获取 basename，并传递给路由系统。
- 如果使用的是 React Router 6，参考：`snippets/router.6.tsx`
- 如果使用的是 React Router 5，参考：`snippets/router.5.tsx`
- 说明：
  * basename 由主应用提供，格式如 /application/123
  * 微应用内部路由应该使用相对路径，如 /、/about，而不是绝对路径
  * 最终访问路径 = basename + 微应用内部路径，如：/application/123/about

## 将全局状态管理集成进现有代码
参考：`snippets/state-listening.tsx`，主应用提供了全局状态管理 API，微应用可以：
  - 设置状态：更新面包屑
  - 监听状态：监听语言切换等全局状态变化

微应用只能更新以下字段：
  - breadcrumb：面包屑导航数据
  - 其他字段（如 language）只能由主应用更新，微应用只能监听。

## 将认证信息管理集成进现有代码
参考：`snippets/authorization.tsx`，在微应用中接收 token 和用户信息。

# 改造 Webpack / Vite 构建配置
- WebPack 需要配置 output 支持 UMD 格式，这是 qiankun 微应用的关键配置。参考：`build.webpack.tsx`
- Vite 需要引入 `vite-plugin-qiankun` 并且设置 `base` 属性与 packageName 对应，参考：`build.vite.tsx`

  ## 构建 DIP 应用安装包
  - 执行 `uv run scripts/build_package.py --arch amd64`，构建 AMD64 架构的 DIP 应用安装包
  - 执行 `uv run scripts/build_package.py --arch arm64`，构建 ARM64 架构的 DIP 应用安装包