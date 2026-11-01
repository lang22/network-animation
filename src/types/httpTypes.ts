// HTTP 协议模拟相关类型

export type HttpMethod = 'GET' | 'POST';

/** 一条 HTTP 报文：起始行 + 头部 + 正文 */
export interface HttpMessage {
  startLine: string;
  headers: Array<[string, string]>;
  body: string;
}

/** 请求/响应流程所处阶段（TLS 三阶段是 HTTPS 才有的前置握手） */
export type HttpPhase =
  | 'idle'
  | 'client-hello'
  | 'server-hello'
  | 'client-finished'
  | 'request'
  | 'processing'
  | 'response'
  | 'done';

/** TLS 1.3 简化握手的每一步 */
export interface TlsStep {
  phase: Extract<HttpPhase, 'client-hello' | 'server-hello' | 'client-finished'>;
  label: string;
  direction: 'to-server' | 'to-client';
  detail: string;
}

export interface HttpLogEntry {
  id: number;
  text: string;
}
