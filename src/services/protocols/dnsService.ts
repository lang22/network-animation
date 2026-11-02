// DNS 递归解析：节点布局 + 步骤脚本
import { FlowNode, FlowStep } from '@/types/flowTypes';

export type DnsRecordType = 'A' | 'AAAA';

export const DNS_NODES: FlowNode[] = [
  { id: 'client', label: '🌐 浏览器', detail: '发起查询', x: 10, y: 50, tone: 'client' },
  { id: 'resolver', label: '📡 本地 DNS', detail: 'ISP 递归解析器', x: 34, y: 50, tone: 'infra' },
  { id: 'root', label: '🌍 根服务器', detail: '13 组根', x: 68, y: 16, tone: 'server' },
  { id: 'tld', label: '🏷 .com 顶级域', detail: 'gtld-servers.net', x: 68, y: 50, tone: 'server' },
  { id: 'auth', label: '📚 权威服务器', detail: 'ns1.example.com', x: 68, y: 84, tone: 'server' },
];

export interface DnsAnswer {
  domain: string;
  type: DnsRecordType;
  value: string;
  ttl: number;
  authoritative: string;
}

const ANSWERS: Record<DnsRecordType, string> = {
  A: '93.184.216.34',
  AAAA: '2606:2800:220:1:248:1893:25c8:1946',
};

/** 构造一次递归解析的完整问答脚本 */
export function buildDnsLookup(domain: string, type: DnsRecordType = 'A'): {
  steps: FlowStep[];
  answer: DnsAnswer;
} {
  const value = ANSWERS[type];
  const answer: DnsAnswer = {
    domain,
    type,
    value,
    ttl: 3600,
    authoritative: 'ns1.example.com',
  };

  const steps: FlowStep[] = [
    {
      id: 'query',
      from: 'client',
      to: 'resolver',
      label: `查询 ${domain} ${type}`,
      detail: `浏览器把递归查询交给本地 DNS（8.8.8.8）`,
    },
    {
      id: 'ask-root',
      from: 'resolver',
      to: 'root',
      label: '问根：.com 的 NS',
      detail: '本地缓存未命中，从根服务器开始自上而下找',
    },
    {
      id: 'root-answer',
      from: 'root',
      to: 'resolver',
      label: '返回 .com NS',
      detail: 'a.gtld-servers.net、b.gtld-servers.net 等 13 组',
    },
    {
      id: 'ask-tld',
      from: 'resolver',
      to: 'tld',
      label: `问 .com：${domain} 的 NS`,
      detail: '顶级域服务器知道谁管理这个域名',
    },
    {
      id: 'tld-answer',
      from: 'tld',
      to: 'resolver',
      label: '返回 ns1.example.com',
      detail: '拿到域名的权威服务器地址',
    },
    {
      id: 'ask-auth',
      from: 'resolver',
      to: 'auth',
      label: `问权威：${domain} ${type}`,
      detail: '权威服务器持有这条记录的最终答案',
    },
    {
      id: 'auth-answer',
      from: 'auth',
      to: 'resolver',
      label: `返回 ${value}`,
      detail: `A/AAAA 记录 + TTL ${answer.ttl} 秒`,
    },
    {
      id: 'to-client',
      from: 'resolver',
      to: 'client',
      label: `返回 ${value}`,
      detail: '本地 DNS 按 TTL 缓存结果，下次查询直接命中',
    },
  ];

  return { steps, answer };
}
