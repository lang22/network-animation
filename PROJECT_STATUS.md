# Network Protocol Animation 项目进展

> 本文档为 AI 助手提供上下文，用于快速恢复开发工作。
> 最后更新：2026-10-28

## 项目概述

一个网络协议动画模拟器，使用 React + TypeScript + Redux + styled-components 构建。实现了 TCP 协议的完整生命周期动画：三次握手、数据传输、四次挥手。

## 技术栈

- React 18 + TypeScript
- Redux Toolkit (状态管理)
- styled-components (样式)
- Webpack 5 (构建)
- Jest + Testing Library (测试)

## 当前完成的功能

### TCP 协议模拟器 (`/protocol/tcp`)

1. **三次握手动画** - SYN → SYN-ACK → ACK，含完整状态变更
2. **数据传输动画** - DATA → ACK，显示 SEQ/ACK 数值
3. **四次挥手动画** - FIN → ACK → FIN → ACK，含 2MSL 等待
4. **⚡ 一键演示** - 自动完成全流程：握手→发数据→挥手，流程中禁止其他操作
5. **时间线进度显示** - 顶部悬浮显示当前阶段步骤
6. **通道状态条** - 通道底部实时展示双方 TCP 状态和转换
7. **数据包详情面板** - 右侧面板展示完整 TCP/IP 头部、载荷等信息
8. **端点接收列表** - 客户端/服务端盒子中垂直展示已接收的数据包

### TCP 拥塞控制模拟器 (`/protocol/congestion`)

1. **滑动窗口动画** — 按 cwnd 连续发送数据包，接收端回 ACK
2. **慢启动 / 拥塞避免** — cwnd 指数增长到 ssthresh 后改为线性增长
3. **RTO 超时重传** — 丢包在链路中途判定，等 RTO 超时后 cwnd 降为 1、ssthresh 减半，再重传（同一轮多包丢失只降一次）
4. **重传同样可能丢** — 每次重传重新参与丢包判定，累计 3 次失败后放弃该包
5. **重复 ACK 与快重传** — 接收端按期望序号回累计 ACK，乱序回重复 ACK，3 个重复 ACK 触发快重传（不等 RTO）
6. **丢包控制** — 丢包率 0/5/10/20% 可选，或指定下一个包强制丢弃（演示用）
7. **实时统计** — RTO 超时、重复 ACK、快重传、重传次数、丢包数、cwnd 曲线、事件日志
8. **演示可终止** — 演示任务带批次号，点「终止」会连带取消正在等待的 RTO 与动画

### 动画系统

- **出现动画** - 数据包弹出（scale 0→1 + opacity），带弹性回弹
- **飞行拖尾** - 数据包飞行时拖曳彩色渐隐线
- **消失动画** - 到达后停留→缩小淡出+模糊，像被端点吸收
- **端点脉冲** - 收发数据包时端点盒子触发扩散波纹
- **easeInOut 缓动** - 飞行速度曲线自然
- **连接光缆** - 已连接时通道中部发光线，传输中增亮
- **轨道标签** - 通道左侧标注握手/传输/挥手区域

### 交互功能

- 点击飞行中或已接收的数据包查看详情，选中状态发光高亮
- 当前飞行数据包自动选中，右侧面板实时同步
- 0.5x / 1x / 2x 动画速度调节
- 右侧面板展示完整 TCP/IP/以太网头部信息 + 载荷预览

### 视觉设计

- 深色科技风 UI：深蓝黑背景 (`#0a0e17`)，霓虹青色主色调 (`#00d4ff`)
- 五种数据包配色：SYN(橙)、SYN-ACK(紫)、ACK(金)、DATA(青)、FIN(红)
- 端点盒子颜色：客户端(深绿)、服务端(深蓝)
- 状态徽章按 TCP 状态着色（绿/金/蓝/红/紫）
- 所有动画过渡平滑，适合教学演示

## 动画系统架构

```
src/
├── components/
│   ├── TcpProtocolVisualizer.tsx  # 主页面组件 (~580行)
│   ├── Animation/
│   │   ├── NetworkCanvas.tsx       # 画布容器（三列布局 + 连接线 + 状态条 + 轨道标签）
│   │   └── Packet.tsx              # 数据包组件（出现/消失动画 + 拖尾 + 发光选中）
│   ├── Panels/
│   │   └── PacketDetailPanel.tsx   # 数据包详情（概要/地址/IP/TCP/以太网/载荷）
│   ├── Layout/Header.tsx           # 顶部导航栏
│   └── ErrorBoundary.tsx           # 错误边界
├── hooks/
│   └── useTcpAnimation.ts          # 核心动画逻辑 + 业务调度 (~660行)
├── store/slices/
│   └── simulationSlice.ts          # Redux 状态（含 ActivePacket/AnimationUI/等）
├── services/protocols/
│   └── tcpService.ts               # TCP 协议逻辑（创建连接/握手/数据/挥手）
├── utils/
│   └── constants.ts                # 位置计算 + 动画配置 + 轨道定义
├── styles/
│   └── theme.ts                    # 深色主题 + 数据包/节点颜色
└── types/
    └── networkTypes.ts             # TCP/IP/以太网类型定义
```

