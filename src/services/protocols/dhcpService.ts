// DHCP（DORA）租约分配：节点布局 + 步骤脚本
import { FlowNode, FlowStep } from '@/types/flowTypes';

export const DHCP_NODES: FlowNode[] = [
  { id: 'client', label: '💻 客户端', detail: '刚接入网络', x: 20, y: 50, tone: 'client' },
  { id: 'server', label: '🛰 DHCP 服务器', detail: '192.168.1.1', x: 80, y: 50, tone: 'server' },
];

export interface DhcpLease {
  ip: string;
  mask: string;
  gateway: string;
  dns: string;
  leaseHours: number;
}

export const DHCP_LEASE: DhcpLease = {
  ip: '192.168.1.100',
  mask: '255.255.255.0',
  gateway: '192.168.1.1',
  dns: '8.8.8.8',
  leaseHours: 24,
};

/** DORA 四步脚本：Discover / Offer / Request / ACK */
export function buildDhcpExchange(): FlowStep[] {
  const lease = DHCP_LEASE;

  return [
    {
      id: 'discover',
      from: 'client',
      to: 'server',
      label: 'DHCP Discover（广播）',
      detail: '客户端还没有 IP，向 255.255.255.255 广播寻找服务器',
    },
    {
      id: 'offer',
      from: 'server',
      to: 'client',
      label: 'DHCP Offer',
      detail: `服务器提供一个可用地址 ${lease.ip}/${lease.mask}`,
    },
    {
      id: 'request',
      from: 'client',
      to: 'server',
      label: 'DHCP Request（广播）',
      detail: `客户端正式请求 ${lease.ip}，同时告知其他服务器已选定`,
    },
    {
      id: 'ack',
      from: 'server',
      to: 'client',
      label: 'DHCP ACK',
      detail: `确认租约：网关 ${lease.gateway}、DNS ${lease.dns}、租期 ${lease.leaseHours} 小时`,
    },
  ];
}

/** 四个阶段对应的状态机 */
export const DHCP_STATES = ['INIT', 'SELECTING', 'REQUESTING', 'BOUND'] as const;

export function dhcpStateAt(stepIndex: number): string {
  if (stepIndex < 0) return DHCP_STATES[0];
  return DHCP_STATES[Math.min(stepIndex, DHCP_STATES.length - 1)];
}
