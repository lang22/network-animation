# Network Protocol Animation 项目进展

> 本文档为 AI 助手提供上下文，用于快速恢复开发工作。
> 最后更新：2026-05-30

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
│   │   ├── PacketDetailPanel.tsx   # 数据包详情（概要/地址/IP/TCP/以太网/载荷）
│   │   ├── ProtocolStackPanel.tsx  # 协议栈面板（已废弃，不再使用）
│   │   ├── TcpStateDiagram.tsx     # TCP 状态机图组件（已不用于主面板）
│   │   └── TimelinePanel.tsx       # 时间线面板
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

1. **丢包 + 超时重传** — 模拟网络不可靠性，展示 TCP 可靠性机制
2. **拥塞控制可视化** — 慢启动/拥塞避免，窗口动态变化

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
| 状态机图 | `src/components/Panels/TcpStateDiagram.tsx` |
| TCP服务 | `src/services/protocols/tcpService.ts` |
| 主题样式 | `src/styles/theme.ts` |
| 类型定义 | `src/types/networkTypes.ts` |
| 测试 | `src/store/slices/__tests__/simulationSlice.test.ts` |
| 测试 | `src/services/protocols/__tests__/tcpService.test.ts` |

## 快速启动

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器 http://localhost:3000
npm run build        # 生产构建
npm test             # 运行测试 (32 tests)
```
