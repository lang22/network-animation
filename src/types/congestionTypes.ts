// TCP 拥塞控制相关类型定义

/** 拥塞控制阶段 */
export enum CongestionPhase {
  SLOW_START = 'slow_start',
  CONGESTION_AVOIDANCE = 'congestion_avoidance',
  FAST_RECOVERY = 'fast_recovery',
  TIMEOUT = 'timeout',
}

/** 场景模式 */
export enum ScenarioMode {
  SLOW_START = 'slow_start',
  CONGESTION_AVOIDANCE = 'congestion_avoidance',
  FULL_DEMO = 'full_demo',
}

/** 飞行中的小球 */
export interface FlightBall {
  id: string;
  /** 0-1 飞行进度 */
  progress: number;
  /** 轨道Y百分比 */
  trackY: number;
  /** 是否ACK回程 */
  isAck: boolean;
  /** 是否已丢包 */
  isLost: boolean;
  /** 序列号 */
  seqNum: number;
  /** 动画开始时间 */
  startTime: number;
  /** 飞行时长 ms */
  duration: number;
  attempt?: number;
  isRetransmission?: boolean;
}

export type PacketLifecycleStatus =
  | 'created'
  | 'flying'
  | 'lost'
  | 'waiting_timeout'
  | 'retransmitting'
  | 'acked';

export interface InFlightPacket {
  seqNum: number;
  ballId: string;
  sentAt: number;
  rtoAt: number;
  attempt: number;
  status: PacketLifecycleStatus;
}

export interface RetransmissionItem {
  seqNum: number;
  attempt: number;
  originalBallId: string;
}

/** 发送窗口状态 */
export interface SenderWindowState {
  /** 拥塞窗口 MSS数 */
  cwnd: number;
  /** 慢启动阈值 */
  ssthresh: number;
  /** 已确认的最高序列号 */
  lastAcked: number;
  /** 下一个要发送的序列号 */
  nextSeq: number;
  /** 当前可发送的包数 */
  allowedToSend: number;
}

/** 窗口历史记录点 */
export interface CwndRecord {
  time: number;
  cwnd: number;
  ssthresh: number;
}

/** 拥塞控制动画状态 */
export interface CongestionUIState {
  senderActive: boolean;
  receiverActive: boolean;
  flightBalls: FlightBall[];
  containerSize: { width: number; height: number };
}

export interface LogEntry {
  id: number;
  text: string;
  type: 'info' | 'success' | 'error' | 'rtt' | 'timeout' | 'retransmit';
}

export interface RtoConfig {
  baseMs: number;
  maxRetransmissions: number;
}

export interface LossDecisionConfig {
  enabled: boolean;
  lossRate: number;
  dropNextSeq: number | null;
}

export interface CongestionState {
  isPlaying: boolean;
  scenario: ScenarioMode;
  phase: CongestionPhase;
  window: SenderWindowState;
  flightBalls: FlightBall[];
  cwndHistory: CwndRecord[];
  rttCount: number;
  lostPackets: number;
  ackedPackets: number;
  packetLossEnabled: boolean;
  inFlightPackets: InFlightPacket[];
  retransmissionQueue: RetransmissionItem[];
  rtoConfig: RtoConfig;
  lossRate: number;
  dropNextSeq: number | null;
  timeoutCount: number;
  retransmissionCount: number;
  animationStatus: string;
  eventLog: LogEntry[];
  logSeq: number;
}
