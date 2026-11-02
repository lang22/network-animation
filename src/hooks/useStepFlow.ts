import { useCallback, useEffect, useRef, useState } from 'react';
import { FlowLogEntry, FlowPacket, FlowStatus, FlowStep } from '@/types/flowTypes';

const STEP_MS = 900;
/** 两条消息之间的停顿，让日志来得及看 */
const GAP_MS = 220;

/**
 * 按顺序播放一组「节点间消息」步骤。
 * DNS / DHCP 都是这种线性的问答流程，用一个播放器比各写一套 rAF 更省事。
 */
export function useStepFlow(speed: number = 1) {
  const [status, setStatus] = useState<FlowStatus>('idle');
  const [packet, setPacket] = useState<FlowPacket | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [log, setLog] = useState<FlowLogEntry[]>([]);

  const speedRef = useRef(speed);
  const tokenRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(false);
  const mountedRef = useRef(true);
  const logIdRef = useRef(0);

  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      tokenRef.current += 1;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const appendLog = useCallback((text: string) => {
    logIdRef.current += 1;
    setLog(prev => [...prev.slice(-15), { id: logIdRef.current, text }]);
  }, []);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    playingRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPacket(null);
  }, []);

  /** 让一个消息包从 from 节点飞到 to 节点 */
  const fly = useCallback((step: FlowStep, duration: number, token: number) => new Promise<boolean>(resolve => {
    const start = performance.now();

    const tick = () => {
      if (!mountedRef.current || token !== tokenRef.current) {
        resolve(false);
        return;
      }
      const progress = Math.min((performance.now() - start) / duration, 1);
      setPacket({ step, progress });
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        resolve(true);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
  }), []);

  const wait = useCallback((ms: number, token: number) => new Promise<boolean>(resolve => {
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      resolve(token === tokenRef.current);
    }, ms);
  }), []);

  const play = useCallback(async (steps: FlowStep[]) => {
    if (playingRef.current || steps.length === 0) return;

    playingRef.current = true;
    tokenRef.current += 1;
    const token = tokenRef.current;

    setStatus('playing');
    setLog([]);
    setCurrentIndex(-1);
    setPacket(null);

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      setCurrentIndex(index);

      if (!await fly(step, STEP_MS / speedRef.current, token) || token !== tokenRef.current) return;
      if (!mountedRef.current) return;

      appendLog(`${step.label} · ${step.detail}`);
      if (!await wait(GAP_MS / speedRef.current, token) || token !== tokenRef.current) return;
    }

    setPacket(null);
    setStatus('done');
    playingRef.current = false;
  }, [appendLog, fly, wait]);

  const reset = useCallback(() => {
    stop();
    setStatus('idle');
    setCurrentIndex(-1);
    setLog([]);
  }, [stop]);

  return { status, packet, currentIndex, log, play, reset };
}
