import { useCallback, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setPlaying,
  setScenario,
  setPhase,
  setWindow,
  addFlightBall,
  updateFlightBall,
  markBallLost,
  removeFlightBall,
  clearFlightBalls,
  addCwndRecord,
  incrementRtt,
  incrementLost,
  incrementAcked,
  setAnimationStatus,
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

const RTT_MS = 2500;       // 模拟RTT
const FLIGHT_MS = 1200;    // 数据包单程飞行时间（~RTT/2）
const ACK_MS = 1000;       // ACK回程时间
const TRACK_GAP = 8;       // 轨道间距(%)
const BASE_TRACK = 10;     // 起始轨道(%)

export function useCongestionControl(speed: number = 1) {
  const dispatch = useAppDispatch();
  const state = useAppSelector(s => s.congestion);
  const isMountedRef = useRef(true);
  const speedRef = useRef(speed);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => { speedRef.current = speed; }, [speed]);

  const getDur = useCallback((base: number) => base / speedRef.current, []);

  // 发送一批数据包
  const sendBatch = useCallback(async () => {
    const w = state.window;
    const count = w.allowedToSend;
    if (count <= 0 || !isMountedRef.current) return;

    const balls: FlightBall[] = [];
    for (let i = 0; i < count; i++) {
      const seq = w.nextSeq + i;
      const trackY = BASE_TRACK + ((seq - 1) % 12) * TRACK_GAP;
      const ball: FlightBall = {
        id: `ball_${seq}_${Date.now()}`,
        progress: 0,
        trackY,
        isAck: false,
        isLost: false,
        seqNum: seq,
        startTime: performance.now(),
        duration: getDur(FLIGHT_MS),
      };
      balls.push(ball);
      dispatch(addFlightBall(ball));
    }

    dispatch(setWindow({ ...w, nextSeq: w.nextSeq + count }));

    // 数据包飞行动画
    const startTime = performance.now();
    const duration = getDur(FLIGHT_MS);

    const animate = (now: number) => {
      if (!isMountedRef.current) return;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      balls.forEach(b => {
        if (!b.isLost) {
          dispatch(updateFlightBall({ id: b.id, progress }));
        }
      });

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        // 到达后：检查丢包，发送ACK
        balls.forEach(b => {
          if (shouldDropPacket(state.packetLossEnabled)) {
            dispatch(markBallLost(b.id));
            dispatch(incrementLost());
            // 丢包处理
            const result = handlePacketLoss(state.window);
            dispatch(setWindow(result.window));
            dispatch(setPhase(result.phase));
            dispatch(setAnimationStatus(`❌ 包 #${b.seqNum} 丢失！cwnd → ${result.window.cwnd}`));
            setTimeout(() => {
              if (isMountedRef.current) dispatch(removeFlightBall(b.id));
            }, 800);
          } else {
            // 确认包到达
            const newWindow = acknowledgePacket(state.window, b.seqNum);
            dispatch(setWindow(newWindow));
            dispatch(incrementAcked());

            // 发送ACK回程小球
            const ackBall: FlightBall = {
              id: `ack_${b.seqNum}_${Date.now()}`,
              progress: 0,
              trackY: b.trackY,
              isAck: true,
              isLost: false,
              seqNum: b.seqNum,
              startTime: performance.now(),
              duration: getDur(ACK_MS),
            };
            dispatch(addFlightBall(ackBall));

            setTimeout(() => {
              if (isMountedRef.current) dispatch(removeFlightBall(b.id));
            }, 150);
          }
        });
      }
    };

    frameRef.current = requestAnimationFrame(animate);
  }, [dispatch, state.window, state.packetLossEnabled, getDur]);

  // 发送ACK回程动画
  const sendAck = useCallback(async (ackBall: FlightBall) => {
    const ackStart = performance.now();
    const ackDuration = ackBall.duration;

    const animateAck = (now: number) => {
      if (!isMountedRef.current) return;
      const elapsed = now - ackStart;
      const progress = Math.min(elapsed / ackDuration, 1);
      dispatch(updateFlightBall({ id: ackBall.id, progress }));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animateAck);
      } else {
        setTimeout(() => {
          if (isMountedRef.current) dispatch(removeFlightBall(ackBall.id));
        }, 100);
      }
    };
    frameRef.current = requestAnimationFrame(animateAck);
  }, [dispatch]);

  // 一个RTT周期
  const runRttCycle = useCallback(async () => {
    if (!isMountedRef.current) return;
    dispatch(incrementRtt());
    dispatch(setAnimationStatus(`RTT #${state.rttCount + 1} — cwnd=${state.window.cwnd} — 发送 ${state.window.allowedToSend} 包`));

    // 记录历史
    dispatch(addCwndRecord({
      time: Date.now(),
      cwnd: state.window.cwnd,
      ssthresh: state.window.ssthresh,
    }));

    // 发送批量数据包
    await sendBatch();

    // 等待 ACK 返回
    await new Promise(resolve =>
      setTimeout(resolve, getDur(FLIGHT_MS + 500))
    );

    // 窗口增长
    const growth = growWindow(state.window, state.phase);
    dispatch(setWindow(growth.window));
    dispatch(setPhase(growth.phase));
    dispatch(setAnimationStatus(`cwnd → ${growth.window.cwnd} (${growth.phase === CongestionPhase.SLOW_START ? '慢启动' : '拥塞避免'})`));

    // 准备下一批
    const ready = prepareNextBatch(growth.window);
    dispatch(setWindow(ready));
  }, [dispatch, state.window, state.phase, state.rttCount, sendBatch, getDur]);

  // 完整演示
  const performFullDemo = useCallback(async () => {
    dispatch(reset());
    dispatch(setPlaying(true));
    dispatch(setScenario(ScenarioMode.FULL_DEMO));
    dispatch(setPhase(CongestionPhase.SLOW_START));

    const maxRtt = 12;
    for (let i = 0; i < maxRtt; i++) {
      if (!isMountedRef.current) break;
      await runRttCycle();
      await new Promise(resolve => setTimeout(resolve, getDur(600)));
    }

    dispatch(setAnimationStatus('✅ 拥塞控制演示完成'));
    dispatch(setPlaying(false));
  }, [dispatch, runRttCycle, getDur]);

  // 仅慢启动场景
  const performSlowStart = useCallback(async () => {
    dispatch(reset());
    dispatch(setPlaying(true));
    dispatch(setScenario(ScenarioMode.SLOW_START));
    dispatch(setPhase(CongestionPhase.SLOW_START));

    // 设一个低的ssthresh让慢启动阶段短一些
    dispatch(setWindow({ ...createWindow(), ssthresh: 16 }));

    for (let i = 0; i < 8; i++) {
      if (!isMountedRef.current) break;
      await runRttCycle();
      await new Promise(resolve => setTimeout(resolve, getDur(500)));
    }

    dispatch(setAnimationStatus('✅ 慢启动演示完成'));
    dispatch(setPlaying(false));
  }, [dispatch, runRttCycle, getDur]);

  const resetAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    dispatch(clearFlightBalls());
    dispatch(reset());
  }, [dispatch]);

  const togglePacketLoss = useCallback(() => {
    dispatch(setAnimationStatus(
      !state.packetLossEnabled ? '🔴 丢包模拟开启' : '丢包模拟关闭'
    ));
  }, [dispatch, state.packetLossEnabled]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return {
    ...state,
    performFullDemo,
    performSlowStart,
    resetAll,
    togglePacketLoss,
    setPlaying: (v: boolean) => dispatch(setPlaying(v)),
  };
}
