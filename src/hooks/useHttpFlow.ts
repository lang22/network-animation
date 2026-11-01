import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HttpFlight,
  HttpLogEntry,
  HttpMessage,
  HttpMethod,
  HttpPhase,
  HttpStream,
  HttpVersion,
} from '@/types/httpTypes';
import {
  buildRequest,
  buildResponse,
  reasonPhrase,
  resourcesFor,
  TLS_STEPS,
  ETAG_VALUE,
  DEFAULT_PATH,
} from '@/services/protocols/httpService';

const REQUEST_MS = 1400;
const PROCESS_MS = 600;
const RESPONSE_MS = 1400;
/** TLS 握手每步稍快一点，三步加起来别太久 */
const TLS_MS = 1200;

export interface HttpSendOptions {
  method?: HttpMethod;
  path?: string;
  body?: string;
  status?: number;
  secure?: boolean;
  version?: HttpVersion;
  /** 追加/覆盖到响应里的自定义头 */
  responseHeaders?: Array<[string, string]>;
}

interface FlightMeta {
  start: number;
  duration: number;
  resolve: () => void;
}

/**
 * HTTP 请求/响应动画。
 * HTTP/1.1 顺序发三个资源，HTTP/2 则三个流并发，用同一个 rAF 循环推动所有飞行中的包。
 */
