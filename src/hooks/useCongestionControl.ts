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
  setDropSeqs,
  removeDropSeq,
  setSackEnabled,
  setPaused,
  incrementTimeout,
  incrementRetransmission,
  incrementDuplicateAck,
  incrementFastRetransmit,
  incrementPartialAck,
  setAnimationStatus,
  addLogEntry,
  reset,
} from '@/store/slices/congestionSlice';
import {
  createWindow,
  growWindow,
  handleTimeoutLoss,
  handleFastRetransmit,
  acknowledgePacket,
  prepareNextBatch,
  shouldDropPacket,
  canRetransmit,
  isPartialAck,
  buildSackBlocks,
  missingSeqs,
} from '@/services/protocols/congestionService';
import { CongestionPhase, FlightBall } from '@/types/congestionTypes';

const FLIGHT_MS = 2400;
const ACK_MS = 1400;
/** 一批包在通道上铺开的范围（百分比）与最大轨道间距 */
const TRACK_CENTER = 50;
const TRACK_RANGE = 70;
const MAX_LANE_GAP = 6;
/** 演示用的慢启动阈值：窗口最多长到 16 个包，保证画布上的小球还看得清 */
const DEMO_SSTHRESH = 12;
/** SACK 触发时一次最多补发几个缺口，避免小球糊成一片 */
const MAX_SACK_RETRANSMIT = 3;

/** 丢包判定发生的位置（0~1，相对链路长度），小球会停在这里变红并消散 */
const LOSS_PROGRESS = 0.55;

/**
 * 把一批包均匀铺在通道上：单包走中线，多包按包数自动压缩间距，避免 cwnd 变大后轨道重叠。
 * 返回通道 Y 百分比。
 */
function laneY(index: number, count: number): number {
  if (count <= 1) return TRACK_CENTER;
  const gap = Math.min(MAX_LANE_GAP, TRACK_RANGE / (count - 1));
  const span = (count - 1) * gap;
  return TRACK_CENTER - span / 2 + index * gap;
}

/** 一次飞行动画的结束方式 */
type FlightResult = 'arrived' | 'frozen' | 'aborted';

/** 唤醒等待中的丢包：fast = 3 个重复 ACK；partial = 快速恢复中的部分确认（NewReno） */
type WakeMode = 'fast' | 'partial';

