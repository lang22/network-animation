// HTTP 协议模拟相关类型

export type HttpMethod = 'GET' | 'POST';

/** HTTP 版本：HTTP/1.1 串行 vs HTTP/2 多路复用 */
export type HttpVersion = 'http1' | 'http2';

/** 一条 HTTP 报文：起始行 + 头部 + 正文 */
export interface HttpMessage {
  startLine: string;
  headers: Array<[string, string]>;
  body: string;
}

/** 整体流程阶段 */
export type HttpPhase = 'idle' | 'tls' | 'transfer' | 'done';

/** 单个请求（HTTP/2 下就是一条 stream）的状态 */
export type StreamStatus = 'pending' | 'requesting' | 'processing' | 'responding' | 'done';

export interface HttpStream {
  id: number;
  path: string;
  status: StreamStatus;
  responseStatus?: number;
}

/** 画布上正在飞的数据包 */
export interface HttpFlight {
  id: string;
  kind: 'tls' | 'request' | 'response';
  label: string;
  streamId?: number;
  direction: 'to-server' | 'to-client';
  progress: number;
}

/** TLS 1.3 简化握手的每一步 */
export interface TlsStep {
  label: string;
  direction: 'to-server' | 'to-client';
  detail: string;
}

export interface HttpLogEntry {
  id: number;
  text: string;
}
