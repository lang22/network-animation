# Network Protocol Simulator 🌐

一个交互式的网络协议动画模拟器，帮助理解 TCP/IP 协议的工作原理。

## ✨ 功能特性

- **TCP 三次握手动画** - 可视化 SYN、SYN-ACK、ACK 握手过程
- **TCP 四次挥手动画** - 展示 FIN、ACK 关闭连接过程
- **TCP 拥塞控制动画** - 滑动窗口、慢启动、拥塞避免，cwnd 曲线实时变化
- **丢包与超时重传** - 丢包率调节、指定丢包序号，RTO 超时后窗口降级并重传
- **重复 ACK 与快重传** - 接收端回累计/重复 ACK，3 个重复 ACK 触发快重传并进入快速恢复
- **数据传输模拟** - 演示数据包发送与确认机制
- **深色科技风 UI** - 现代化的霓虹风格界面
- **协议栈可视化** - 展示各协议层的激活状态
- **数据包详情面板** - 查看 TCP 头部详细信息
- **时间线进度指示** - 实时显示协议流程进度
- **动画速度控制** - 支持 0.5x、1x、2x 速度调节

## 🚀 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm start
```

访问 http://localhost:3000 查看应用。

### 构建生产版本

```bash
npm run build
```

### 运行测试

```bash
npm test
```

### 界面验收（可选）

需要先启动 `npm start`，再用本机 Edge/Chrome 截图检查布局与交互：

```bash
npm run verify:ui
```

截图输出在 `artifacts/ui/`。

## 📁 项目结构

```
src/
├── components/
│   ├── Animation/          # 动画组件
│   │   ├── NetworkCanvas.tsx
│   │   └── Packet.tsx
│   ├── Layout/             # 布局组件
│   │   └── Header.tsx
│   ├── Panels/             # 面板组件
│   │   ├── PacketDetailPanel.tsx
│   │   ├── ProtocolStackPanel.tsx
│   │   └── TimelinePanel.tsx
│   └── TcpProtocolVisualizer.tsx
├── containers/             # 页面容器
│   ├── Home.tsx
│   └── Simulation.tsx
├── hooks/                  # 自定义 Hooks
│   └── useTcpAnimation.ts
├── services/               # 服务层
│   └── protocols/
│       └── tcpService.ts
├── store/                  # Redux 状态管理
│   ├── index.ts
│   └── slices/
│       └── simulationSlice.ts
├── styles/                 # 主题样式
│   └── theme.ts
├── types/                  # TypeScript 类型定义
│   └── networkTypes.ts
└── utils/                  # 工具函数
    └── constants.ts
```

## 🛠️ 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Redux Toolkit** - 状态管理
- **Styled-components** - CSS-in-JS 样式方案
- **Webpack** - 模块打包
- **Jest** - 单元测试

## 📖 使用说明

页面路由：

- `/protocol/tcp` — 握手 / 数据传输 / 挥手
- `/protocol/congestion` — 拥塞控制与丢包重传

1. 打开应用后，点击 **"三次握手"** 按钮开始 TCP 连接建立动画
2. 握手完成后，点击 **"发送数据"** 进行数据传输演示
3. 点击 **"四次挥手"** 关闭连接
4. 点击 **"重置"** 清除状态，重新开始

### 交互功能

- 点击飞行的数据包可查看详细信息
- 使用速度控制调整动画播放速度
- 右侧面板显示协议栈状态和数据包详情

## 🎨 UI 预览

界面采用深色科技风格设计：
- 深蓝黑背景 (`#0a0e17`)
- 霓虹青色主色调 (`#00d4ff`)
- 发光效果和渐变装饰

## 📝 开发计划

- [ ] HTTP 协议模拟
- [ ] DNS 协议模拟
- [ ] DHCP 协议模拟
- [ ] 数据包捕获与回放
- [ ] 自定义网络拓扑

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！