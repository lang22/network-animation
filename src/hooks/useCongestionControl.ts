import { useCallback, useRef, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setPlaying,
  setPhase,
  setWindow,
  setPacketLossEnabled,
  addFlightBall,
  markBallLost,
  removeFlightBall,
  clearFlightBalls,
  addCwndRecord,
  incrementRtt,
  incrementLost,
  trackPacketSent,
  markTrackedPacketLost,
  markPacketWaitingTimeout,
  markPacketAcked,
  enqueueRetransmission,
  dequeueRetransmission,
  setLossRate,
  setDropNextSeq,
  incrementTimeout,
  incrementRetransmission,
  setAnimationStatus,
  addLogEntry,
  reset,
} from '@/store/slices/congestionSlice';
import {
  createWindow,
  growWindow,
  handleTimeoutLoss,
  acknowledgePacket,
  prepareNextBatch,
  shouldDropPacket,
  canRetransmit,
} from '@/services/protocols/congestionService';
import { CongestionPhase, FlightBall } from '@/types/congestionTypes';

const FLIGHT_MS = 3000;
const ACK_MS = 2000;
const TRACK_GAP = 6;
const BASE_TRACK = 15;

/** 丢包判定发生的位置（0~1，相对链路长度），小球会停在这里变红并消散 */
const LOSS_PROGRESS = 0.55;

/** 一次飞行动画的结束方式 */
type FlightResult = 'arrived' | 'frozen' | 'aborted';

