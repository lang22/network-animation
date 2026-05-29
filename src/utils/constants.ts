// 网络拓扑位置常量
// 数据包在中间通道区域移动
export const NETWORK_POSITIONS = {
    // 不同数据包的轨道Y位置（百分比）
    TRACKS: {
        // 握手轨道 — 通道上部
        SYN: 14,
        SYN_ACK: 28,
        HANDSHAKE_ACK: 42,
        // 数据传输轨道 — 通道中部
        DATA: 56,
        DATA_ACK: 70,
        // 四次挥手轨道 — 通道中下部（避开握手轨道）
        FIN1: 50,
        FIN1_ACK: 60,
        FIN2: 70,
        FIN2_ACK: 80,
    }
} as const;

// 从 theme.ts 重新导出 PacketType，统一类型来源
export type { PacketType } from '@/styles/theme';

// 动画持续时间（毫秒）
export const ANIMATION_DURATION = {
    PACKET_MOVE: 3000,      // 基准动画时间，1x速度下3秒
    STATE_TRANSITION: 300,
    CLEANUP_DELAY: 1000,
    PACKET_DISPLAY: 600,    // 数据包到达后停留+消失动画时间
} as const;

// 默认网络配置
export const DEFAULT_NETWORK_CONFIG = {
    CLIENT_IP: '192.168.1.10',
    SERVER_IP: '192.168.1.20',
    CLIENT_PORT: 54321,
    SERVER_PORT: 80,
    WINDOW_SIZE: 65535,
} as const;

// 数据包尺寸
export const PACKET_SIZE = {
    WIDTH: 80,
    HEIGHT: 40,
} as const;

// 画布布局参数
export const CANVAS_LAYOUT = {
    ENDPOINT_WIDTH: 120,   // 客户端/服务端盒子宽度
    GAP: 8,                // 盒子与通道之间的gap
    OUTER_PADDING: 16,     // 画布外边距
} as const;

// 计算画布中的基准线坐标
// 返回 client_x（客户端边界）和 server_x（服务端边界）
export const calculateBoundaryLines = (
    containerWidth: number
): { clientX: number; serverX: number; channelTop: number; channelHeight: number } => {
    const { ENDPOINT_WIDTH, GAP, OUTER_PADDING } = CANVAS_LAYOUT;

    // client_x: 客户端盒子右边缘 + gap，即通道左边界
    const clientX = OUTER_PADDING + ENDPOINT_WIDTH + GAP;

    // server_x: 服务端盒子左边缘 - gap，即通道右边界
    const serverX = containerWidth - OUTER_PADDING - ENDPOINT_WIDTH - GAP;

    // 通道的上下边界
    const channelTop = OUTER_PADDING;
    const channelHeight = containerWidth > 0 ? containerWidth : 600; // 使用一个合理的默认值

    return { clientX, serverX, channelTop, channelHeight };
};

// 计算数据包位置
// fromClient: true 表示从客户端发送，数据包从客户端盒子出发，到达服务端盒子
// fromClient: false 表示从服务端发送，数据包从服务端盒子出发，到达客户端盒子
// progress: 0-1 动画进度
export const calculatePacketPosition = (
    fromClient: boolean,
    trackYPercent: number,
    progress: number,
    containerWidth: number,
    containerHeight: number
): { x: number; y: number } => {
    const { WIDTH } = PACKET_SIZE;
    const { OUTER_PADDING, ENDPOINT_WIDTH } = CANVAS_LAYOUT;

    // 端点盒子的实际边缘（不含gap，数据包应该触碰这些边缘）
    const clientBoxRight = OUTER_PADDING + ENDPOINT_WIDTH;   // 客户端盒子右边缘
    const serverBoxLeft = containerWidth - OUTER_PADDING - ENDPOINT_WIDTH; // 服务端盒子左边缘

    // 计算通道高度
    const channelHeight = containerHeight - OUTER_PADDING * 2;

    // Y坐标：基于轨道百分比
    const y = OUTER_PADDING + (channelHeight * trackYPercent) / 100;

    // X坐标计算：数据包使用中心点定位 (transform: translate(-50%, -50%))
    if (fromClient) {
        // 从客户端发送到服务端
        // 起始(progress=0)：左边缘贴合客户端盒子右边缘，中心在 clientBoxRight + WIDTH/2
        // 结束(progress=1)：右边缘贴合服务端盒子左边缘，中心在 serverBoxLeft - WIDTH/2
        const startX = clientBoxRight + WIDTH / 2;
        const endX = serverBoxLeft - WIDTH / 2;
        const x = startX + (endX - startX) * progress;
        return { x, y };
    } else {
        // 从服务端发送到客户端
        // 起始(progress=0)：右边缘贴合服务端盒子左边缘，中心在 serverBoxLeft - WIDTH/2
        // 结束(progress=1)：左边缘贴合客户端盒子右边缘，中心在 clientBoxRight + WIDTH/2
        const startX = serverBoxLeft - WIDTH / 2;
        const endX = clientBoxRight + WIDTH / 2;
        const x = startX + (endX - startX) * progress;
        return { x, y };
    }
};