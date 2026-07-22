<h1 align="center">
  <img src="public/penecho-readme-header.png" alt="PenEcho" width="760">
</h1>

<p align="center"><strong>突破聊天框，与 AI 一起思考。</strong></p>

<p align="center">PenEcho 是一块共享画布，让手写内容、方程、图表和空间上下文都成为对话的一部分。</p>

<p align="center">
  <a href="https://discord.gg/3jrPJ3mXdX">
    <img src="https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?style=for-the-badge&amp;logo=discord&amp;logoColor=white" alt="加入 PenEcho Discord">
  </a>
  <a href="https://github.com/penecho/penecho/stargazers">
    <img src="https://img.shields.io/github/stars/penecho/penecho?style=for-the-badge&amp;logo=github&amp;logoColor=white&amp;color=f5b301" alt="在 GitHub 上为 PenEcho 点亮 Star">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL%20v3-blue?style=for-the-badge" alt="许可证：AGPL v3">
  </a>
</p>

<p align="center">
  <a href="README.md">English</a> &bull;
  <strong>简体中文</strong> &bull;
  <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="#quick-start">快速开始</a> &bull;
  <a href="#recommended-model-configurations">推荐模型</a> &bull;
  <a href="docs/architecture.md">架构</a> &bull;
  <a href="https://discord.gg/3jrPJ3mXdX">Discord</a>
</p>

<p align="center">
  <img src="https://github.com/penecho/penecho/releases/download/v0.1.0/penecho_plugins_sub_x10.webp" alt="PenEcho 插件演示" width="100%">
</p>

<p align="center">
  <img src="https://github.com/penecho/penecho/releases/download/v0.1.0/penecho_full_demo.webp" alt="PenEcho 完整演示" width="100%">
</p>

<a id="a-kimi-open-source-friend"></a>

## Kimi 开源伙伴

<p align="center">
  <a href="https://www.kimi.com/code?aff=penecho">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/assets/kimi-open-source-friends-dark.svg">
      <img alt="Kimi Open Source Friends" src="docs/assets/kimi-open-source-friends-light.svg">
    </picture>
  </a>
</p>

