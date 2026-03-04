import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TcpConnection, TcpConnectionState, NetworkPacket } from '@/types/networkTypes';
import { PacketType } from '@/styles/theme';

// 动画 UI 状态
export interface AnimationUIState {
    clientActive: boolean;
    serverActive: boolean;
    connectionLineActive: boolean;
    packetPosition: { x: number; y: number };
    currentPacketType: PacketType;
    activeLayers: string[];
    containerSize: { width: number; height: number };
}

// 时间线步骤
export interface TimelineStep {
    id: string;
    label: string;
    description?: string;
    completed: boolean;
    active: boolean;
}

// 数据包历史记录
export interface PacketHistoryItem {
    id: string;
    packet: NetworkPacket;
    timestamp: number;
    phase: 'handshake' | 'data' | 'close';
}

interface SimulationState {
    isPlaying: boolean;
    connection: TcpConnection | null;
    animationStatus: string;
    animationUI: AnimationUIState;
    packetHistory: PacketHistoryItem[];
    selectedPacket: NetworkPacket | null;
    currentPhase: 'idle' | 'handshake' | 'data' | 'close';
    timelineSteps: TimelineStep[];
}

const handshakeSteps: TimelineStep[] = [
    { id: 'syn', label: 'SYN', description: '客户端发起', completed: false, active: false },
    { id: 'syn-ack', label: 'SYN-ACK', description: '服务器响应', completed: false, active: false },
    { id: 'ack', label: 'ACK', description: '连接建立', completed: false, active: false },
];

const dataSteps: TimelineStep[] = [
    { id: 'data', label: 'DATA', description: '发送数据', completed: false, active: false },
    { id: 'data-ack', label: 'ACK', description: '确认收到', completed: false, active: false },
];

const closeSteps: TimelineStep[] = [
    { id: 'fin1', label: 'FIN', description: '客户端关闭', completed: false, active: false },
    { id: 'ack1', label: 'ACK', description: '服务器确认', completed: false, active: false },
    { id: 'fin2', label: 'FIN', description: '服务器关闭', completed: false, active: false },
    { id: 'ack2', label: 'ACK', description: '客户端确认', completed: false, active: false },
];

const initialAnimationUI: AnimationUIState = {
    clientActive: false,
    serverActive: false,
    connectionLineActive: false,
    packetPosition: { x: 15, y: 50 },
    currentPacketType: 'SYN' as PacketType,
    activeLayers: [],
    containerSize: { width: 800, height: 600 },
};

const initialState: SimulationState = {
    isPlaying: false,
    connection: null,
    animationStatus: '',
    animationUI: initialAnimationUI,
    packetHistory: [],
    selectedPacket: null,
    currentPhase: 'idle',
    timelineSteps: [],
};

export const simulationSlice = createSlice({
    name: 'simulation',
    initialState,
    reducers: {
        play: (state) => {
            state.isPlaying = true;
        },
        pause: (state) => {
            state.isPlaying = false;
        },
        setConnection: (state, action: PayloadAction<TcpConnection | null>) => {
            state.connection = action.payload;
        },
        updateConnectionState: (state, action: PayloadAction<TcpConnectionState>) => {
            if (state.connection) {
                state.connection.state = action.payload;
            }
        },
        setAnimationStatus: (state, action: PayloadAction<string>) => {
            state.animationStatus = action.payload;
        },
        setAnimationUI: (state, action: PayloadAction<Partial<AnimationUIState>>) => {
            state.animationUI = { ...state.animationUI, ...action.payload };
        },
        setPacketPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
            state.animationUI.packetPosition = action.payload;
        },
        setPacketType: (state, action: PayloadAction<PacketType>) => {
            state.animationUI.currentPacketType = action.payload;
        },
        setActiveLayers: (state, action: PayloadAction<string[]>) => {
            state.animationUI.activeLayers = action.payload;
        },
        setClientActive: (state, action: PayloadAction<boolean>) => {
            state.animationUI.clientActive = action.payload;
        },
        setServerActive: (state, action: PayloadAction<boolean>) => {
            state.animationUI.serverActive = action.payload;
        },
        setConnectionLineActive: (state, action: PayloadAction<boolean>) => {
            state.animationUI.connectionLineActive = action.payload;
        },
        setContainerSize: (state, action: PayloadAction<{ width: number; height: number }>) => {
            state.animationUI.containerSize = action.payload;
        },
        addPacketToHistory: (state, action: PayloadAction<PacketHistoryItem>) => {
            state.packetHistory.push(action.payload);
        },
        clearPacketHistory: (state) => {
            state.packetHistory = [];
        },
        setSelectedPacket: (state, action: PayloadAction<NetworkPacket | null>) => {
            state.selectedPacket = action.payload;
        },
        setCurrentPhase: (state, action: PayloadAction<'idle' | 'handshake' | 'data' | 'close'>) => {
            state.currentPhase = action.payload;
            // 根据 phase 设置时间线步骤
            switch (action.payload) {
                case 'handshake':
                    state.timelineSteps = handshakeSteps.map(s => ({ ...s }));
                    break;
                case 'data':
                    state.timelineSteps = dataSteps.map(s => ({ ...s }));
                    break;
                case 'close':
                    state.timelineSteps = closeSteps.map(s => ({ ...s }));
                    break;
                default:
                    state.timelineSteps = [];
            }
        },
        setTimelineSteps: (state, action: PayloadAction<TimelineStep[]>) => {
            state.timelineSteps = action.payload;
        },
        updateTimelineStep: (state, action: PayloadAction<{ id: string; completed?: boolean; active?: boolean }>) => {
            const step = state.timelineSteps.find(s => s.id === action.payload.id);
            if (step) {
                if (action.payload.completed !== undefined) step.completed = action.payload.completed;
                if (action.payload.active !== undefined) step.active = action.payload.active;
            }
        },
        resetTimeline: (state) => {
            state.timelineSteps = state.timelineSteps.map(s => ({ ...s, completed: false, active: false }));
        },
        reset: (state) => {
            state.isPlaying = false;
            state.connection = null;
            state.animationStatus = '';
            state.animationUI = initialAnimationUI;
            state.packetHistory = [];
            state.selectedPacket = null;
            state.currentPhase = 'idle';
            state.timelineSteps = [];
        },
    },
});

export const {
    play,
    pause,
    setConnection,
    updateConnectionState,
    setAnimationStatus,
    setAnimationUI,
    setPacketPosition,
    setPacketType,
    setActiveLayers,
    setClientActive,
    setServerActive,
    setConnectionLineActive,
    setContainerSize,
    addPacketToHistory,
    clearPacketHistory,
    setSelectedPacket,
    setCurrentPhase,
    setTimelineSteps,
    updateTimelineStep,
    resetTimeline,
    reset,
} = simulationSlice.actions;

export default simulationSlice.reducer;