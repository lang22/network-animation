// HTTP 协议模拟相关类型

export type HttpMethod = 'GET' | 'POST';

/** 一条 HTTP 报文：起始行 + 头部 + 正文 */
export interface HttpMessage {
  startLine: string;
  headers: Array<[string, string]>;
  body: string;
}

/** 请求/响应流程所处阶段 */
export type HttpPhase = 'idle' | 'request' | 'processing' | 'response' | 'done';

export interface HttpLogEntry {
  id: number;
  text: string;
}