### 数据包动画坐标系

```
┌─────────────┬────────────────────────────┬─────────────┐
│   客户端    │          通道区域           │   服务端    │
│   120px     │            1fr             │   120px     │
│             │                            │             │
│  clientBox  │  ◄── 数据包飞行范围 ──►     │  serverBox  │
│  Right      │                            │  Left       │
│  (136px)    │  拖尾──🔵──▶ DATA           │  (W-136px)  │
│             │                            │             │
└─────────────┴────────────────────────────┴─────────────┘
```

- `clientBoxRight`: `OUTER_PADDING + ENDPOINT_WIDTH = 16 + 120 = 136` (不含 gap)
- `serverBoxLeft`: `containerWidth - OUTER_PADDING - ENDPOINT_WIDTH = containerWidth - 136`
- 数据包使用中心点定位，`transform: translate(-50%, -50%)`
- 起始/结束边缘精确贴合端点盒子，不包含 gap

### 轨道位置分配

```
轨道Y%  │  标签         │  用途
────────┼───────────────┼──────────
  14    │  握手          │  SYN
  28    │  握手          │  SYN-ACK
  42    │  握手          │  ACK (握手)
  50    │  挥手          │  FIN1
  56    │  传输          │  DATA
  60    │  挥手          │  ACK1
  70    │  传输/挥手     │  DATA_ACK / FIN2
  80    │  挥手          │  ACK2
```

## 最近修改 (2026-10-29)

### 布局与演示节奏

1. **日志不再滚走整页** — 事件日志改成容器内 `scrollTop`；原来的 `scrollIntoView` 会把整个页面向右下滚，三栏布局被切掉
2. **画布不再被撑高** — `Main`/`Panel` 补 `min-height: 0`：右侧统计变高时面板内部滚动，画布稳定在 820px，不会长到 995px 把小球裁掉
3. **轨道按批次均分** — 新增 `laneY(i, count)`：单包走中线，多包按数量自动压缩间距，不再受固定 12 条轨道限制；演示 `ssthresh` 收到 12（最多 16 个球）
4. **演示节奏** — 飞行 3.0s→2.4s、ACK 2.0s→1.4s、完整演示 12→9 轮、轮间隔 800→500ms
5. **stateRef 时序** — 演示参数改为在 `sleep` 之前 dispatch：`stateRef` 要等一次渲染才更新，否则第一轮读到旧窗口，ssthresh 会被覆盖回 64

### 可视化验收

- 新增 `scripts/verify-ui.mjs` 与 `npm run verify:ui`：用本机 Edge/Chrome（playwright-core 驱动，不下载额外浏览器）打开页面截图，检查页面无滚动、画布不越界、飞行小球不出画布、指定丢包能触发快重传且不走 RTO；截图输出到 `artifacts/ui/`（已 gitignore）

## 最近修改 (2026-10-28)

### 快重传与快恢复

1. **接收端 ACK 模型** — 接收端记录期望序号：按序到达回累计 ACK，乱序到达回重复 ACK（琥珀色 ↺ 小球）
2. **3 个重复 ACK 触发快重传** — 不等 RTO，立即补发缺失包，cwnd/ssthresh 减半后进入快速恢复
3. **RTO 调到 8s** — 必须明显长于一个 RTT（飞行 2.4s + ACK 1.4s = 3.8s），否则重复 ACK 还没回来就超时了
4. **统计与日志** — 新增重复 ACK / 快重传计数，日志用颜色区分 dup_ack 与 fast_retransmit

### 拥塞控制丢包重传

1. **丢包判定提前到链路中途** — 发送时即决定该包是否丢失，小球飞到链路 55% 处变红停住，不再"飞到接收端才消失"
2. **RTO 从发送时刻起算** — 超时等待扣除小球飞行时间，符合真实 RTO 语义
3. **重传可再丢** — 每次重传重新参与丢包判定，`maxRetransmissions=3` 的重试上限真正生效
4. **演示可取消** — 引入批次号 + 取消钩子，`终止` 会 settle 所有等待中的 Promise，修复演示循环悬挂/泄漏
5. **一次拥塞事件只降一次窗** — 同一轮 RTT 内多个包超时，cwnd/ssthresh 只降一次，不再按丢包个数连续折半
6. **文案统一中文** — 丢包率、指定丢包序号、RTO 超时、重传次数、事件日志全部中文化

### 工程化