export function useHttpFlow(speed: number = 1) {
  const [phase, setPhase] = useState<HttpPhase>('idle');
  const [stageLabel, setStageLabel] = useState('待发送');
  const [flights, setFlights] = useState<HttpFlight[]>([]);
  const [streams, setStreams] = useState<HttpStream[]>([]);
  const [requests, setRequests] = useState<Record<number, HttpMessage>>({});
  const [responses, setResponses] = useState<Record<number, HttpMessage>>({});
  const [selectedStreamId, setSelectedStreamId] = useState(1);
  const [log, setLog] = useState<HttpLogEntry[]>([]);
  const [isSending, setIsSending] = useState(false);

  const speedRef = useRef(speed);
  const tokenRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const flightsRef = useRef<Map<string, FlightMeta>>(new Map());
  const timersRef = useRef<Set<() => void>>(new Set());
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);
  const logIdRef = useRef(0);

  useEffect(() => { speedRef.current = speed; }, [speed]);

  /** 每帧推进所有飞行中的包，到终点的包从画布移除并 resolve */
  const tick = useCallback(() => {
    const now = performance.now();
    const finished: string[] = [];
    let active = false;

    flightsRef.current.forEach((meta, id) => {
      if ((now - meta.start) / meta.duration >= 1) finished.push(id);
      else active = true;
    });

    setFlights(prev => prev.map(flight => {
      const meta = flightsRef.current.get(flight.id);
      if (!meta) return flight;
      return { ...flight, progress: Math.min((now - meta.start) / meta.duration, 1) };
    }));

    finished.forEach(id => {
      const meta = flightsRef.current.get(id);
      flightsRef.current.delete(id);
      setFlights(prev => prev.filter(flight => flight.id !== id));
      meta?.resolve();
    });

    frameRef.current = active ? requestAnimationFrame(tick) : null;
  }, []);

  const stopFlights = useCallback((settle: boolean) => {
    if (settle) {
      flightsRef.current.forEach(meta => meta.resolve());
    }
    flightsRef.current.clear();
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setFlights([]);
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
      flightsRef.current.forEach(meta => meta.resolve());
      flightsRef.current.clear();
      clearTimers();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [clearTimers]);

  const appendLog = useCallback((text: string) => {
    logIdRef.current += 1;
    setLog(prev => [...prev.slice(-11), { id: logIdRef.current, text }]);
  }, []);

  /** 让一个包从一端飞到另一端；被重置/卸载时提前 resolve */
  const fly = useCallback((flight: Omit<HttpFlight, 'progress'>, duration: number) => new Promise<void>(resolve => {
    flightsRef.current.set(flight.id, { start: performance.now(), duration, resolve });
    setFlights(prev => [...prev, { ...flight, progress: 0 }]);
    if (frameRef.current === null && mountedRef.current) {
      frameRef.current = requestAnimationFrame(tick);
    }
  }), [tick]);

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

  const send = useCallback(async (options: HttpSendOptions = {}) => {
    const {
      method = 'GET',
      path = DEFAULT_PATH,
      body = '',
      status = 200,
      secure = false,
      version = 'http1',
      responseHeaders = [],
    } = options;

    if (sendingRef.current) return;

    sendingRef.current = true;
    tokenRef.current += 1;
    const token = tokenRef.current;

    setIsSending(true);
    setLog([]);
    setRequests({});
    setResponses({});
    setFlights([]);
    setSelectedStreamId(1);

    const resources = resourcesFor(path, method);
    const streamList: HttpStream[] = resources.map((resourcePath, index) => ({
      id: index + 1,
      path: resourcePath,
      status: 'pending',
    }));
    setStreams(streamList);

    // HTTPS：先走一遍 TLS 1.3 握手
    if (secure) {
      setPhase('tls');
      for (const step of TLS_STEPS) {
        setStageLabel(`🔐 TLS：${step.label}`);
        appendLog(`${step.label} · ${step.detail}`);
        await fly({
          id: `tls-${step.label}`,
          kind: 'tls',
          label: step.label,
          direction: step.direction,
        }, TLS_MS / speedRef.current);
        if (token !== tokenRef.current) return;
      }
      appendLog('TLS 握手完成，开始加密传输');
    }

    setPhase('transfer');
    setStageLabel(
      version === 'http2'
        ? `HTTP/2 多路复用：${streamList.length} 个流同时加载`
        : `HTTP/1.1 串行：${streamList.length} 个资源依次加载`,
    );
    appendLog(
      version === 'http2'
        ? `HTTP/2 多路复用：${streamList.length} 个流同时发出`
        : `HTTP/1.1 串行：${streamList.length} 个资源依次请求`,
    );

    let completed = 0;

    const runStream = async (stream: HttpStream) => {
      const request = buildRequest(method, stream.path, body);
      setRequests(prev => ({ ...prev, [stream.id]: request }));
      setStreams(prev => prev.map(item => (item.id === stream.id ? { ...item, status: 'requesting' } : item)));
      // 串行时给每条流单独的状态；并发时保持「多路复用」的总结文案，避免徽章来回跳
      if (version === 'http1') {
        setStageLabel(`HTTP/1.1 串行：流 ${stream.id} ${stream.path} 请求中`);
      }
      appendLog(`流 ${stream.id}：${method} ${stream.path} → 请求已发出`);

      await fly({
        id: `req-${stream.id}-${Date.now()}`,
        kind: 'request',
        label: `${method} ${stream.path}`,
        streamId: stream.id,
        direction: 'to-server',
      }, REQUEST_MS / speedRef.current);
      if (token !== tokenRef.current) return;

      setStreams(prev => prev.map(item => (item.id === stream.id ? { ...item, status: 'processing' } : item)));
      if (!await wait(PROCESS_MS / speedRef.current, token) || token !== tokenRef.current) return;

      const response = buildResponse(status, undefined, responseHeaders);
      setResponses(prev => ({ ...prev, [stream.id]: response }));
      setStreams(prev => prev.map(item => (item.id === stream.id
        ? { ...item, status: 'responding', responseStatus: status }
        : item)));
      appendLog(`流 ${stream.id}：响应 ${response.startLine}`);

      await fly({
        id: `res-${stream.id}-${Date.now()}`,
        kind: 'response',
        label: `${status} ${reasonPhrase(status)}`,
        streamId: stream.id,
        direction: 'to-client',
      }, RESPONSE_MS / speedRef.current);
      if (token !== tokenRef.current) return;

      setStreams(prev => prev.map(item => (item.id === stream.id ? { ...item, status: 'done' } : item)));
      completed += 1;
      setStageLabel(`${version === 'http2' ? 'HTTP/2 多路复用' : 'HTTP/1.1 串行'}：${completed}/${streamList.length} 完成`);
    };

    if (version === 'http2') {
      await Promise.all(streamList.map(runStream));
    } else {
      for (const stream of streamList) {
        await runStream(stream);
        if (token !== tokenRef.current) return;
      }
    }

    if (token !== tokenRef.current) return;

    setPhase('done');
    setStageLabel('✅ 完成');
    appendLog('全部资源加载完成');
    setIsSending(false);
    sendingRef.current = false;
  }, [appendLog, fly, wait]);

  const selectStream = useCallback((id: number) => {
    setSelectedStreamId(id);
  }, []);

  /** 缓存校验：拿上一次响应的 ETag 发 If-None-Match，服务器回 304 */
  const sendConditional = useCallback(async () => {
    const previous = responses[1];
    const streamPath = streams[0]?.path ?? DEFAULT_PATH;
    if (sendingRef.current || !previous || !previous.startLine.includes('200')) return;

    const etag = previous.headers.find(([name]) => name.toLowerCase() === 'etag')?.[1] ?? ETAG_VALUE;

    sendingRef.current = true;
    tokenRef.current += 1;
    const token = tokenRef.current;

    setIsSending(true);
    setLog([]);
    setFlights([]);
    setSelectedStreamId(1);
    setStreams([{ id: 1, path: streamPath, status: 'pending' }]);

    setPhase('transfer');
    setStageLabel('缓存校验：携带 If-None-Match');
    appendLog(`流 1：GET ${streamPath} · If-None-Match: ${etag}`);

    const request = buildRequest('GET', streamPath, '', [['If-None-Match', etag]]);
    setRequests({ 1: request });
    setStreams([{ id: 1, path: streamPath, status: 'requesting' }]);

    await fly({
      id: `req-cond-${Date.now()}`,
      kind: 'request',
      label: `GET ${streamPath}`,
      streamId: 1,
      direction: 'to-server',
    }, REQUEST_MS / speedRef.current);
    if (token !== tokenRef.current) return;

    setStreams([{ id: 1, path: streamPath, status: 'processing' }]);
    if (!await wait(PROCESS_MS / speedRef.current, token) || token !== tokenRef.current) return;

    const response = buildResponse(304);
    setResponses({ 1: response });
    setStreams([{ id: 1, path: streamPath, status: 'responding', responseStatus: 304 }]);
    appendLog('服务器返回 304 Not Modified，命中缓存，不再传正文');
    setStageLabel('✅ 命中缓存（304）');

    await fly({
      id: `res-cond-${Date.now()}`,
      kind: 'response',
      label: '304 Not Modified',
      streamId: 1,
      direction: 'to-client',
    }, RESPONSE_MS / speedRef.current);
    if (token !== tokenRef.current) return;

    setStreams([{ id: 1, path: streamPath, status: 'done', responseStatus: 304 }]);
    setPhase('done');
    setIsSending(false);
    sendingRef.current = false;
  }, [appendLog, fly, wait, responses, streams]);

  const reset = useCallback(() => {
    tokenRef.current += 1;
    sendingRef.current = false;
    stopFlights(true);
    clearTimers();
    setPhase('idle');
    setStageLabel('待发送');
    setStreams([]);
    setRequests({});
    setResponses({});
    setLog([]);
    setIsSending(false);
  }, [stopFlights, clearTimers]);

  return {
    phase,
    stageLabel,
    flights,
    streams,
    requests,
    responses,
    selectedStreamId,
    log,
    isSending,
    send,
    sendConditional,
    selectStream,
    reset,
  };
}
