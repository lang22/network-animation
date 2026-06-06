import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  CongestionState,
  CongestionPhase,
  ScenarioMode,
  FlightBall,
  CwndRecord,
  SenderWindowState,
  LogEntry,
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
  addCwndRecord,
  incrementRtt,
  incrementLost,
  incrementAcked,
  setPacketLossEnabled,
  setAnimationStatus,
  addLogEntry,
  reset,
} = congestionSlice.actions;

export default congestionSlice.reducer;
