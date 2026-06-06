import { useCallback, useRef, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setPlaying,
  setPhase,
  setWindow,
  setPacketLossEnabled,
  addFlightBall,
  removeFlightBall,
  clearFlightBalls,
  addCwndRecord,
  incrementRtt,
  incrementLost,
  incrementAcked,
  setAnimationStatus,
  addLogEntry,
  reset,
} from '@/store/slices/congestionSlice';
import {
  createWindow,
  growWindow,
  handlePacketLoss,
  acknowledgePacket,
  prepareNextBatch,
  shouldDropPacket,
} from '@/services/protocols/congestionService';
import { CongestionPhase, ScenarioMode, FlightBall } from '@/types/congestionTypes';

const FLIGHT_MS = 3000;
const ACK_MS = 2000;
const TRACK_GAP = 6;
const BASE_TRACK = 15;

export function useCongestionControl(speed: number = 1) {
  const dispatch = useAppDispatch();
  const state = useAppSelector(s => s.congestion);
  const isMountedRef = useRef(true);
  const speedRef = useRef(speed);
  const stateRef = useRef(state);
  const frameRef = useRef<number | null>(null);

  // 本地动画进度 — 每帧批量更新一次，避免 Redux 高频 dispatch
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { stateRef.current = state; }, [state]);

  const getDur = useCallback((base: number) => base / speedRef.current, []);

  // ── 单全局 rAF 循环 ──
  const pendingCallbacksRef = useRef<Map<string, () => void>>(new Map());
  const ballMetasRef = useRef<Map<string, { startTime: number; duration: number }>>(new Map());

  const startGlobalLoop = useCallback(() => {
    if (frameRef.current) return; // already running

    const tick = (_now: number) => {
      if (!isMountedRef.current) { frameRef.current = null; return; }
      const now = performance.now();
      const next: Record<string, number> = {};
      let hasActive = false;

      ballMetasRef.current.forEach((meta, id) => {
        const elapsed = now - meta.startTime;
        const progress = Math.min(elapsed / meta.duration, 1);
        next[id] = progress;
        if (progress < 1) hasActive = true;
        else {
          // 完成：触发回调
          const cb = pendingCallbacksRef.current.get(id);
          if (cb) { cb(); pendingCallbacksRef.current.delete(id); }
          ballMetasRef.current.delete(id);
        }
      });

      // 合并而非替换，保持已完成但尚未从Redux移除的球的最后位置
      setProgressMap(prev => {
        const merged = { ...prev };
        for (const [id, p] of Object.entries(next)) {
          merged[id] = p;
        }
        return merged;
      });

      if (hasActive || ballMetasRef.current.size > 0) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const registerBall = useCallback((id: string, startTime: number, duration: number, onComplete: () => void) => {
    ballMetasRef.current.set(id, { startTime, duration });
    pendingCallbacksRef.current.set(id, onComplete);
    // 初始化进度为0，保持已有数据
    setProgressMap(prev => {
      prev[id] = 0;
      return { ...prev };
    });
    startGlobalLoop();
  }, [startGlobalLoop]);

  // ── 发送一批数据包 ──
  const sendBatch = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const w = stateRef.current.window;
      const count = w.allowedToSend;
      if (count <= 0 || !isMountedRef.current) { resolve(); return; }

      const batchSeq = Date.now();
      let completedCount = 0;
      const totalBalls = count;
      dispatch(addLogEntry({ text: `发送 ${count} 包 (seq ${w.nextSeq}-${w.nextSeq + count - 1})`, type: 'info' }));

      for (let i = 0; i < count; i++) {
        const seq = w.nextSeq + i;
        const trackY = BASE_TRACK + ((seq - 1) % 12) * TRACK_GAP;
        const ball: FlightBall = {
          id: `ball_${seq}_${batchSeq}`,
          progress: 0,
          trackY,
          isAck: false,
          isLost: false,
          seqNum: seq,
          startTime: performance.now(),
          duration: getDur(FLIGHT_MS),
        };
        dispatch(addFlightBall(ball));

        registerBall(ball.id, performance.now(), getDur(FLIGHT_MS), () => {
          if (!isMountedRef.current) { completedCount++; checkDone(); return; }
          const cur = stateRef.current;

          if (shouldDropPacket(cur.packetLossEnabled)) {
            dispatch(incrementLost());
            const result = handlePacketLoss(cur.window);
            dispatch(setWindow(result.window));
            dispatch(setPhase(result.phase));
            dispatch(setAnimationStatus(`❌ 包 #${seq} 丢失！cwnd → ${result.window.cwnd}`));
            dispatch(addLogEntry({ text: `✕ 包 #${seq} 丢失！cwnd → ${result.window.cwnd}`, type: 'error' }));
            // 丢包后移除
            setTimeout(() => {
              if (isMountedRef.current) dispatch(removeFlightBall(ball.id));
              completedCount++; checkDone();
            }, 800);
          } else {
            const newWindow = acknowledgePacket(cur.window, seq);
            dispatch(setWindow(newWindow));
            dispatch(incrementAcked());
            dispatch(addLogEntry({ text: `● 包 #${seq} 到达，ACK 返回`, type: 'success' }));

            // ACK回程
            const ackId = `ack_${seq}_${Date.now()}`;
            const ackBall: FlightBall = {
              id: ackId,
              progress: 0,
              trackY,
              isAck: true,
              isLost: false,
              seqNum: seq,
              startTime: performance.now(),
              duration: getDur(ACK_MS),
            };
            dispatch(addFlightBall(ackBall));

            // 移除数据包
            setTimeout(() => { if (isMountedRef.current) dispatch(removeFlightBall(ball.id)); }, 150);

            registerBall(ackId, performance.now(), getDur(ACK_MS), () => {
              setTimeout(() => { if (isMountedRef.current) dispatch(removeFlightBall(ackId)); }, 100);
              completedCount++; checkDone();
            });
          }
        });
      }

      dispatch(setWindow({
        ...w,
        nextSeq: w.nextSeq + count,
        allowedToSend: 0,
      }));

      const checkDone = () => { if (completedCount >= totalBalls) resolve(); };
    });
  }, [dispatch, registerBall, getDur]);

  // ── RTT 周期 ──
  const runRttCycle = useCallback(async () => {
    if (!isMountedRef.current) return;
    const cur = stateRef.current;

    dispatch(incrementRtt());
    dispatch(addLogEntry({ text: `══ RTT #${cur.rttCount + 1} (cwnd=${cur.window.cwnd}) ══`, type: 'rtt' }));
    dispatch(setAnimationStatus(`RTT #${cur.rttCount + 1} — cwnd=${cur.window.cwnd} — 发送 ${cur.window.allowedToSend} 包`));
    dispatch(addCwndRecord({ time: Date.now(), cwnd: cur.window.cwnd, ssthresh: cur.window.ssthresh }));

    await sendBatch();
    await new Promise(r => setTimeout(r, getDur(300)));

    const latest = stateRef.current;
    const growth = growWindow(latest.window, latest.phase);
    dispatch(setWindow(growth.window));
    dispatch(setPhase(growth.phase));
    dispatch(setAnimationStatus(`cwnd → ${growth.window.cwnd} (${growth.phase === CongestionPhase.SLOW_START ? '慢启动' : '拥塞避免'})`));
    dispatch(setWindow(prepareNextBatch(growth.window)));
  }, [dispatch, sendBatch, getDur]);

  // ── 完整演示 ──
  const performFullDemo = useCallback(async () => {
    if (stateRef.current.isPlaying) return;
    dispatch(reset());
    ballMetasRef.current.clear();
    pendingCallbacksRef.current.clear();
    setProgressMap({});
    await new Promise(r => setTimeout(r, 50));
    dispatch(setPlaying(true));
    dispatch(setPhase(CongestionPhase.SLOW_START));

    for (let i = 0; i < 12; i++) {
      if (!isMountedRef.current) break;
      await runRttCycle();
      await new Promise(r => setTimeout(r, getDur(800)));
    }
    dispatch(setAnimationStatus('✅ 拥塞控制演示完成'));
    dispatch(setPlaying(false));
  }, [dispatch, runRttCycle, getDur]);

  const performSlowStart = useCallback(async () => {
    if (stateRef.current.isPlaying) return;
    dispatch(reset());
    ballMetasRef.current.clear();
    pendingCallbacksRef.current.clear();
    setProgressMap({});
    await new Promise(r => setTimeout(r, 50));
    dispatch(setPlaying(true));
    dispatch(setPhase(CongestionPhase.SLOW_START));
    dispatch(setWindow({ ...createWindow(), ssthresh: 16 }));

    for (let i = 0; i < 8; i++) {
      if (!isMountedRef.current) break;
      await runRttCycle();
      await new Promise(r => setTimeout(r, getDur(700)));
    }
    dispatch(setAnimationStatus('✅ 慢启动演示完成'));
    dispatch(setPlaying(false));
  }, [dispatch, runRttCycle, getDur]);

  const resetAll = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    ballMetasRef.current.clear();
    pendingCallbacksRef.current.clear();
    setProgressMap({});
    dispatch(clearFlightBalls());
    dispatch(reset());
  }, [dispatch]);

  const togglePacketLoss = useCallback(() => {
    const newVal = !stateRef.current.packetLossEnabled;
    dispatch(setPacketLossEnabled(newVal));
    dispatch(setAnimationStatus(newVal ? '🔴 丢包模拟开启 — 5%丢包率' : '丢包模拟关闭'));
  }, [dispatch]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return {
    ...state,
    progressMap,
    performFullDemo,
    performSlowStart,
    resetAll,
    togglePacketLoss,
    setPlaying: (v: boolean) => dispatch(setPlaying(v)),
  };
}
