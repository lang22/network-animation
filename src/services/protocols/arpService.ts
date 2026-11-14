// ARP：局域网内把 IP 解析成 MAC
import { FlowNode, FlowStep } from '@/types/flowTypes';

export const BROADCAST_MAC = 'FF:FF:FF:FF:FF:FF';

export interface ArpHost {
  id: string;
  name: string;
  ip: string;
  mac: string;
}

export const ARP_HOSTS_INFO: ArpHost[] = [
  { id: 'a', name: '主机 A', ip: '192.168.1.10', mac: 'aa:bb:cc:00:00:01' },
  { id: 'b', name: '主机 B', ip: '192.168.1.20', mac: 'aa:bb:cc:00:00:02' },
  { id: 'c', name: '主机 C', ip: '192.168.1.30', mac: 'aa:bb:cc:00:00:03' },
];

export const ARP_NODES: FlowNode[] = [
  {
    id: 'a', label: '💻 主机 A', detail: '192.168.1.10\naa:bb:cc:00:00:01', x: 12, y: 50, tone: 'client',
  },
  {
    id: 'b', label: '💻 主机 B', detail: '192.168.1.20\naa:bb:cc:00:00:02', x: 55, y: 20, tone: 'server',
  },
  {
    id: 'c', label: '💻 主机 C', detail: '192.168.1.30\naa:bb:cc:00:00:03', x: 55, y: 80, tone: 'server',
  },
];

export interface ArpResult {
  requesterIp: string;
  requesterMac: string;
  targetIp: string;
  targetMac: string;
  ttlSeconds: number;
  broadcastMac: string;
}

export type ArpTargetId = 'b' | 'c';

/** 构造一次「广播询问 → 单播应答 → 发数据帧」的 ARP 流程 */
export function buildArpExchange(targetId: ArpTargetId): {
  steps: FlowStep[];
  result: ArpResult;
} {
  const requester = ARP_HOSTS_INFO[0];
  const target = ARP_HOSTS_INFO.find(host => host.id === targetId) ?? ARP_HOSTS_INFO[1];
  const other = ARP_HOSTS_INFO.find(host => host.id !== requester.id && host.id !== target.id);

  const result: ArpResult = {
    requesterIp: requester.ip,
    requesterMac: requester.mac,
    targetIp: target.ip,
    targetMac: target.mac,
    ttlSeconds: 60,
    broadcastMac: BROADCAST_MAC,
  };

  const steps: FlowStep[] = [
    {
      id: 'broadcast',
      from: requester.id,
      // 广播：局域网内所有主机都会收到
      to: [target.id, ...(other ? [other.id] : [])],
      label: 'ARP Request（广播）',
      detail: `谁有 ${target.ip}？告诉 ${requester.ip} —— 目标 MAC 是 ${BROADCAST_MAC}，同一广播域内所有主机都会收到`,
    },
    {
      id: 'reply',
      from: target.id,
      to: requester.id,
      label: 'ARP Reply',
      detail: `${target.ip} 是 ${target.mac} —— 只有被问的那台主机单播回复，其他主机看到目标 IP 不是自己就丢弃`,
    },
    {
      id: 'frame',
      from: requester.id,
      to: target.id,
      label: `IP 包 → ${target.mac}`,
      detail: `A 把 ${target.ip} ↔ ${target.mac} 写入 ARP 缓存（TTL ${result.ttlSeconds}s），之后直接按这个 MAC 封装以太网帧`,
    },
  ];

  return { steps, result };
}
