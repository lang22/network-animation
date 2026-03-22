import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TcpConnection, TcpConnectionState, NetworkPacket } from '@/types/networkTypes';
import { PacketType } from '@/styles/theme';

// 活动数据包（用于动画显示）
export interface ActivePacket {
    id: string;
    type: PacketType;
    position: { x: number; y: number };
    targetPosition: { x: number; y: number };
    startTime: number;
    duration: number;
    seqNum?: number;
    ackNum?: number;
    completed: boolean;
    direction: 'right' | 'left';  // 移动方向
}

// 动画 UI 状态
export interface AnimationUIState {
    clientActive: boolean;
    serverActive: boolean;
    connectionLineActive: boolean;
    activePackets: ActivePacket[];
    activeLayers: string[];
    containerSize: { width: number; height: number };
    clientState: TcpConnectionState | null;
    serverState: TcpConnectionState | null;
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

// 错误状态
export interface ErrorState {
    hasError: boolean;
    message: string;
    details?: string;
    phase?: 'handshake' | 'data' | 'close';
}

export interface SimulationState {
    isPlaying: boolean;
    connection: TcpConnection | null;
    animationStatus: string;
    animationUI: AnimationUIState;
    packetHistory: PacketHistoryItem[];
    selectedPacket: NetworkPacket | null;
    currentPhase: 'idle' | 'handshake' | 'data' | 'close';
    timelineSteps: TimelineStep[];
    error: ErrorState;
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
    activePackets: [],
    activeLayers: [],
    containerSize: { width: 800, height: 600 },
    clientState: null,
    serverState: null,
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
    error: { hasError: false, message: '' },
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
        addActivePacket: (state, action: PayloadAction<ActivePacket>) => {
            state.animationUI.activePackets.push(action.payload);
        },
        updateActivePacket: (state, action: PayloadAction<{ id: string; position: { x: number; y: number } }>) => {
            const packet = state.animationUI.activePackets.find(p => p.id === action.payload.id);
            if (packet) {
                packet.position = action.payload.position;
            }
        },
        completeActivePacket: (state, action: PayloadAction<string>) => {
            const packet = state.animationUI.activePackets.find(p => p.id === action.payload);
            if (packet) {
                packet.completed = true;
            }
        },
        removeActivePacket: (state, action: PayloadAction<string>) => {
            state.animationUI.activePackets = state.animationUI.activePackets.filter(
                p => p.id !== action.payload
            );
        },
        clearActivePackets: (state) => {
            state.animationUI.activePackets = [];
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
        setClientState: (state, action: PayloadAction<TcpConnectionState | null>) => {
            state.animationUI.clientState = action.payload;
        },
        setServerState: (state, action: PayloadAction<TcpConnectionState | null>) => {
            state.animationUI.serverState = action.payload;
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
            state.error = { hasError: false, message: '' };
        },
        setError: (state, action: PayloadAction<ErrorState>) => {
            state.error = action.payload;
            state.isPlaying = false;
        },
        clearError: (state) => {
            state.error = { hasError: false, message: '' };
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
    addActivePacket,
    updateActivePacket,
    completeActivePacket,
    removeActivePacket,
    clearActivePackets,
    setActiveLayers,
    setClientActive,
    setServerActive,
    setConnectionLineActive,
    setClientState,
    setServerState,
    setContainerSize,
    addPacketToHistory,
    clearPacketHistory,
    setSelectedPacket,
    setCurrentPhase,
    setTimelineSteps,
    updateTimelineStep,
    resetTimeline,
    reset,
    setError,
    clearError,
} = simulationSlice.actions;

export default simulationSlice.reducer;