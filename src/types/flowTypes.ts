// DNS / DHCP 共用的「节点 + 消息步骤」模型

export interface FlowNode {
  id: string;
  label: string;
  detail?: string;
  /** 节点中心点位置（百分比） */
  x: number;
  y: number;
  tone: 'client' | 'server' | 'infra';
}

export interface FlowStep {
  id: string;
  from: string;
  to: string;
  /** 画布上飞行的包标题 */
  label: string;
  /** 右侧日志里的详细说明 */
  detail: string;
}

export interface FlowLogEntry {
  id: number;
  text: string;
}

export type FlowStatus = 'idle' | 'playing' | 'done';

/** 正在飞行的消息 */
export interface FlowPacket {
  step: FlowStep;
  progress: number;
}