1. **ESLint 可用** — 补 `.eslintrc.json` 与 `@typescript-eslint` 依赖，`npm run lint` 从报错变为 0 error
2. **覆盖率门槛可执行** — 改为只对 `services/protocols` 与 `store/slices` 设门槛，`npm run test:coverage` 通过
3. **清理死代码** — 删除无人引用的 `SenderWindow`、`ProtocolStackPanel`、`TcpStateDiagram`、`TimelinePanel`（需要时从 git 历史取回）
4. **组件冒烟测试** — 新增拥塞控制页面渲染测试（中文文案 + 丢包控制写状态），`setupTests` 补 `ResizeObserver`/`scrollIntoView` 桩
5. **依赖升级** — `react-router-dom` 升到 6.30.6，消除运行时路由告警

## 最近修改 (2026-05-30)

### 界面优化

1. **轨迹修复** — 数据包位置基于端点盒子边缘计算（不含 gap），PacketsOverlay 覆盖整个画布
2. **动画增强** — 弹出出现 (scale+opacity)、拖尾线、吸收消失 (shrink+blur)、端点脉冲波纹
3. **接收包展示** — 端点盒子内垂直列表，点击可查看详情，选中高亮
4. **连接光缆** — 已连接时通道中部发光线，传输中增亮
5. **轨道标签** — 通道左侧标注握手/传输/挥手
6. **状态条** — 通道底部展示双方 TCP 状态，取代左栏状态图
7. **SEQ/ACK 展示** — 端点盒子底部显示当前序列号和确认号
8. **ACK 配色** — 从绿色改为琥珀金 `#f59e0b`
9. **移除协议栈面板** — 数据包详情面板扩展到全高
10. **详情面板增强** — 新增概要/IP/以太网/载荷分区

### 交互优化

1. **一键演示按钮** — 渐变色发光样式，自动完成握手→发数据→挥手全流程
2. **演示保护** — 演示中所有按钮禁用 (`fullFlowActive` 状态)
3. **自动选中** — 当前飞行数据包自动选中，右侧面板实时同步
4. **精准点击** — 通过 `networkPacketId` 精确匹配，解决 SYN/SYN-ACK 同号问题
5. **飞行中可点** — 移除 pointer-events 限制，飞行中数据包可点击

### Bug 修复

1. **容器尺寸保持** — `reset()` 保留当前 `containerSize`，避免重置后坐标计算错误
2. **闭包过期** — `performDataTransfer`/`performClose` 使用 `connectionRef` 获取最新连接
3. **演示前清空** — 一键演示先执行 reset + clearActivePackets
4. **状态徽章** — 按 TCP 状态类型着色（CLOSED/LISTEN/ESTABLISHED 等）

## 待完善功能

### 高优先级

1. **多包丢失（NewReno / SACK）** — 当前快重传只处理单个缺口，同一窗口内多个包丢失时其余仍要靠 RTO 恢复

### 中优先级

1. **HTTP 协议模拟器** — 握手后发送 HTTP GET，展示应用层
2. **多种关闭场景** — 同时关闭/服务器主动关闭/半关闭
3. **暂停/单步前进** — 配合教学使用

### 低优先级

1. **自定义数据载荷** — 用户输入要发送的数据
2. **网络延迟模拟** — 模拟 RTT 变化
3. **多连接支持** — 同时展示多个 TCP 连接
4. **通道粒子背景** — 流动网格/粒子，增强"网络传输"感

## 文件路径速查

| 功能 | 文件路径 |
|------|----------|
| 主页面 | `src/components/TcpProtocolVisualizer.tsx` |
| 动画逻辑 | `src/hooks/useTcpAnimation.ts` |
| 状态管理 | `src/store/slices/simulationSlice.ts` |
| 位置计算 | `src/utils/constants.ts` |
| 画布组件 | `src/components/Animation/NetworkCanvas.tsx` |
| 数据包组件 | `src/components/Animation/Packet.tsx` |
| 详情面板 | `src/components/Panels/PacketDetailPanel.tsx` |
| TCP服务 | `src/services/protocols/tcpService.ts` |
| 主题样式 | `src/styles/theme.ts` |
| 类型定义 | `src/types/networkTypes.ts` |
| 测试 | `src/store/slices/__tests__/simulationSlice.test.ts` |
| 测试 | `src/services/protocols/__tests__/tcpService.test.ts` |
| 拥塞控制页面 | `src/components/CongestionControl/CongestionVisualizer.tsx` |
| 拥塞控制动画 | `src/hooks/useCongestionControl.ts` |
| 拥塞控制状态 | `src/store/slices/congestionSlice.ts` |
| 拥塞算法 | `src/services/protocols/congestionService.ts` |
| 拥塞控制测试 | `src/services/protocols/__tests__/congestionService.test.ts` |
| 拥塞控制测试 | `src/store/slices/__tests__/congestionSlice.test.ts` |
| 丢包/重传/终止测试 | `src/hooks/__tests__/useCongestionControl.test.tsx` |

## 快速启动

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器 http://localhost:3000
npm run build        # 生产构建
npm test             # 运行测试 (50 tests)
npm run lint         # ESLint 检查
npm run test:coverage # 覆盖率（逻辑层门槛）
npm run verify:ui    # 需要先 npm start：截图验收布局与快重传
```