PenEcho 是 **Kimi Open Source Friends** 的正式成员。这是 [Moonshot AI](https://www.kimi.com/) 为优秀开源项目提供支持的计划。Kimi 团队通过 API 额度支持 PenEcho 的开发；在要求较高的画布任务中，Kimi K3 也是[推荐模型](#recommended-model-configurations)之一——手写内容识别准确、图表处理能力强，实际使用速度也很快。

直接使用以下链接即可支持本项目：

- **[Kimi Code](https://www.kimi.com/code?aff=penecho)** — Kimi 编程订阅服务，全球可用
- **[Kimi 开放平台 · 中国](https://platform.kimi.com?aff=penecho)** — 中国大陆地区的 API 访问入口
- **[Kimi 开放平台 · 全球](https://platform.kimi.ai?aff=penecho)** — 其他地区的 API 访问入口

<a id="contents"></a>

## 目录

- [快速开始](#quick-start)
- [在画布上思考](#think-on-the-canvas)
- [0.7.0 新功能](#whats-new-in-070)
- [0.6.0 新功能](#whats-new-in-060)
- [0.6.0 中的动画场景](#animation-scenes-in-060)
- [工作原理](#how-it-works)
- [推荐的模型配置](#recommended-model-configurations)
- [Token 用量和费用](#token-use-and-cost)
- [安全部署](#safe-deployment)
- [实用配置](#useful-configuration)
- [与我们一起构建](#build-it-with-us)
- [许可证与商业使用](#license-and-commercial-use)

<a id="quick-start"></a>

## 快速开始

你需要安装 [Node.js 18.17+](https://nodejs.org/)，并具备以下条件之一：API 密钥、已认证的 [Codex CLI](https://developers.openai.com/codex/cli)，或已认证的 [Claude Code CLI](https://code.claude.com/docs/en/overview)。

```bash
npm install -g penecho
penecho configure
penecho
```

交互式启动时会立即显示当前版本。服务器开始监听后，PenEcho 会显示 `Checking latest PenEcho version...` 并查询 npm，但不会因此延迟服务可用时间。如果存在新版本，请在默认的 `Y` 提示处按 Enter 进行全局安装。随后当前服务会停止，且不会启动后台进程；准备好启动更新后的版本时，请再次运行 `penecho`。如果安装的已经是最新版本，PenEcho 会明确说明。离线检查和非交互式启动不会阻塞正在运行的服务。

`penecho configure` 会打开交互式配置中心。主菜单包含 `LLM source`、`Settings` 和 `Exit`。使用方向键和 Enter 导航：

- `LLM source -> Claude CLI`：选择自动检测到的、推荐的、默认的或手动输入的模型，以及 effort 级别。建议使用 Opus 4.8 或更新版本；Sonnet 和 Opus 4.6 虽然也能响应，但画布结果可能较弱。
- `LLM source -> Codex CLI`：选择模型和 effort。要获得良好结果需要 GPT-5.5 或更新版本，推荐 `gpt-5.6-sol`，列表中的最高 Codex effort 为 `xhigh`。
- `LLM source -> API`：选择 OpenAI 兼容或 Anthropic/Claude 兼容的请求格式，然后输入 URL、模型、effort 和隐藏密钥。Kimi K3（[中国](https://platform.kimi.com?aff=penecho) / [全球](https://platform.kimi.ai?aff=penecho)）使用 OpenAI 兼容格式，模型为 `k3`；当前测试建议使用 `medium`。Anthropic API 提供 `none` 以禁用思考，新配置默认采用推荐的 `medium` 自适应思考级别。PenEcho 不会为 API 请求、连接检查或 CLI 调用设置 `temperature`；每个提供商和模型会使用自己的默认值。已有值会作为默认值显示，密钥留空则保留已保存的密钥。
- `Settings`：控制统一的模型超时时间、发送给每个模型执行器的图片格式、请求记录与保留策略、监听接口和端口，以及 Auto AI 的初始延迟。默认使用 WebP，也可以选择 PNG。延迟也可以在画布上修改。

每个 LLM 页面都以 `Test & Save` 结束，PenEcho 会先保存再检查。Codex CLI 使用快速离线检查：验证可执行文件和登录状态，然后读取 `codex debug models --bundled`，确认所选模型存在。该检查不会执行推理、附加图片、刷新在线模型目录，也不会消耗模型 Token。Claude CLI 和 API 配置仍会发送一个很小的真实请求，以验证选定的端点和模型设置。无论检查成功还是失败，配置都会保留，界面会返回上一级菜单并显示清晰的诊断信息。

画布工具栏在 Auto AI 旁边提供了固定宽度、可点击的 `Reasoning` 菜单，便于频繁调整每次请求的设置：`Configured`、`none`、`low`、`medium`、`high`，以及提供商实际支持的最高级别。`Configured` 会省略请求级 effort 字段，让服务器保留已配置的自定义 effort 或底层 CLI 默认值。最后一个显式选项在 OpenAI API 和 Codex CLI 中映射到 `xhigh`，在 Anthropic API 和 Claude CLI 中映射到 `max`。`none` 会向 OpenAI 发送 `reasoning_effort=none`；对 Claude 则会禁用思考。模型支持情况仍取决于提供商，因此端点可能拒绝所选模型不支持的级别。已保存的 `AI_EFFORT` 用于初始化该控件；工具栏中的更改会覆盖后续画布请求，但不会重写配置文件。选择选项后或闲置五秒后，菜单会关闭。

默认配置文件为 `~/.penecho/config.env`。API 凭据以明文形式保存在这个本地文件中；在 POSIX 系统上，该文件会被设置为仅所有者可访问，并且凭据绝不会发送到浏览器代码。请像保护其他凭据一样保护该文件。如果在此文件存在前启动 `penecho`，交互式终端会自动打开配置中心。

如有需要，可以为特定启动使用其他 env 风格配置文件：

```bash
penecho configure --config ./team.env
penecho --config ./team.env
```

显式指定的 `--config` 文件会替代该命令的默认全局文件。PenEcho 不会自动读取项目目录中的 `.env` 或包目录中的 `.env`。

<a id="cli-prerequisites"></a>

### CLI 前置条件

仅安装 Codex 桌面应用并不能保证 shell 的 `PATH` 中存在 `codex` 可执行文件。选择 Codex 前，请单独安装并认证 CLI：

```bash
npm install -g @openai/codex@latest
hash -r
codex --version
codex login status
```

如有需要，请运行 `codex login`。Claude CLI 模式同样要求安装并认证 Claude Code CLI，通常通过 `claude auth login` 完成。

PenEcho 在本地使用所选 CLI，该来源不需要 API 密钥。正常启动只会检查可执行文件和登录状态，不消耗模型 Token。Codex 的 `Test & Save` 还会把所选模型与已安装 CLI 的内置目录进行核对，不会发起模型请求；Claude 的 `Test & Save` 则会发送一个很小的真实请求。

通过 Codex 发起的画布请求使用 `codex exec --json`。Codex 发出最终代理消息和 `turn.completed` 后，PenEcho 会立即返回；如果 CLI 进程之后仍在运行，系统会在后台终止并清理它，而不是延迟画布响应。

Claude CLI 请求使用一次隔离的 `claude -p` 回合，并禁用工具、代理、MCP、提示建议、会话持久化以及其他非必要后台流量。选择 effort `none` 会设置 `MAX_THINKING_TOKENS=0`，让 Claude Code 发送 `thinking.type=disabled`；由于 `none` 不是有效的 Claude CLI effort 值，PenEcho 还会在内部传入 `low` effort，并通过每进程 `--settings` 覆盖来抵消用户级别的 `CLAUDE_CODE_EFFORT_LEVEL=max`。选择 `low`、`medium`、`high` 或 `max` 时，思考保持启用，并通过 Claude 的 `--effort` 标志和同一个设置覆盖应用所选值。PenEcho 会增量验证数据流，在 Claude 发出成功的最终 `result` 后立即返回；任何工具调用尝试都会中止请求，而在结果之后仍存活的 CLI 进程会在后台终止并清理。

仍可使用临时启动覆盖：

```bash
penecho doctor --codex
penecho --codex --model gpt-5.6-sol --effort xhigh
penecho --claude --model opus --effort max
penecho --port 4000
```

`--model`、`--effort` 和 `--port` 只对当前进程生效，并优先于选定配置文件中的设置。省略它们即可使用已保存的选择或底层 CLI 默认值。其他模型特定的 effort 字符串也会被接受并原样传递。

<a id="run-from-this-source-directory"></a>

### 从此源代码目录运行

安装依赖，并通过与已安装 CLI 相同的生产入口启动当前检出：

```bash
npm install
npm start
```

首次交互式启动会在需要时打开配置中心。`--` 后的参数会传递给 PenEcho，例如 `npm start -- --port 4000`。

如果要让当前检出中的 `penecho` 命令在全局可用，请改用：

```bash
npm link
penecho configure
penecho
```

`npm link` 会创建本地命令链接，不会发布这个包。没有单独的构建步骤。

打开 [http://localhost:3888](http://localhost:3888)。使用默认的 `0.0.0.0` 监听地址时，启动信息还会在后续几行显示此计算机的具体 LAN URL。在同一网络的另一台设备上打开其中一个 URL；如果无法连接，请在主机操作系统的防火墙或相关路由策略中允许配置的入站 TCP 端口。

<a id="think-on-the-canvas"></a>

## 在画布上思考

在画布上的任意位置写下问题、方程、图表或尚未成形的想法，然后稍作停顿。PenEcho 会读取你的笔迹及其空间关系，并在旁边作答。你无需把每一步都转换成聊天消息，也无需使用僵硬的制图工具重新构建内容，就能逐步解决问题。

- 直接在画布上获得答案、提示、解释、续写、公式、绘图和图表。
- 在画布上直接拖动 AI 草稿，按组或坐标轴调整大小，复制返回的文本或公式，然后在其成为工作内容之前接受或丢弃。
- 使用触控笔或鼠标自然绘制，然后在稀疏的 `20,000 x 20,000` 画布上平移和缩放。
- 围绕已确认笔迹自由绘制套索，以移动、调整大小、更改颜色、删除，或仅将所选内容发送到 Typeset；普通的选择编辑和取消操作绝不会触发 AI 请求。
- 根据正在探索的问题类型选择 Arcane、Sci-fi、Research 或 Studio 模式。
- 在浏览器中本地保存轻量级快照。新建画布时，可以覆盖当前快照、另存为新副本，或不保存直接继续；尚未确认的 AI 草稿永远不会包含在快照中。
- 将已确认的画布笔迹导出为裁剪后的 PNG，四周各保留一个 `512` 像素图块大小的纸张边距。

PenEcho 维持一个小型本地运行时，只在存在笔迹的位置分配 `512 x 512` 图块，因此巨大的逻辑画布不会变成巨大的位图。

<a id="whats-new-in-070"></a>

## 0.7.0 新功能

- **画布上的实时交互式 HTML。** 新的 General HTML 插件让模型能够构建时钟、计算器、仪表盘及其他针对具体任务的响应式界面，并将其作为沙箱化画布小组件运行。小组件内容可直接交互；长按可切换到画布编辑模式，以移动、调整大小、确认或删除组件。
- **无需 PenEcho 数据服务也能使用实用数据。** 专用插件涵盖天气、股票、科技新闻、汇率、地震、自然事件、空间天气和 GitHub 活动。请求直接从用户浏览器发送到各插件声明的 API 来源；PenEcho 不会代理或缓存插件数据。
- **明确的安全边界。** 每个数据插件都会声明允许的 `connect` 来源。小组件网络访问仅限该允许列表，HTML 在隔离的 iframe 中运行；被禁用的插件不会提供任何提示、负载、消息钩子或小组件运行时行为。
- **本地创建插件。** 紧凑的 Markdown 格式将元数据、运行时规则和必需的单次示例组合在约 1,000 个 Token 或更少的提示预算中。Preview 创建器可以用 AI 改进草稿、填写标题、在本地保存并启用插件，之后也可以删除个人插件；个人插件和内置插件在目录中始终明确分开。
- **画布原生的持久化与导出。** 已确认的小组件会包含在本地快照和 PNG 导出中。宽度和高度手柄会重新排版界面而不缩放文本，角落手柄则像图片一样缩放整个小组件；删除操作仍可撤销。
- **合理的默认设置。** General HTML、Animation scenes 和 Weather 对新用户默认启用。其他数据插件仍需主动选择启用，并且每项选择都会保存在本地。

<a id="whats-new-in-060"></a>

## 0.6.0 新功能

- **可控的动画解释。** 声明式动画场景默认启用，因此模型可以在你明确要求时，或动画确实能改善解释时使用动态效果。通用 Plugins 菜单可以将其关闭，从而移除额外的 500–600 个提示 Token，并恢复原始请求和渲染行为。
- **安全、持久的动画渲染。** 透明 Canvas2D 场景最多支持 32 个对象和 32 个动作，可立即播放，在确认前后均可编辑，并通过快照持久保存。渲染器使用带脏区更新的独立透明图层，将画布中的动画数量限制为 20 个，并且绝不会执行模型提供的 JavaScript。
- **适合触控和触控笔的动画控件。** 鼠标和触控笔点击会立即显示完整动画工具栏；触控操作则需要长按一秒，避免在画布平移时误触。十秒后、点击外部区域或重新开始绘制时，工具栏和选择轮廓会一起隐藏。
- **更可靠的模型输出。** 请求会预留输出空间，动画尺寸受到限制但不会鼓励生成过大的场景，服务器还能从无害的尾随模型输出中恢复第一个完整的 JSON 响应。无效、不完整、被禁用或超限的动画命令仍会被明确拒绝。
- **更清晰的文本和草稿渲染。** 已确认文本会自动格式化安全的 Markdown 和疑似 LaTeX，Preview 中显示相同的最终结果。大型降采样 AI 草稿现在会按照其逻辑尺寸裁剪，避免初始状态只渲染左上角四分之一的缺陷。
- **非阻塞式 npm 更新。** 交互式启动会先让服务上线再检查 npm，清晰显示已安装版本，并在接受全局更新后干净停止，让用户手动启动升级后的服务。

<a id="animation-scenes-in-060"></a>

## 0.6.0 中的动画场景

动画是可移除的插件，并非每个 PenEcho 请求的永久要求。画布工具栏的 `Plugins` 菜单默认启用 `Animation scenes`。如果想恢复原始静态请求和画布行为，可以随时取消其复选框；PenEcho 会记住该选择。

- **启用时：** 当你明确请求动画，或运动过程确实有助于说明答案时，模型可以返回动画演示。额外的动画协议会为每个 AI 请求增加约 `500–600` 个输入 Token。
- **禁用时：** PenEcho 会省略动画协议和插件字段，过滤新的动画命令，并且不渲染动画场景。静态请求和画布行为与该功能推出前保持一致。之前保存的场景仍会保留，重新启用插件后即可再次使用。
- **按透明方式设计：** 动画场景没有背景图层，因此下方的纸张、手写内容、图表及其他画布内容仍然可见。

例如，启用插件后，你可以书写或请求动画轨道模型、移动的几何构造、相互作用的图形，或其他时间变化是解释组成部分的过程。模型会被要求选择适合实际请求的尺寸；每个坐标轴的 `5000` 个逻辑单位是上限，而不是目标值。

返回的场景在仍为可编辑草稿时就会开始播放。移动草稿或调整其大小，然后像处理其他 AI 输出一样接受或丢弃。确认后：

- 使用鼠标或触控笔点击，立即显示完整的编辑控件。
- 触摸并按住一秒即可显示控件，且不会干扰普通的单指画布平移。
- 使用控件暂停或继续播放、重新开始、移动、调整大小、确认编辑、取消编辑或删除场景。
- 大约十秒后、点击外部区域、导航画布、更换工具或画出新的笔画时，工具栏、轮廓和大小调整控件会一起隐藏。

动画场景是由 PenEcho 自有 Canvas2D 渲染器绘制的声明式 JSON 数据；模型提供的 JavaScript 永远不会执行。每个场景最多包含 `32` 个对象和 `32` 个动作，一块画布最多可包含 `20` 个动画。只有可见且正在播放的场景会请求动画帧；复杂的可见场景会降低刷新率，变化的屏幕区域则独立重绘。已确认的场景和播放状态会保存在本地快照中，启用的动画会以固定帧包含在预览、导出内容和后续模型上下文中。

<a id="how-it-works"></a>

## 工作原理

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/how-it-works-dark.svg">
    <img alt="PenEcho 的工作原理：画布笔迹转化为视觉图集，服务器将其路由到已配置的执行器，再把结构化且可编辑的草稿返回画布" src="docs/assets/how-it-works-light.svg">
  </picture>
</p>

浏览器只发送相关的画布裁剪内容和几何信息。服务器验证请求、使用所选执行器，并返回一个可移动的草稿；在你接受之前，该草稿与已确认笔迹始终分离。

<a id="recommended-model-configurations"></a>

## 推荐的模型配置

这些建议在 PenEcho 真实画布工作负载的回答质量和延迟之间取得平衡。它们基于当前实际测试，而非合成基准；实际响应时间仍会因提供商、画布复杂度、图片大小和推理行为而异。

| 模型 | Effort | 质量与速度 | 推荐用途 |
| --- | --- | --- | --- |
| `claude-opus-4-8` | `medium` | 质量强，同时延迟平衡更好 | 日常画布工作的推荐 Opus 默认值 |
| `claude-opus-4-8` | `high` | 推理质量更高，但等待时间更长且波动更大 | 复杂手写内容、数学、图表或布局决策等质量比速度更重要的任务 |
| Fable 5（`claude-fable-5` 或 `fable`） | `medium` | 结果非常好；在当前测试中，响应时间通常约为采用 `xhigh` 的 `gpt-5.6-sol` 的一半 | 快速、高质量的通用选择 |
| [Kimi K3](https://platform.kimi.ai?aff=penecho)（`k3`） | `medium` | 当前对比中的质量非常好；`medium` 可保持实用的质量与速度平衡 | 高要求画布工作的推荐 Kimi/API 默认值 |
| `gpt-5.6-terra` | `low` 至 `high` | 表现出乎意料地强且响应迅速；当前 PenEcho 画布测试中，结果优于 `gpt-5.6-sol`，同时响应很快 | 适用于灵活质量和延迟目标范围的推荐 OpenAI 选项 |
| `gpt-5.6-luna` | `xhigh` | 画布结果非常好，响应速度也很强 | 适合使用 `xhigh` 推理时、响应迅速且质量优先的选项 |
| `gpt-5.6-sol` | `high` | 足以应对大多数请求，且比 `xhigh` 响应更快 | 重视响应速度时推荐的 Sol 默认值 |
| `gpt-5.6-sol` | `xhigh` | 结果非常好，但速度更慢、波动更大 | 面向高难度画布任务、质量优先的 Sol 配置 |

尚未测试 Google 模型，欢迎贡献：如果你尝试了 Gemini 或其他 Google 模型，请在 Issue 中分享模型 ID、提供商或执行器、推理配置、大致延迟和一个具有代表性的画布示例。

<a id="token-use-and-cost"></a>

## Token 用量和费用

对于典型的 PenEcho 画布请求，包括提供商报告的隐藏推理 Token 在内，总输出用量大致随所选 effort 级别变化：

| Effort | 典型输出用量 | 实用建议 |
| --- | --- | --- |
| `low` | 约 `1,000` 个 Token | 通常足以处理多数日常画布请求 |
| `medium` | 约 `3,000` 个 Token | 为识别、数学、图表和布局提供更多推理空间 |
| `xhigh` 或 `max` | 约 `5,000–8,000` 个 Token | 常见于质量优先的 `gpt-5.6-sol` 及其他最高 effort 请求；预计延迟和费用更高 |

这些是实际估算值，并非 PenEcho 强制实施的限制。实际用量可能因模型、提供商、画布复杂度和推理行为而显著不同。以下费用示例继续采用典型的 `low` 情况：`10,000` 个输入 Token 和 `1,000` 个输出 Token。按照标准短上下文 API 费率，费用为：

- `gpt-5.6-sol`：`10,000 x $5.00 / 1M + 1,000 x $30.00 / 1M = $0.080`
- `gpt-5.6-terra`：`10,000 x $2.50 / 1M + 1,000 x $15.00 / 1M = $0.040`
- `gpt-5.6-luna`：`10,000 x $1.00 / 1M + 1,000 x $6.00 / 1M = $0.016`

按这些示例用量计算，每次请求约为 1.6 至 8 美分。Medium、`xhigh` 和 `max` 请求可能费用更高，因为它们的推理 Token 按输出计费。价格可能发生变化，请查看 [OpenAI API 定价](https://developers.openai.com/api/docs/pricing)页面了解当前费率。

如果使用 ChatGPT 登录 Codex，PenEcho 会使用套餐包含的 Codex 用量，而不是 API 密钥。套餐包含的限额各不相同，额外用量可能需要使用 ChatGPT 点数。有关当前套餐和限额，请参阅 [Codex 定价](https://learn.chatgpt.com/docs/pricing)。同样，Claude CLI 模式使用 Claude Code 中认证的账号，与 Anthropic API 计费相互独立。

<a id="safe-deployment"></a>

## 安全部署

PenEcho 默认监听 `0.0.0.0:3888`，因此 localhost 和受信任 LAN 访问可以立即使用。请选择与执行器匹配的部署边界：

- **Codex CLI 和 Claude CLI 模式：** 仅在本机或受信任、直接连接的 LAN 中使用。有效请求会启动本地 CLI 进程，因此不要将任一模式直接暴露到公共互联网或不受信任的反向代理。两种模式均可立即从 localhost 和 LAN 地址使用，无需设置公共 Origin。PenEcho 会在启动所选 CLI 前检查 Host、客户端网络、精确 Origin、进程生命周期会话 Cookie 和 JSON 内容类型。每个新的有效请求会立即取代上一个请求；它不会排队等待，也不会返回忙碌响应。
- **API 模式：** 有意接受本地、LAN、代理和远程请求，不施加 PenEcho 层面的 Host 或 Origin 限制。如果要公开暴露，请将其置于 HTTPS、认证、速率限制和请求大小控制之后。请确保所选配置文件和提供商密钥保持私密；凭据始终留在 Node.js 进程中，绝不会发送到浏览器代码。

无论使用哪种模式，除非正在主动诊断问题，否则请在生产环境中禁用调试产物和请求跟踪；绝不要发布包含私密内容的配置文件、日志、截图或已保存请求。在 `Settings` 中启用请求记录后，每个有效 AI 请求默认会存储在 `~/.penecho/logs/requests` 下，包括源 `atlas.png`、出站图片、已移除凭据的请求正文、原始响应和解析后响应、回退详情及最终状态。界面也会显示该路径并配置保留策略。

<a id="useful-configuration"></a>

## 实用配置

配置中心会把以下设置写入 `~/.penecho/config.env`，或由 `--config` 选定的文件：

| 设置 | 用途 |
| --- | --- |
| `AI_PROVIDER` | 执行器：`api`、`codex-cli` 或 `claude-cli` |
| `AI_API_FORMAT` | API 请求格式：`openai`（默认示例）或 `anthropic` |
| `AI_API_URL` / `AI_API_KEY` | API 端点和凭据；仅在 API 模式中使用 |
| `AI_API_MODEL` | API 模式中使用的模型 |
| `AI_EFFORT` | 画布控件的启动推理 effort；工具栏的 `Configured` 选项会原样保留该值（包括自定义名称），空 CLI 值则会保留 CLI 默认设置；Anthropic API 和 Claude CLI 支持 `none`（传输值为 `thinking.type=disabled`），OpenAI 则发送 `reasoning_effort=none`；显式选择的工具栏级别会覆盖单次请求的该值，而不修改配置文件 |
| `AI_TIMEOUT_SECONDS` | API、Codex CLI 和 Claude CLI 模型尝试共用的超时时间；默认为 180，允许范围为 10–600 |
| `PENECHO_AI_IMAGE_FORMAT` | 发送给 API、Codex CLI 和 Claude CLI 的图片格式：`webp`（默认）或 `png` |
| `CODEX_CLI_MODEL` | Codex CLI 模式的可选模型覆盖 |
| `CLAUDE_CLI_MODEL` | Claude CLI 模式的可选别名或模型 ID 覆盖 |
| `AUTO_AI_DELAY_SECONDS` | 自动识别前的初始延迟；浏览器控件可在 0 至 10 秒之间覆盖该值 |
| `PENECHO_REQUEST_TRACE` | 保存本地的单次请求图片、出站请求、响应及结果跟踪；默认禁用 |
| `PENECHO_REQUEST_TRACE_LIMIT` | 保留的本地请求跟踪数量；默认为 100，最大为 1000 |
| `HOST` / `PORT` | 监听接口和端口；默认为 `0.0.0.0:3888` |

对于已安装的 CLI 启动，`--model` 会覆盖所选执行器的模型设置，`--effort` 会仅为该进程覆盖 `AI_EFFORT`。命令行选项和进程环境变量优先于所选配置文件。

提交更改前请运行检查：

```bash
npm run check
```

有关实现细节，请参阅[架构说明](docs/architecture.md)。

<a id="build-it-with-us"></a>

## 与我们一起构建

PenEcho 仍是一个年轻且开放构建的项目。手写识别、画布内视觉工具、更广泛的模型支持和自然的触控笔交互等最重要的问题仍有待解决；无需编写代码也可以帮助项目不断前进。

参与方式：

- **使用它并分享实际情况。** 一块运行良好的画布或彻底失败的画布，比任何基准都能提供更多信息。只需提供一张已移除敏感信息的截图即可。
- **测试模型。** PenEcho 支持为 API、Codex CLI 和 Claude CLI 执行方式分别选择模型，不同模型的行为仍有差异。请报告执行器、模型 ID、effort、大致延迟和示例结果。Google/Gemini 模型尚未经过测试，尤其欢迎相关反馈。
- **报告不够顺畅的地方。** 识别错误、布局问题和不自然的触控笔行为，无论多小都值得提交 Issue。对于模型特定的问题，请附上可复现的画布示例以及预期结果和实际结果。
- **编写代码。** 识别、视觉工具、模型适配器和触控笔输入都还有改进空间。打开 Pull Request 前，请使用 `npm run check` 运行完整检查套件。
- **帮助更多人读懂项目。** 当前 UI 提供英文和中文；欢迎增加更多翻译和更清晰的文档。

交流渠道：

- [Discord](https://discord.gg/3jrPJ3mXdX) — 实时讨论、模型测试记录和共享画布工作流。欢迎新成员和仍在完善中的作品。
- [GitHub Discussions](https://github.com/penecho/penecho/discussions) — 适合保留并便于搜索的想法和问题。
- [GitHub Issues](https://github.com/penecho/penecho/issues) — 用于可复现的 Bug 和已确认的工作。

新贡献者请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。如果 PenEcho 让你产生共鸣，欢迎为仓库点亮 Star 并分享演示——正是这种可见度把下一位贡献者带到这里。

<a id="license-and-commercial-use"></a>

## 许可证与商业使用

PenEcho 采用且仅采用 [GNU AGPL v3.0](LICENSE) 开源。AGPL 允许商业使用。如果你修改 PenEcho 并通过网络向用户提供修改后的版本，则必须按照许可证要求向这些用户提供相应的源代码。

对于无法满足 AGPL 要求的专有产品和托管服务，项目提供另一种[商业许可证](COMMERCIAL-LICENSE.md)。PenEcho 名称和徽标另行受 [PenEcho 商标政策](TRADEMARKS.md)约束。

贡献者保留其作品的所有权，并授予项目所需的权利，使其能够同时提供 AGPL 和商业版本。请参阅[贡献者协议](CONTRIBUTOR-LICENSE-AGREEMENT.md)。