export function useCongestionControl(speed: number = 1) {
  const dispatch = useAppDispatch();
  const state = useAppSelector(s => s.congestion);
  const isMountedRef = useRef(true);
  const speedRef = useRef(speed);
  const stateRef = useRef(state);
  const frameRef = useRef<number | null>(null);
  const pendingCallbacksRef = useRef<Map<string, () => void>>(new Map());
  const ballMetasRef = useRef<Map<string, { startTime: number; duration: number }>>(new Map());

  /** 演示批次号：每次重置/终止自增，旧批次的所有异步回调据此失效 */
  const runTokenRef = useRef(0);
  /** 挂在当前批次上的取消钩子（等待中的 sleep / 飞行），终止时逐个 settle，避免 Promise 悬挂 */
  const abortHandlersRef = useRef<Set<() => void>>(new Set());

  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { stateRef.current = state; }, [state]);

  const getDur = useCallback((base: number) => base / speedRef.current, []);

  const isActive = useCallback(
    (token: number) => isMountedRef.current && token === runTokenRef.current,
    [],
  );

  /** 可被终止打断的等待 */
  const sleep = useCallback((ms: number, token: number): Promise<void> => {
    return new Promise<void>(resolve => {
      if (!isActive(token)) { resolve(); return; }

      const finish = () => {
        clearTimeout(timer);
        abortHandlersRef.current.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      abortHandlersRef.current.add(finish);
    });
  }, [isActive]);

  // ── 单全局 rAF 循环 ──
  const startGlobalLoop = useCallback(() => {
    if (frameRef.current) return;

    const tick = () => {
      if (!isMountedRef.current) {
        frameRef.current = null;
        return;
      }

      const now = performance.now();
      const next: Record<string, number> = {};
      let hasActive = false;

      ballMetasRef.current.forEach((meta, id) => {
        const progress = Math.min((now - meta.startTime) / meta.duration, 1);
        next[id] = progress;

        if (progress < 1) {
          hasActive = true;
          return;
        }

        const callback = pendingCallbacksRef.current.get(id);
        if (callback) {
          callback();
          pendingCallbacksRef.current.delete(id);
        }
        ballMetasRef.current.delete(id);
      });

      // 合并而非替换，保持已停下的小球（丢包/完成）停在最后位置
      setProgressMap(prev => {
        const merged = { ...prev };
        for (const [id, progress] of Object.entries(next)) {
          merged[id] = progress;
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

  /**
   * 启动一次飞行。返回的 promise 由到达 / 冻结 / 终止三种情况 settle。
   * freeze() 用于丢包：让小球停在当前位置，不再继续飞向接收端。
   */
  const startFlight = useCallback((ball: FlightBall, duration: number, token: number) => {
    let settle: (result: FlightResult) => void = () => {};
    const promise = new Promise<FlightResult>(resolve => { settle = resolve; });

    const finish = (result: FlightResult) => {
      ballMetasRef.current.delete(ball.id);
      pendingCallbacksRef.current.delete(ball.id);
      abortHandlersRef.current.delete(onAbort);
      settle(result);
    };
    const onAbort = () => finish('aborted');

    abortHandlersRef.current.add(onAbort);
    ballMetasRef.current.set(ball.id, { startTime: ball.startTime, duration });
    pendingCallbacksRef.current.set(ball.id, () => {
      if (isActive(token)) finish('arrived');
    });
    setProgressMap(prev => ({ ...prev, [ball.id]: 0 }));
    startGlobalLoop();

    return { promise, freeze: () => finish('frozen') };
  }, [isActive, startGlobalLoop]);

  /** 终止当前批次：批次号失效、等待与飞行全部 settle、动画引用清空 */
  const cancelRun = useCallback((resetProgress = true) => {
    runTokenRef.current += 1;
    Array.from(abortHandlersRef.current).forEach(handler => handler());
    abortHandlersRef.current.clear();

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    ballMetasRef.current.clear();
    pendingCallbacksRef.current.clear();
    if (resetProgress) setProgressMap({});
  }, []);

  // ── ACK 回程 ──
  const sendAck = useCallback(async (
    seqNum: number,
    trackY: number,
    sourceBallId: string,
    retransmitted: boolean,
    token: number,
  ) => {
    if (!isActive(token)) return;

    dispatch(setWindow(acknowledgePacket(stateRef.current.window, seqNum)));
    dispatch(addLogEntry({
      text: `${retransmitted ? '重传包' : '数据包'} #${seqNum} 到达接收端，回送 ACK`,
      type: 'success',
    }));
    dispatch(setAnimationStatus(`#${seqNum} 已到达，ACK 返回中`));

    const ackId = `ack_${seqNum}_${Date.now()}`;
    const ackBall: FlightBall = {
      id: ackId,
      progress: 0,
      trackY,
      isAck: true,
      isLost: false,
      seqNum,
      startTime: performance.now(),
      duration: getDur(ACK_MS),
    };

    dispatch(addFlightBall(ackBall));
    window.setTimeout(() => {
      if (isMountedRef.current) dispatch(removeFlightBall(sourceBallId));
    }, 150);

    const flight = startFlight(ackBall, getDur(ACK_MS), token);
    const result = await flight.promise;
    if (result !== 'arrived' || !isActive(token)) return;

    dispatch(markPacketAcked(seqNum));
    dispatch(removeFlightBall(ackId));
  }, [dispatch, isActive, startFlight, getDur]);

  /**
   * 发送一个数据包：链路中途判定丢包 → 等待 RTO → 超时降窗 → 重传（重传同样可能丢）。
   * attempt 从 1 开始，超过 rtoConfig.maxRetransmissions 次后放弃。
   */
  const transmit = useCallback(async (
    seqNum: number,
    trackY: number,
    attempt: number,
    token: number,
  ): Promise<void> => {
    if (!isActive(token)) return;

    const current = stateRef.current;
    const isRetransmission = attempt > 1;
    const lossConfig = {
      enabled: current.packetLossEnabled,
      lossRate: current.lossRate,
      dropNextSeq: current.dropNextSeq,
    };
    const lost = shouldDropPacket(lossConfig, seqNum);
    if (lost && lossConfig.dropNextSeq === seqNum) dispatch(setDropNextSeq(null));

    const id = `${isRetransmission ? 'rtx' : 'ball'}_${seqNum}_${attempt}_${Date.now()}`;
    const now = performance.now();
    const ball: FlightBall = {
      id,
      progress: 0,
      trackY,
      isAck: false,
      isLost: false,
      isRetransmission,
      seqNum,
      attempt,
      startTime: now,
      duration: getDur(FLIGHT_MS),
    };

    dispatch(addFlightBall(ball));
    dispatch(trackPacketSent({
      seqNum,
      ballId: id,
      sentAt: now,
      rtoAt: now + getDur(current.rtoConfig.baseMs),
      attempt,
      status: isRetransmission ? 'retransmitting' : 'flying',
    }));

    if (isRetransmission) {
      dispatch(incrementRetransmission());
      dispatch(dequeueRetransmission(seqNum));
      dispatch(addLogEntry({ text: `重传 #${seqNum}（第 ${attempt} 次发送）`, type: 'retransmit' }));
    }

    const flight = startFlight(ball, getDur(FLIGHT_MS), token);

    // ── 正常到达：等小球飞完，回 ACK ──
    if (!lost) {
      const result = await flight.promise;
      if (result !== 'arrived' || !isActive(token)) return;
      await sendAck(seqNum, trackY, id, isRetransmission, token);
      return;
    }

    // ── 丢包：飞不到接收端，在链路中途变红停下 ──
    const lostAt = getDur(FLIGHT_MS) * LOSS_PROGRESS;
    await sleep(lostAt, token);
    if (!isActive(token)) return;
    flight.freeze();

    dispatch(markBallLost(id));
    dispatch(markTrackedPacketLost(seqNum));
    dispatch(markPacketWaitingTimeout(seqNum));
    dispatch(incrementLost());
    dispatch(setAnimationStatus(`#${seqNum} 在链路中丢失，等待 RTO`));
    dispatch(addLogEntry({
      text: `#${seqNum} 丢包（第 ${attempt} 次发送），等待 RTO 超时`,
      type: 'error',
    }));

    // RTO 从发送时刻起算，已经过去了小球飞到丢包点的时间
    await sleep(Math.max(0, getDur(current.rtoConfig.baseMs) - lostAt), token);
    if (!isActive(token)) return;

    dispatch(incrementTimeout());
    const timeoutResult = handleTimeoutLoss(stateRef.current.window);
    dispatch(setWindow(timeoutResult.window));
    dispatch(setPhase(timeoutResult.phase));
    dispatch(setAnimationStatus(`#${seqNum} RTO 超时，cwnd 降为 1`));
    dispatch(addLogEntry({ text: `#${seqNum} RTO 超时，窗口降为 1，进入慢启动`, type: 'timeout' }));
    dispatch(removeFlightBall(id));

    const latest = stateRef.current;
    if (!canRetransmit(attempt, latest.rtoConfig.maxRetransmissions)) {
      dispatch(addLogEntry({
        text: `#${seqNum} 连续 ${attempt} 次发送失败，放弃重传`,
        type: 'error',
      }));
      dispatch(setAnimationStatus(`#${seqNum} 达到重传上限，丢弃`));
      return;
    }

    dispatch(enqueueRetransmission({
      seqNum,
      attempt: attempt + 1,
      originalBallId: id,
    }));
    await transmit(seqNum, trackY, attempt + 1, token);
  }, [dispatch, isActive, sleep, startFlight, sendAck, getDur]);

  const sendBatch = useCallback(async (token: number): Promise<void> => {
    if (!isActive(token)) return;

    const windowState = stateRef.current.window;
    const count = windowState.allowedToSend;
    if (count <= 0) return;

    dispatch(addLogEntry({
      text: `发送 ${count} 个包（seq ${windowState.nextSeq}-${windowState.nextSeq + count - 1}）`,
      type: 'info',
    }));

    const tasks: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
      const seqNum = windowState.nextSeq + i;
      const trackY = BASE_TRACK + ((seqNum - 1) % 12) * TRACK_GAP;
      tasks.push(transmit(seqNum, trackY, 1, token));
    }

    dispatch(setWindow({
      ...windowState,
      nextSeq: windowState.nextSeq + count,
      allowedToSend: 0,
    }));

    await Promise.all(tasks);
  }, [dispatch, isActive, transmit]);

  const runRttCycle = useCallback(async (token: number) => {
    if (!isActive(token)) return;

    const current = stateRef.current;
    const timeoutCountBefore = current.timeoutCount;

    dispatch(incrementRtt());
    dispatch(addLogEntry({
      text: `第 ${current.rttCount + 1} 轮 RTT（cwnd=${current.window.cwnd}）`,
      type: 'rtt',
    }));
    dispatch(setAnimationStatus(
      `第 ${current.rttCount + 1} 轮：cwnd=${current.window.cwnd}，发送 ${current.window.allowedToSend} 个包`,
    ));
    dispatch(addCwndRecord({
      time: Date.now(),
      cwnd: current.window.cwnd,
      ssthresh: current.window.ssthresh,
    }));

    await sendBatch(token);
    await sleep(getDur(300), token);
    if (!isActive(token)) return;

    const latest = stateRef.current;
    // 本轮发生超时：窗口已在超时处理里重置，本轮不再增长
    if (latest.timeoutCount > timeoutCountBefore) {
      dispatch(setWindow(prepareNextBatch(latest.window)));
      return;
    }

    const growth = growWindow(latest.window, latest.phase);
    dispatch(setWindow(growth.window));
    dispatch(setPhase(growth.phase));
    dispatch(setAnimationStatus(
      `cwnd 增长到 ${growth.window.cwnd}（${growth.phase === CongestionPhase.SLOW_START ? '慢启动' : '拥塞避免'}）`,
    ));
    dispatch(setWindow(prepareNextBatch(growth.window)));
  }, [dispatch, isActive, sendBatch, sleep, getDur]);

  const restoreLossControls = useCallback((controls: {
    packetLossEnabled: boolean;
    lossRate: number;
    dropNextSeq: number | null;
  }) => {
    dispatch(setPacketLossEnabled(controls.packetLossEnabled));
    dispatch(setLossRate(controls.lossRate));
    dispatch(setDropNextSeq(controls.dropNextSeq));
  }, [dispatch]);

  const performFullDemo = useCallback(async () => {
    if (stateRef.current.isPlaying) return;

    const controls = {
      packetLossEnabled: stateRef.current.packetLossEnabled,
      lossRate: stateRef.current.lossRate,
      dropNextSeq: stateRef.current.dropNextSeq,
    };

    cancelRun();
    dispatch(reset());
    restoreLossControls(controls);

    const token = runTokenRef.current;
    await sleep(50, token);
    if (!isActive(token)) return;

    dispatch(setPlaying(true));
    dispatch(setPhase(CongestionPhase.SLOW_START));

    for (let i = 0; i < 12; i++) {
      if (!isActive(token)) return;
      await runRttCycle(token);
      await sleep(getDur(800), token);
    }

    if (!isActive(token)) return;
    dispatch(setAnimationStatus('拥塞控制演示结束'));
    dispatch(setPlaying(false));
  }, [dispatch, isActive, cancelRun, sleep, restoreLossControls, runRttCycle, getDur]);

  const performSlowStart = useCallback(async () => {
    if (stateRef.current.isPlaying) return;

    const controls = {
      packetLossEnabled: stateRef.current.packetLossEnabled,
      lossRate: stateRef.current.lossRate,
      dropNextSeq: stateRef.current.dropNextSeq,
    };

    cancelRun();
    dispatch(reset());
    restoreLossControls(controls);

    const token = runTokenRef.current;
    await sleep(50, token);
    if (!isActive(token)) return;

    dispatch(setPlaying(true));
    dispatch(setPhase(CongestionPhase.SLOW_START));
    dispatch(setWindow({ ...createWindow(), ssthresh: 16 }));

    for (let i = 0; i < 8; i++) {
      if (!isActive(token)) return;
      await runRttCycle(token);
      await sleep(getDur(700), token);
    }

    if (!isActive(token)) return;
    dispatch(setAnimationStatus('慢启动演示结束'));
    dispatch(setPlaying(false));
  }, [dispatch, isActive, cancelRun, sleep, restoreLossControls, runRttCycle, getDur]);

  const resetAll = useCallback(() => {
    cancelRun();
    dispatch(clearFlightBalls());
    dispatch(reset());
  }, [cancelRun, dispatch]);

  const togglePacketLoss = useCallback(() => {
    const enabled = !stateRef.current.packetLossEnabled;
    dispatch(setPacketLossEnabled(enabled));
    dispatch(setAnimationStatus(
      enabled
        ? `丢包模拟开启（丢包率 ${Math.round(stateRef.current.lossRate * 100)}%）`
        : '丢包模拟关闭',
    ));
  }, [dispatch]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cancelRun(false);
    };
  }, [cancelRun]);

  return {
    ...state,
    progressMap,
    performFullDemo,
    performSlowStart,
    resetAll,
    togglePacketLoss,
    setPlaying: (value: boolean) => dispatch(setPlaying(value)),
    setLossRate: (value: number) => dispatch(setLossRate(value)),
    setDropNextSeq: (value: number | null) => dispatch(setDropNextSeq(value)),
  };
}
