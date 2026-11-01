// HTTP 协议逻辑：构造请求/响应报文并格式化
import { HttpMessage, HttpMethod, TlsStep } from '@/types/httpTypes';

const HOST = 'example.com';

/** TLS 1.3 简化握手的三条消息（ServerHello/证书/CertificateVerify/Finished 合成一条） */
export const TLS_STEPS: TlsStep[] = [
  {
    label: 'ClientHello',
    direction: 'to-server',
    detail: 'TLS 1.3 · 密码套件列表 · SNI=example.com · key_share',
  },
  {
    label: 'ServerHello + 证书',
    direction: 'to-client',
    detail: '选定密码套件 · 服务器证书 · CertificateVerify · Finished',
  },
  {
    label: 'Finished',
    direction: 'to-server',
    detail: '客户端校验证书后发送 Finished，握手完成，之后的数据全程加密',
  },
];

/** 除了用户填的路径，额外抓取的两个资源（用来演示串行 vs 多路复用） */
export const EXTRA_RESOURCES = ['/style.css', '/app.js'];

/** 一次请求涉及哪些资源：GET 抓三个资源，POST 只有一个 */
export function resourcesFor(path: string, method: HttpMethod): string[] {
  return method === 'POST' ? [path] : [path, ...EXTRA_RESOURCES];
}

/** UTF-8 字节长度（不依赖 TextEncoder，jsdom 环境里没有它） */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/** 构造一个 HTTP/1.1 请求 */
export function buildRequest(
  method: HttpMethod,
  path: string,
  body: string = '',
): HttpMessage {
  const headers: Array<[string, string]> = [
    ['Host', HOST],
    ['User-Agent', 'NetworkAnimation/1.0'],
    ['Accept', 'text/html,application/xhtml+xml'],
    ['Connection', 'keep-alive'],
  ];

  if (method === 'POST') {
    headers.push(['Content-Type', 'application/x-www-form-urlencoded']);
    headers.push(['Content-Length', String(utf8Length(body))]);
  }

  return {
    startLine: `${method} ${path} HTTP/1.1`,
    headers,
    body: method === 'POST' ? body : '',
  };
}

/** 构造一个 HTTP/1.1 响应；正文不传时按状态码给默认页 */
export function buildResponse(status: number = 200, body?: string): HttpMessage {
  const content = body ?? defaultBodyFor(status);
  const bodyBytes = utf8Length(content);

  return {
    startLine: `HTTP/1.1 ${status} ${reasonPhrase(status)}`,
    headers: [
      ['Date', 'Wed, 01 Nov 2026 00:00:00 GMT'],
      ['Server', 'nginx/1.25.3'],
      ['Content-Type', 'text/html; charset=utf-8'],
      ['Content-Length', String(bodyBytes)],
      ['Connection', 'keep-alive'],
    ],
    body: content,
  };
}

/** 各状态码的示例正文 */
export function defaultBodyFor(status: number): string {
  if (status === 404) {
    return '<!DOCTYPE html>\n<html>\n  <head><title>404</title></head>\n  <body><h1>404 Not Found</h1><p>请求的资源不存在</p></body>\n</html>';
  }
  if (status === 500) {
    return '<!DOCTYPE html>\n<html>\n  <head><title>500</title></head>\n  <body><h1>500 Internal Server Error</h1><p>服务器处理请求时出错</p></body>\n</html>';
  }
  return DEFAULT_BODY;
}

/** 状态码对应的原因短语 */
export function reasonPhrase(status: number): string {
  if (status === 200) return 'OK';
  if (status === 404) return 'Not Found';
  if (status === 500) return 'Internal Server Error';
  return 'Unknown';
}

/** 格式化成可以直接展示的原始 HTTP 文本 */
export function formatMessage(message: HttpMessage): string {
  const head = [message.startLine, ...message.headers.map(([name, value]) => `${name}: ${value}`)];
  return message.body ? `${head.join('\n')}\n\n${message.body}` : head.join('\n');
}

export const DEFAULT_PATH = '/index.html';
export const DEFAULT_BODY = '<!DOCTYPE html>\n<html>\n  <head><title>Hello HTTP</title></head>\n  <body><h1>Hello, HTTP!</h1></body>\n</html>';
