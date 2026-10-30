import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  CongestionState,
  CongestionPhase,
  ScenarioMode,
  FlightBall,
  CwndRecord,
  SenderWindowState,
  LogEntry,
  InFlightPacket,
  RetransmissionItem,
} from '@/types/congestionTypes';

const initialState: CongestionState = {
  isPlaying: false,
  scenario: ScenarioMode.FULL_DEMO,
  phase: CongestionPhase.SLOW_START,
  window: {
    cwnd: 1,
    ssthresh: 64,
    lastAcked: 0,
    nextSeq: 1,
    allowedToSend: 1,
  },
  flightBalls: [],
  cwndHistory: [],
  rttCount: 0,
  lostPackets: 0,
  ackedPackets: 0,
  packetLossEnabled: false,
  inFlightPackets: [],
  retransmissionQueue: [],
  rtoConfig: {
    // 必须明显长于一个 RTT（飞行 3s + ACK 2s），否则重复 ACK 还没回来就 RTO 了
    baseMs: 8000,
    maxRetransmissions: 3,
  },
  lossRate: 0.05,
  dropSeqs: [],
  timeoutCount: 0,
  retransmissionCount: 0,
  duplicateAcks: 0,
  fastRetransmits: 0,
  partialAcks: 0,
  animationStatus: '',
  eventLog: [],
  logSeq: 0,
};

export const congestionSlice = createSlice({
  name: 'congestion',
  initialState,
  reducers: {
    setPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },
    setScenario: (state, action: PayloadAction<ScenarioMode>) => {
      state.scenario = action.payload;
    },
    setPhase: (state, action: PayloadAction<CongestionPhase>) => {
      state.phase = action.payload;
    },
    setWindow: (state, action: PayloadAction<SenderWindowState>) => {
      state.window = action.payload;
    },
    addFlightBall: (state, action: PayloadAction<FlightBall>) => {
      state.flightBalls.push(action.payload);
    },
    updateFlightBall: (state, action: PayloadAction<{ id: string; progress: number }>) => {
      const ball = state.flightBalls.find(b => b.id === action.payload.id);
      if (ball) ball.progress = action.payload.progress;
    },
    markBallLost: (state, action: PayloadAction<string>) => {
      const ball = state.flightBalls.find(b => b.id === action.payload);
      if (ball) ball.isLost = true;
    },
    removeFlightBall: (state, action: PayloadAction<string>) => {
      state.flightBalls = state.flightBalls.filter(b => b.id !== action.payload);
    },
    clearFlightBalls: (state) => {
      state.flightBalls = [];
    },
    trackPacketSent: (state, action: PayloadAction<InFlightPacket>) => {
      state.inFlightPackets = state.inFlightPackets.filter(p => p.seqNum !== action.payload.seqNum);
      state.inFlightPackets.push(action.payload);
    },
    markTrackedPacketLost: (state, action: PayloadAction<number>) => {
      const packet = state.inFlightPackets.find(p => p.seqNum === action.payload);
      if (packet) packet.status = 'lost';
    },
    markPacketWaitingTimeout: (state, action: PayloadAction<number>) => {
      const packet = state.inFlightPackets.find(p => p.seqNum === action.payload);
      if (packet) packet.status = 'waiting_timeout';
    },
    markPacketAcked: (state, action: PayloadAction<number>) => {
      state.inFlightPackets = state.inFlightPackets.filter(p => p.seqNum !== action.payload);
      state.ackedPackets += 1;
    },
    enqueueRetransmission: (state, action: PayloadAction<RetransmissionItem>) => {
      state.retransmissionQueue = state.retransmissionQueue.filter(item => item.seqNum !== action.payload.seqNum);
      state.retransmissionQueue.push(action.payload);
    },
    dequeueRetransmission: (state, action: PayloadAction<number>) => {
      state.retransmissionQueue = state.retransmissionQueue.filter(item => item.seqNum !== action.payload);
    },
    addCwndRecord: (state, action: PayloadAction<CwndRecord>) => {
      state.cwndHistory.push(action.payload);
    },
    incrementRtt: (state) => {
      state.rttCount += 1;
    },
    incrementLost: (state) => {
      state.lostPackets += 1;
    },
    incrementAcked: (state) => {
      state.ackedPackets += 1;
    },
    setPacketLossEnabled: (state, action: PayloadAction<boolean>) => {
      state.packetLossEnabled = action.payload;
    },
    setLossRate: (state, action: PayloadAction<number>) => {
      state.lossRate = Math.max(0, Math.min(1, action.payload));
    },
    setDropSeqs: (state, action: PayloadAction<number[]>) => {
      state.dropSeqs = action.payload;
    },
    removeDropSeq: (state, action: PayloadAction<number>) => {
      state.dropSeqs = state.dropSeqs.filter(seq => seq !== action.payload);
    },
    incrementTimeout: (state) => {
      state.timeoutCount += 1;
    },
    incrementRetransmission: (state) => {
      state.retransmissionCount += 1;
    },
    incrementDuplicateAck: (state) => {
      state.duplicateAcks += 1;
    },
    incrementFastRetransmit: (state) => {
      state.fastRetransmits += 1;
    },
    incrementPartialAck: (state) => {
      state.partialAcks += 1;
    },
    setAnimationStatus: (state, action: PayloadAction<string>) => {
      state.animationStatus = action.payload;
    },
    addLogEntry: (state, action: PayloadAction<{ text: string; type: LogEntry['type'] }>) => {
      state.logSeq += 1;
      state.eventLog.push({ id: state.logSeq, text: action.payload.text, type: action.payload.type });
      // 保留最近 50 条
      if (state.eventLog.length > 50) {
        state.eventLog = state.eventLog.slice(-40);
      }
    },
    reset: () => initialState,
  },
});

export const {
  setPlaying,
  setScenario,
  setPhase,
  setWindow,
  addFlightBall,
  updateFlightBall,
  markBallLost,
  removeFlightBall,
  clearFlightBalls,
  trackPacketSent,
  markTrackedPacketLost,
  markPacketWaitingTimeout,
  markPacketAcked,
  enqueueRetransmission,
  dequeueRetransmission,
  addCwndRecord,
  incrementRtt,
  incrementLost,
  incrementAcked,
  setPacketLossEnabled,
  setLossRate,
  setDropSeqs,
  removeDropSeq,
  incrementTimeout,
  incrementRetransmission,
  incrementDuplicateAck,
  incrementFastRetransmit,
  incrementPartialAck,
  setAnimationStatus,
  addLogEntry,
  reset,
} = congestionSlice.actions;

export default congestionSlice.reducer;
