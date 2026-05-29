// 深色科技风主题配置
export const darkTheme = {
  colors: {
    // 背景色
    background: '#0a0e17',
    surface: '#141b2d',
    surfaceLight: '#1e2742',
    surfaceHover: '#252f47',

    // 主色调
    primary: '#00d4ff',
    primaryLight: '#38bdf8',
    primaryDark: '#0891b2',

    // 辅助色
    secondary: '#7c3aed',
    secondaryLight: '#8b5cf6',

    // 状态色
    accent: '#f97316',
    success: '#22c55e',
    warning: '#eab308',
    error: '#ef4444',

    // 文字
    text: '#e2e8f0',
    textMuted: '#64748b',
    textLight: '#94a3b8',

    // 边框
    border: '#2d3748',
    borderLight: '#374151',

    // 发光效果
    glow: 'rgba(0, 212, 255, 0.5)',
    glowStrong: 'rgba(0, 212, 255, 0.8)',
  },

  // 数据包颜色配置
  packetColors: {
    SYN: {
      from: '#f97316',
      to: '#fb923c',
      glow: 'rgba(249, 115, 22, 0.6)',
      text: '#fff',
    },
    'SYN-ACK': {
      from: '#8b5cf6',
      to: '#a78bfa',
      glow: 'rgba(139, 92, 246, 0.6)',
      text: '#fff',
    },
    ACK: {
      from: '#f59e0b',
      to: '#fbbf24',
      glow: 'rgba(245, 158, 11, 0.6)',
      text: '#000',
    },
    DATA: {
      from: '#00d4ff',
      to: '#38bdf8',
      glow: 'rgba(0, 212, 255, 0.6)',
      text: '#fff',
    },
    FIN: {
      from: '#ef4444',
      to: '#f87171',
      glow: 'rgba(239, 68, 68, 0.6)',
      text: '#fff',
    },
  },

  // 节点颜色 - 深色系，确保文字清晰可见
  nodeColors: {
    client: {
      from: '#166534',
      to: '#14532d',
      glow: 'rgba(34, 197, 94, 0.5)',
    },
    server: {
      from: '#1e40af',
      to: '#1e3a8a',
      glow: 'rgba(59, 130, 246, 0.5)',
    },
  },

  // 动画配置
  animation: {
    packetDuration: 1000,
    transitionDuration: 300,
    glowPulse: '2s',
  },

  // 阴影
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
    glow: '0 0 20px rgba(0, 212, 255, 0.3)',
    glowStrong: '0 0 30px rgba(0, 212, 255, 0.5)',
  },

  // 边框半径
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
};

export type Theme = typeof darkTheme;
export type PacketType = keyof typeof darkTheme.packetColors;