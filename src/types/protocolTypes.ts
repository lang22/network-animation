// 协议相关类型定义

import { NetworkPacket, TcpConnection } from './networkTypes';

// 协议基础接口
export interface Protocol {
  id: string;
  name: string;
  fullName: string;
  description: string;
  layer: 'application' | 'transport' | 'network' | 'link';
}

// 协议状态
export interface ProtocolState {
  id: string;
  name: string;
  description: string;
}

// TCP 协议配置
export interface TcpProtocolConfig {
  sourceIp: string;
  destinationIp: string;
  sourcePort: number;
  destinationPort: number;
}

// 动画步骤类型
export type AnimationStepType = 'packet_move' | 'packet_create' | 'packet_destroy' | 'state_change' | 'highlight';

// 动画步骤
export interface AnimationStep {
  id: string;
  type: AnimationStepType;
  packet?: NetworkPacket;
  connection?: TcpConnection;
  sourcePosition?: { x: number; y: number };
  targetPosition?: { x: number; y: number };
  duration?: number;
  description: string;
  layer?: 'application' | 'transport' | 'network' | 'link';
}

// 协议信息
export interface ProtocolInfo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  purpose?: string;
  features: string[];
  workflow?: string[];
}