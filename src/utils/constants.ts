// 网络拓扑位置常量 - 使用百分比支持响应式
export const NETWORK_POSITIONS = {
    CLIENT: { xPercent: 15, yPercent: 35 },
    SERVER: { xPercent: 85, yPercent: 35 },
    // 不同阶段的 Y 坐标百分比
    HANDSHAKE_Y_PERCENT: 50,
    DATA_TRANSFER_Y_PERCENT: 60,
    CLOSE_Y_PERCENT: 70,
} as const;

// 数据包类型 - 与 theme.ts 保持一致
export const PACKET_TYPES = {
    SYN: 'SYN',
    SYN_ACK: 'SYN-ACK',
    ACK: 'ACK',
    DATA: 'DATA',
    FIN: 'FIN',
} as const;

// 从 theme.ts 导出 PacketType
export type PacketType = 'SYN' | 'SYN-ACK' | 'ACK' | 'DATA' | 'FIN';

// 数据包颜色映射
export const PACKET_COLORS: Record<PacketType, string> = {
    [PACKET_TYPES.SYN]: '#F44336',
    [PACKET_TYPES.SYN_ACK]: '#FF9800',
    [PACKET_TYPES.ACK]: '#4CAF50',
    [PACKET_TYPES.DATA]: '#2196F3',
    [PACKET_TYPES.FIN]: '#9C27B0',
};

// 动画持续时间（毫秒）
export const ANIMATION_DURATION = {
    PACKET_MOVE: 1000,
    STATE_TRANSITION: 300,
    CLEANUP_DELAY: 2000,
} as const;

// 默认网络配置
export const DEFAULT_NETWORK_CONFIG = {
    CLIENT_IP: '192.168.1.10',
    SERVER_IP: '192.168.1.20',
    CLIENT_PORT: 54321,
    SERVER_PORT: 80,
    WINDOW_SIZE: 65535,
} as const;

// 计算实际像素位置的辅助函数
export const calculatePosition = (
    xPercent: number,
    yPercent: number,
    containerWidth: number,
    containerHeight: number
): { x: number; y: number } => ({
    x: (containerWidth * xPercent) / 100,
    y: (containerHeight * yPercent) / 100,
});