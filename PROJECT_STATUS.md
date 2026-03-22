# Network Protocol Animation 项目进展

> 本文档为 AI 助手提供上下文，用于快速恢复开发工作。

## 项目概述

一个网络协议动画模拟器，使用 React + TypeScript + Redux + styled-components 构建。当前实现了 TCP 协议的三次握手、数据传输、四次挥手动画。

## 技术栈

- React 18 + TypeScript
- Redux Toolkit (状态管理)
- styled-components (样式)
- Webpack 5 (构建)
- Jest (测试)

## 当前完成的功能

### TCP 协议模拟器 (`/protocol/tcp`)

1. **三次握手动画** - SYN → SYN-ACK → ACK
2. **数据传输动画** - DATA → ACK
3. **四次挥手动画** - FIN → ACK → FIN → ACK
4. **时间线进度显示** - 顶部悬浮显示当前阶段
5. **协议栈面板** - 右侧显示活动协议层
6. **数据包详情面板** - 点击数据包显示详情

### 动画系统架构

```
src/
├── components/
│   ├── TcpProtocolVisualizer.tsx  # 主页面组件
│   └── Animation/
│       ├── NetworkCanvas.tsx       # 画布容器（客户端/服务端/通道）
│       └── Packet.tsx              # 数据包组件
├── hooks/
│   └── useTcpAnimation.ts          # 动画逻辑 Hook
├── store/slices/
│   └── simulationSlice.ts          # Redux 状态管理
├── services/protocols/
│   └── tcpService.ts               # TCP 协议逻辑
└── utils/
    └── constants.ts                # 常量和位置计算
```

### 数据包动画坐标系

```
┌─────────────┬────────────────────────────┬─────────────┐
│   客户端    │          通道区域           │   服务端    │
│   120px     │            1fr             │   120px     │
│             │                            │             │
│    ┌───┐    │  client_x            server_x    ┌───┐   │
│    │   │    │    │                    │        │   │   │
│    │   │    │    │  SYN ────────────► │        │   │   │
│    │   │    │    │                    │        │   │   │
│    │   │    │    │ ◄── SYN-ACK        │        │   │   │
│    │   │    │    │                    │        │   │   │
└────┴───┴────┴────────────────────────────────┴───┴───┘
```

- `client_x`: 通道左边界（数据包起始位置）
- `server_x`: 通道右边界（数据包终止位置）
- 数据包使用中心点定位，`transform: translate(-50%, -50%)`
- 从客户端发送：左边触 client_x，右边触 server_x
- 从服务端发送：右边触 server_x，左边触 client_x

## 最近修改

### 2024-XX-XX 动画系统重构

1. **多数据包支持** - 使用 `activePackets` 数组替代单一位置
2. **坐标系重构** - 引入基准线概念，数据包精确触碰边界
3. **布局优化** - CSS Grid 三列布局，客户端/服务端/通道
4. **背景色暗化** - 客户端/服务端盒子使用深色背景
5. **Webpack 排除测试文件** - 修复开发模式编译错误

### 关键文件修改

- `src/utils/constants.ts` - 新增 `calculateBoundaryLines()` 和 `calculatePacketPosition()`
- `src/store/slices/simulationSlice.ts` - `ActivePacket` 接口，支持多数据包
- `src/components/Animation/NetworkCanvas.tsx` - 三列布局，基准线显示
- `src/components/Animation/Packet.tsx` - 中心点定位，方向箭头
- `webpack.config.js` - 排除 `__tests__` 目录

## 待完善功能

### 高优先级

1. **数据包历史轨迹** - 在画布上保留已发送数据包的轨迹线
2. **状态机同步** - 客户端/服务端状态变化与数据包到达同步
3. **错误处理** - 模拟丢包、超时重传场景

### 中优先级

1. **HTTP 协议模拟器** - 参考 TCP 实现请求/响应动画
2. **速度控制优化** - 添加暂停/继续按钮
3. **数据包详情增强** - 显示完整的 TCP 头部信息

### 低优先级

1. **自定义数据载荷** - 用户输入要发送的数据
2. **网络延迟模拟** - 模拟 RTT 变化
3. **多连接支持** - 同时展示多个 TCP 连接

## 开发注意事项

1. **测试文件** - 由 Jest 处理，webpack/tsconfig 已排除
2. **缓存清理** - 如遇奇怪编译错误，删除 `node_modules/.cache`
3. **类型同步** - 修改 `simulationSlice.ts` 的接口时，同步更新测试文件

## 快速启动

```bash
npm run dev      # 开发服务器 http://localhost:3000
npm run build    # 生产构建
npm test         # 运行测试
```

## 文件路径速查

| 功能 | 文件路径 |
|------|----------|
| 主页面 | `src/components/TcpProtocolVisualizer.tsx` |
| 动画逻辑 | `src/hooks/useTcpAnimation.ts` |
| 状态管理 | `src/store/slices/simulationSlice.ts` |
| 位置计算 | `src/utils/constants.ts` |
| 画布组件 | `src/components/Animation/NetworkCanvas.tsx` |
| 数据包组件 | `src/components/Animation/Packet.tsx` |
| TCP服务 | `src/services/protocols/tcpService.ts` |
| 主题样式 | `src/styles/theme.ts` |