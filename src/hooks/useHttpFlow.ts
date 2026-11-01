import { useCallback, useEffect, useRef, useState } from 'react';
import { HttpLogEntry, HttpMessage, HttpMethod, HttpPhase } from '@/types/httpTypes';
import {
  buildRequest,
  buildResponse,
  TLS_STEPS,
  DEFAULT_PATH,
} from '@/services/protocols/httpService';

const REQUEST_MS = 1600;
const PROCESS_MS = 900;
const RESPONSE_MS = 1600;
/** TLS 握手每步稍快一点，三步加起来别太久 */
const TLS_MS = 1200;

/**
 * HTTP 请求/响应动画。
 * 与拥塞控制页不同，这里只有一次请求/响应，用一个小状态机 + rAF 进度就够了，
 * 所以没有引入 Redux store。
 */
export function useHttpFlow(speed: number = 1) {
  const [phase, setPhase] = useState<HttpPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [request, setRequest] = useState<HttpMessage | null>(null);
  const [response, setResponse] = useState<HttpMessage | null>(null);
  const [log, setLog] = useState<HttpLogEntry[]>([]);
  const [isSending, setIsSending] = useState(false);

  const speedRef = useRef(speed);
  const tokenRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const timersRef = useRef<Set<() => void>>(new Set());
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);
  const logIdRef = useRef(0);

  useEffect(() => { speedRef.current = speed; }, [speed]);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(cancel => cancel());
    timersRef.current.clear();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      tokenRef.current += 1;
      cancelFrame();
      clearTimers();
    };
  }, [cancelFrame, clearTimers]);

  const appendLog = useCallback((text: string) => {
    logIdRef.current += 1;
    setLog(prev => [...prev.slice(-9), { id: logIdRef.current, text }]);
  }, []);

  /** 让进度从 0 走到 1；被重置/卸载时提前结束（不留悬挂的 await） */
  const fly = useCallback((duration: number, token: number) => new Promise<boolean>(resolve => {
    const start = performance.now();
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      timersRef.current.delete(cancel);
      resolve(result);
    };

    const cancel = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      finish(false);
    };

    const tick = () => {
      if (!mountedRef.current || token !== tokenRef.current) {
        finish(false);
        return;
      }
      const next = Math.min((performance.now() - start) / duration, 1);
      setProgress(next);
      if (next < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        finish(true);
      }
    };

    timersRef.current.add(cancel);
    frameRef.current = requestAnimationFrame(tick);
  }), []);

  /** 服务器处理耗时 */
  const wait = useCallback((ms: number, token: number) => new Promise<boolean>(resolve => {
    const cancel = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      timersRef.current.delete(cancel);
      resolve(token === tokenRef.current);
    }, ms);
    timersRef.current.add(cancel);
  }), []);

  const send = useCallback(async (
    method: HttpMethod = 'GET',
    path: string = DEFAULT_PATH,
    body: string = '',
    status: number = 200,
    secure: boolean = false,
  ) => {
    if (sendingRef.current) return;

    sendingRef.current = true;
    tokenRef.current += 1;
    const token = tokenRef.current;

    setIsSending(true);
    setLog([]);
    setProgress(0);
    setRequest(null);
    setResponse(null);

    // HTTPS：先走一遍 TLS 1.3 握手，之后才开始加密传输 HTTP 报文
    if (secure) {
      for (const step of TLS_STEPS) {
        setPhase(step.phase);
        setProgress(0);
        appendLog(`${step.label} · ${step.detail}`);
        if (!await fly(TLS_MS / speedRef.current, token) || token !== tokenRef.current) return;
      }
      appendLog('TLS 握手完成，开始加密传输');
    }

    const req = buildRequest(method, path, body);
    setRequest(req);
    setPhase('request');
    setProgress(0);
    appendLog(`${method} ${path} → 请求已发出${secure ? '（已加密）' : ''}`);

    if (!await fly(REQUEST_MS / speedRef.current, token) || token !== tokenRef.current) return;

    setPhase('processing');
    appendLog('服务器收到请求，正在生成响应');
    if (!await wait(PROCESS_MS / speedRef.current, token) || token !== tokenRef.current) return;

    const res = buildResponse(status);
    setResponse(res);
    setPhase('response');
    appendLog(`响应已发出：${res.startLine}`);

    if (!await fly(RESPONSE_MS / speedRef.current, token) || token !== tokenRef.current) return;

    setProgress(0);
    setPhase('done');
    setIsSending(false);
    sendingRef.current = false;
    appendLog('浏览器解析并渲染页面');
  }, [appendLog, fly, wait]);

  const reset = useCallback(() => {
    tokenRef.current += 1;
    sendingRef.current = false;
    cancelFrame();
    clearTimers();
    setPhase('idle');
    setProgress(0);
    setRequest(null);
    setResponse(null);
    setLog([]);
    setIsSending(false);
  }, [cancelFrame, clearTimers]);

  return { phase, progress, request, response, log, isSending, send, reset };
}
