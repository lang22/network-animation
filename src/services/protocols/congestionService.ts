// TCP 拥塞控制算法服务
import { CongestionPhase, LossDecisionConfig, SenderWindowState } from '@/types/congestionTypes';

const INITIAL_CWND = 1;      // MSS
const INITIAL_SSTHRESH = 64; // MSS
const MAX_CWND = 128;

/** 创建初始窗口状态 */
export function createWindow(): SenderWindowState {
  return {
    cwnd: INITIAL_CWND,
    ssthresh: INITIAL_SSTHRESH,
    lastAcked: 0,
    nextSeq: 1,
    allowedToSend: INITIAL_CWND,
  };
}

/** 慢启动：每RTT窗口翻倍 */
export function slowStartGrowth(window: SenderWindowState): SenderWindowState {
  const newCwnd = Math.min(window.cwnd * 2, window.ssthresh, MAX_CWND);
  const phase = newCwnd >= window.ssthresh
    ? CongestionPhase.CONGESTION_AVOIDANCE
    : CongestionPhase.SLOW_START;
  return {
    ...window,
    cwnd: newCwnd,
    allowedToSend: newCwnd,
  };
}

/** 拥塞避免：每RTT窗口+1 */
export function congestionAvoidanceGrowth(window: SenderWindowState): SenderWindowState {
  const newCwnd = Math.min(window.cwnd + 1, MAX_CWND);
  return {
    ...window,
    cwnd: newCwnd,
    allowedToSend: newCwnd,
  };
}

/** 根据当前阶段增长窗口 */
export function growWindow(window: SenderWindowState, phase: CongestionPhase): {
  window: SenderWindowState;
  phase: CongestionPhase;
} {
  if (phase === CongestionPhase.SLOW_START) {
    const result = slowStartGrowth(window);
    return { window: result, phase: result.cwnd >= window.ssthresh ? CongestionPhase.CONGESTION_AVOIDANCE : CongestionPhase.SLOW_START };
  }
  // 拥塞避免
  return {
    window: congestionAvoidanceGrowth(window),
    phase: CongestionPhase.CONGESTION_AVOIDANCE,
  };
}

/** 丢包处理：窗口减半 + 阈值更新 */
export function handlePacketLoss(window: SenderWindowState): {
  window: SenderWindowState;
  phase: CongestionPhase;
} {
  const newSsthresh = Math.max(window.cwnd / 2, 2);
  const newCwnd = Math.max(Math.floor(window.cwnd / 2), 1);
  return {
    window: {
      ...window,
      cwnd: newCwnd,
      ssthresh: newSsthresh,
      allowedToSend: newCwnd,
    },
    phase: CongestionPhase.FAST_RECOVERY,
  };
}

export function handleTimeoutLoss(window: SenderWindowState): {
  window: SenderWindowState;
  phase: CongestionPhase;
} {
  const newSsthresh = Math.max(Math.floor(window.cwnd / 2), 2);

  return {
    window: {
      ...window,
      cwnd: INITIAL_CWND,
      ssthresh: newSsthresh,
      allowedToSend: INITIAL_CWND,
    },
    phase: CongestionPhase.SLOW_START,
  };
}

export function canRetransmit(attempt: number, maxRetransmissions: number): boolean {
  return attempt < maxRetransmissions;
}

/** 确认包到达后更新窗口 */
export function acknowledgePacket(window: SenderWindowState, ackSeq: number): SenderWindowState {
  return {
    ...window,
    lastAcked: Math.max(window.lastAcked, ackSeq),
    allowedToSend: Math.max(0, window.allowedToSend - 1),
  };
}

/** 准备下一批发送：重置 allowedToSend */
export function prepareNextBatch(window: SenderWindowState): SenderWindowState {
  return {
    ...window,
    allowedToSend: window.cwnd,
  };
}

/** 检查是否应该丢包（5%概率） */
export function shouldDropPacket(
  config: LossDecisionConfig | boolean,
  seqNum?: number,
  randomValue: number = Math.random()
): boolean {
  if (typeof config === 'boolean') {
    if (!config) return false;
    return randomValue < 0.05;
  }

  if (!config.enabled) return false;
  if (config.dropNextSeq !== null && config.dropNextSeq === seqNum) return true;
  return randomValue < config.lossRate;
}

export { INITIAL_CWND, INITIAL_SSTHRESH, MAX_CWND };