/** 可暂停的等待：记录目标时刻，暂停时清掉定时器，恢复时按剩余时间续期 */
interface Sleeper {
  target: number;
  timer: ReturnType<typeof setTimeout> | 0;
  arm: (delay: number) => void;
}

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
  /** 本轮 RTT 是否已经因超时降过窗口：一次拥塞事件只降一次 */
  const windowReducedThisRttRef = useRef(false);
  /** 接收端状态：期望的下一个序号，以及已经收到的乱序包 */
  const receiverRef = useRef<{ expectedSeq: number; received: Set<number> }>({
    expectedSeq: 1,
    received: new Set<number>(),
  });
  /** 同一个缺失序号上累计的重复 ACK 个数 */
  const duplicateAckCountRef = useRef<Map<number, number>>(new Map());
  /** 正在等待 RTO 的丢包：seq -> 唤醒函数（快重传 / 部分确认） */
  const fastRetransmitWaitersRef = useRef<Map<number, (mode: WakeMode) => void>>(new Map());
  /** 动画时钟：暂停期间累积的偏移，nowMs() = performance.now() - offset */
  const pauseRef = useRef({ paused: false, pausedAt: 0, offset: 0 });
  /** 进行中的等待（RTO / 轮间隔），暂停时挂起、恢复时续期 */
  const sleepersRef = useRef<Set<Sleeper>>(new Set());

  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { stateRef.current = state; }, [state]);

  const getDur = useCallback((base: number) => base / speedRef.current, []);

  /** 动画时钟：扣掉暂停累积的时间，暂停期间保持不变 */
  const nowMs = useCallback(() => performance.now() - pauseRef.current.offset, []);

  const isActive = useCallback(
    (token: number) => isMountedRef.current && token === runTokenRef.current,
    [],
  );

  /** 可暂停、可被终止打断的等待 */
  const sleep = useCallback((ms: number, token: number): Promise<void> => {
    return new Promise<void>(resolve => {
      if (!isActive(token)) { resolve(); return; }

      const finish = () => {
        if (sleeper.timer) clearTimeout(sleeper.timer);
        sleeper.timer = 0;
        sleepersRef.current.delete(sleeper);
        abortHandlersRef.current.delete(onAbort);
        resolve();
      };
      const onAbort = () => finish();

      const sleeper: Sleeper = {
        target: nowMs() + ms,
        timer: 0,
        arm: delay => {
          if (!sleeper.timer) sleeper.timer = setTimeout(finish, delay);
        },
      };

      sleepersRef.current.add(sleeper);
      abortHandlersRef.current.add(onAbort);
      sleeper.arm(ms);
    });
  }, [isActive, nowMs]);

  // ── 单全局 rAF 循环 ──
  const startGlobalLoop = useCallback(() => {
    if (frameRef.current || pauseRef.current.paused) return;

    const tick = () => {
      if (!isMountedRef.current || pauseRef.current.paused) {
        frameRef.current = null;
        return;
      }

      const now = nowMs();
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
  }, [nowMs]);

  /** 暂停：停掉 rAF，挂起所有等待中的定时器 */
  const pauseRun = useCallback(() => {
    const pause = pauseRef.current;
    if (pause.paused || !stateRef.current.isPlaying) return;

    pause.paused = true;
    pause.pausedAt = performance.now();

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    sleepersRef.current.forEach(sleeper => {
      if (sleeper.timer) clearTimeout(sleeper.timer);
      sleeper.timer = 0;
    });

    dispatch(setPaused(true));
    dispatch(setAnimationStatus('已暂停'));
  }, [dispatch]);

  /** 继续：把时钟整体后移，小球按原进度接着飞，等待中的定时器按剩余时间续期 */
  const resumeRun = useCallback(() => {
    const pause = pauseRef.current;
    if (!pause.paused) return;

    const delta = performance.now() - pause.pausedAt;
    pause.offset += delta;
    pause.paused = false;
    pause.pausedAt = 0;

    // 时钟通过 offset 保持连续，小球起始时间不用动，进度会从冻结处接着走
    sleepersRef.current.forEach(sleeper => sleeper.arm(Math.max(0, sleeper.target - nowMs())));

    startGlobalLoop();
    dispatch(setPaused(false));
    dispatch(setAnimationStatus('继续演示'));
  }, [dispatch, nowMs, startGlobalLoop]);

  const togglePause = useCallback(() => {
    if (pauseRef.current.paused) resumeRun();
    else pauseRun();
  }, [pauseRun, resumeRun]);

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
    receiverRef.current = { expectedSeq: 1, received: new Set<number>() };
    duplicateAckCountRef.current.clear();
    fastRetransmitWaitersRef.current.clear();
    pauseRef.current = { paused: false, pausedAt: 0, offset: 0 };
    sleepersRef.current.clear();
    if (resetProgress) setProgressMap({});
  }, []);

  // ── 包到达接收端：回 ACK / 重复 ACK ──
  const deliverPacket = useCallback(async (
    seqNum: number,
    trackY: number,
    sourceBallId: string,
    retransmitted: boolean,
    token: number,
  ) => {
    if (!isActive(token)) return;

    const receiver = receiverRef.current;
    const wasExpected = seqNum === receiver.expectedSeq;
    receiver.received.add(seqNum);
    while (receiver.received.has(receiver.expectedSeq)) {
      receiver.received.delete(receiver.expectedSeq);
      receiver.expectedSeq += 1;
    }
    const ackSeq = receiver.expectedSeq;
    const duplicate = !wasExpected;

    // 开启 SACK 时，ACK 里带上已收到的乱序区间
    const sackBlocks = stateRef.current.sackEnabled
      ? buildSackBlocks(ackSeq, receiver.received)
      : [];
    const sackText = sackBlocks.length > 0
      ? ` [SACK ${sackBlocks
        .map(block => (block.end - block.start === 1 ? `${block.start}` : `${block.start}-${block.end - 1}`))
        .join(',')}]`
      : '';

    if (duplicate) {
      dispatch(addLogEntry({
        text: `#${seqNum} 乱序到达（缺 #${ackSeq}），回重复 ACK ${ackSeq}${sackText}`,
        type: 'dup_ack',
      }));
      dispatch(setAnimationStatus(`#${seqNum} 乱序到达，回重复 ACK ${ackSeq}${sackText}`));
    } else {
      dispatch(setWindow(acknowledgePacket(stateRef.current.window, ackSeq)));
      dispatch(addLogEntry({
        text: `${retransmitted ? '重传包' : '数据包'} #${seqNum} 到达，累计 ACK ${ackSeq}${sackText}`,
        type: 'success',
      }));
      dispatch(setAnimationStatus(`#${seqNum} 到达，回 ACK ${ackSeq}${sackText}`));
    }

    const ackId = `${duplicate ? 'ack_dup' : 'ack'}_${seqNum}_${Date.now()}`;
    const ackBall: FlightBall = {
      id: ackId,
      progress: 0,
      trackY,
      isAck: true,
      isLost: false,
      isDuplicateAck: duplicate,
      sackBlocks: sackBlocks.length > 0 ? sackBlocks : undefined,
      seqNum: ackSeq,
      startTime: nowMs(),
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

    if (!duplicate) {
      // 缺口已补上，旧的重复 ACK 计数作废
      duplicateAckCountRef.current.delete(seqNum);

      const latest = stateRef.current;
      if (latest.phase === CongestionPhase.FAST_RECOVERY) {
        // ACK 只推进了一部分（还有包没到）
        if (isPartialAck(ackSeq, latest.window.nextSeq)) {
          dispatch(incrementPartialAck());
          const wake = fastRetransmitWaitersRef.current.get(ackSeq);
          if (wake) {
            // NewReno：立即补发新的缺口，窗口不再降
            dispatch(setAnimationStatus(`部分 ACK ${ackSeq}，快速恢复中继续补发`));
            dispatch(addLogEntry({
              text: `部分 ACK ${ackSeq}（还有包未确认），立即补发 #${ackSeq}`,
              type: 'partial_ack',
            }));
            wake('partial');
          } else {
            // SACK 已经提前在补这个缺口了
            dispatch(setAnimationStatus(`部分 ACK ${ackSeq}，缺口已在补发中`));
            dispatch(addLogEntry({
              text: `部分 ACK ${ackSeq}，缺口已在补发中`,
              type: 'partial_ack',
            }));
          }
          return;
        }

        dispatch(setPhase(CongestionPhase.CONGESTION_AVOIDANCE));
        dispatch(setAnimationStatus(`快恢复结束，#${seqNum} 已确认，回到拥塞避免`));
      }
      return;
    }

    // ── 重复 ACK：同一个缺口累计到 3 个就触发快重传 ──
    // 计数只增不减：3 个之后仍会继续计数（真实 TCP 也数），但只在前 3 个时打日志，
    // 否则重复 ACK 成批到达时会把 "1/3、2/3、3/3" 重复打好几遍。
    const count = (duplicateAckCountRef.current.get(ackSeq) ?? 0) + 1;
    duplicateAckCountRef.current.set(ackSeq, count);
    dispatch(incrementDuplicateAck());

    if (count <= 3) {
      dispatch(setAnimationStatus(`重复 ACK ${ackSeq}（${count}/3）`));
      dispatch(addLogEntry({ text: `重复 ACK ${ackSeq}（${count}/3）`, type: 'dup_ack' }));
    }

    if (count === 3) {
      if (stateRef.current.sackEnabled) {
        // SACK：一次算出窗口里所有缺口，一起补发（第一个走降窗，其余保持窗口）
        const lastSent = stateRef.current.window.nextSeq - 1;
        const holes = missingSeqs(ackSeq, sackBlocks, lastSent).slice(0, MAX_SACK_RETRANSMIT);
        const wakeable = holes.filter(hole => fastRetransmitWaitersRef.current.has(hole));

        dispatch(addLogEntry({
          text: `SACK 显示缺口 ${wakeable.map(hole => `#${hole}`).join('、')}，一次补齐`,
          type: 'sack',
        }));
        dispatch(setAnimationStatus(`SACK 缺口 ${wakeable.map(hole => `#${hole}`).join('、')}，同时补发`));

        wakeable.forEach((hole, index) => {
          fastRetransmitWaitersRef.current.get(hole)?.(index === 0 ? 'fast' : 'partial');
        });
      } else {
        const wake = fastRetransmitWaitersRef.current.get(ackSeq);
        if (wake) wake('fast');
      }
    }
  }, [dispatch, isActive, startFlight, getDur, nowMs]);

  /**
   * 等待该丢包被唤醒（3 个重复 ACK 或快速恢复中的部分确认）。
   * 终止时同样 settle，避免 Promise 悬挂。
   */
  const waitForRetransmit = useCallback((seqNum: number) => {
    let settle: (mode: WakeMode) => void = () => {};
    const promise = new Promise<WakeMode>(resolve => { settle = resolve; });

    const finish = (mode: WakeMode) => {
      fastRetransmitWaitersRef.current.delete(seqNum);
      abortHandlersRef.current.delete(onAbort);
      settle(mode);
    };
    const onAbort = () => finish('fast');

    fastRetransmitWaitersRef.current.set(seqNum, finish);
    abortHandlersRef.current.add(onAbort);

    return {
      promise,
      dispose: () => {
        fastRetransmitWaitersRef.current.delete(seqNum);
        abortHandlersRef.current.delete(onAbort);
      },
    };
  }, []);

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
      dropSeqs: current.dropSeqs,
    };
    const lost = shouldDropPacket(lossConfig, seqNum);
    if (lost && lossConfig.dropSeqs.includes(seqNum)) dispatch(removeDropSeq(seqNum));

    const id = `${isRetransmission ? 'rtx' : 'ball'}_${seqNum}_${attempt}_${Date.now()}`;
    const now = nowMs();
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

    // ── 正常到达：等小球飞完，交接收端回 ACK ──
    if (!lost) {
      const result = await flight.promise;
      if (result !== 'arrived' || !isActive(token)) return;
      await deliverPacket(seqNum, trackY, id, isRetransmission, token);
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

    // RTO 从发送时刻起算；期间收到 3 个重复 ACK（或快速恢复中的部分确认）就提前重传
    const remainingRto = Math.max(0, getDur(current.rtoConfig.baseMs) - lostAt);
    const wake = waitForRetransmit(seqNum);
    const outcome = await Promise.race([
      sleep(remainingRto, token).then(() => 'timeout' as const),
      wake.promise,
    ]);
    wake.dispose();
    if (!isActive(token)) return;

    if (outcome !== 'timeout') {
      dispatch(removeFlightBall(id));

      if (outcome === 'fast') {
        // ── 快重传：3 个重复 ACK，窗口减半进入快速恢复 ──
        dispatch(incrementFastRetransmit());
        windowReducedThisRttRef.current = true;
        const fastResult = handleFastRetransmit(stateRef.current.window);
        dispatch(setWindow(fastResult.window));
        dispatch(setPhase(fastResult.phase));
        dispatch(setAnimationStatus(
          `#${seqNum} 收到 3 个重复 ACK，快重传（cwnd=${fastResult.window.cwnd}，进入快速恢复）`,
        ));
        dispatch(addLogEntry({
          text: `3 个重复 ACK → 快重传 #${seqNum}，跳过 RTO，进入快速恢复`,
          type: 'fast_retransmit',
        }));
      } else {
        // ── 非首个缺口（NewReno 部分确认 / SACK 的后续缺口）：只补发，窗口保持不动 ──
        dispatch(setAnimationStatus(`补发 #${seqNum}（窗口保持 ${stateRef.current.window.cwnd}）`));
        dispatch(addLogEntry({
          text: `补发 #${seqNum}，cwnd 保持 ${stateRef.current.window.cwnd}`,
          type: 'partial_ack',
        }));
      }

      if (!canRetransmit(attempt, stateRef.current.rtoConfig.maxRetransmissions)) {
        dispatch(addLogEntry({
          text: `#${seqNum} 连续 ${attempt} 次发送失败，放弃重传`,
          type: 'error',
        }));
        return;
      }

      dispatch(enqueueRetransmission({
        seqNum,
        attempt: attempt + 1,
        originalBallId: id,
      }));
      await transmit(seqNum, trackY, attempt + 1, token);
      return;
    }

    dispatch(incrementTimeout());
    dispatch(removeFlightBall(id));

    // 同一轮里多包丢失属于同一次拥塞事件，窗口只降一次
    if (!windowReducedThisRttRef.current) {
      windowReducedThisRttRef.current = true;
      const timeoutResult = handleTimeoutLoss(stateRef.current.window);
      dispatch(setWindow(timeoutResult.window));
      dispatch(setPhase(timeoutResult.phase));
      dispatch(setAnimationStatus(`#${seqNum} RTO 超时，cwnd 降为 1`));
      dispatch(addLogEntry({
        text: `#${seqNum} RTO 超时：cwnd 降为 1、ssthresh 减半，进入慢启动`,
        type: 'timeout',
      }));
    } else {
      dispatch(setAnimationStatus(`#${seqNum} RTO 超时`));
      dispatch(addLogEntry({
        text: `#${seqNum} 同样超时：本轮拥塞窗口已降过，不重复减半`,
        type: 'timeout',
      }));
    }

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
  }, [dispatch, isActive, sleep, startFlight, deliverPacket, waitForRetransmit, getDur, nowMs]);

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
      tasks.push(transmit(seqNum, laneY(i, count), 1, token));
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

    windowReducedThisRttRef.current = false;
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
    await sleep(getDur(200), token);
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
    sackEnabled: boolean;
    lossRate: number;
    dropSeqs: number[];
  }) => {
    dispatch(setPacketLossEnabled(controls.packetLossEnabled));
    dispatch(setSackEnabled(controls.sackEnabled));
    dispatch(setLossRate(controls.lossRate));
    dispatch(setDropSeqs(controls.dropSeqs));
  }, [dispatch]);

  const performFullDemo = useCallback(async () => {
    if (stateRef.current.isPlaying) return;

    const controls = {
      packetLossEnabled: stateRef.current.packetLossEnabled,
      sackEnabled: stateRef.current.sackEnabled,
      lossRate: stateRef.current.lossRate,
      dropSeqs: stateRef.current.dropSeqs,
    };

    cancelRun();
    dispatch(reset());
    restoreLossControls(controls);
    // 演示把 ssthresh 收在 12，窗口最多长到 16 个包，画布上还能看清单个球。
    // 必须在等待前 dispatch：stateRef 要等一次渲染才更新，演示第一轮会读到旧窗口。
    dispatch(setWindow({ ...createWindow(), ssthresh: DEMO_SSTHRESH }));

    const token = runTokenRef.current;
    await sleep(50, token);
    if (!isActive(token)) return;

    dispatch(setPlaying(true));
    dispatch(setPhase(CongestionPhase.SLOW_START));

    for (let i = 0; i < 9; i++) {
      if (!isActive(token)) return;
      await runRttCycle(token);
      await sleep(getDur(500), token);
    }

    if (!isActive(token)) return;
    dispatch(setAnimationStatus('拥塞控制演示结束'));
    dispatch(setPlaying(false));
  }, [dispatch, isActive, cancelRun, sleep, restoreLossControls, runRttCycle, getDur]);

  const performSlowStart = useCallback(async () => {
    if (stateRef.current.isPlaying) return;

    const controls = {
      packetLossEnabled: stateRef.current.packetLossEnabled,
      sackEnabled: stateRef.current.sackEnabled,
      lossRate: stateRef.current.lossRate,
      dropSeqs: stateRef.current.dropSeqs,
    };

    cancelRun();
    dispatch(reset());
    restoreLossControls(controls);
    // 同上：dispatch 后要等一次渲染，stateRef 才会带上演示用的窗口参数
    dispatch(setWindow({ ...createWindow(), ssthresh: DEMO_SSTHRESH }));

    const token = runTokenRef.current;
    await sleep(50, token);
    if (!isActive(token)) return;

    dispatch(setPlaying(true));
    dispatch(setPhase(CongestionPhase.SLOW_START));

    for (let i = 0; i < 8; i++) {
      if (!isActive(token)) return;
      await runRttCycle(token);
      await sleep(getDur(450), token);
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

  const toggleSack = useCallback(() => {
    const enabled = !stateRef.current.sackEnabled;
    dispatch(setSackEnabled(enabled));
    dispatch(setAnimationStatus(
      enabled ? '选择确认（SACK）开启：一次补齐所有缺口' : '选择确认关闭：按 NewReno 逐个补发',
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
    togglePause,
    togglePacketLoss,
    toggleSack,
    setPlaying: (value: boolean) => dispatch(setPlaying(value)),
    setLossRate: (value: number) => dispatch(setLossRate(value)),
    setDropSeqs: (value: number[]) => dispatch(setDropSeqs(value)),
  };
}


