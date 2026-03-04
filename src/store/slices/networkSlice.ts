import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// 网络节点类型
export interface NetworkNode {
  id: string;
  type: 'client' | 'server' | 'router' | 'switch';
  label: string;
  ip?: string;
  mac?: string;
  position: { x: number; y: number };
}

// 网络连接类型
export interface NetworkConnection {
  id: string;
  source: string;
  target: string;
  active: boolean;
}

// 拓扑类型
export type TopologyType = 'star' | 'mesh' | 'ring' | 'bus' | 'tree';

interface NetworkState {
  nodes: NetworkNode[];
  connections: NetworkConnection[];
  topology: TopologyType;
  activeNodeId: string | null;
}

const initialState: NetworkState = {
  nodes: [],
  connections: [],
  topology: 'star',
  activeNodeId: null,
};

export const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    addNode: (state, action: PayloadAction<NetworkNode>) => {
      state.nodes.push(action.payload);
    },
    removeNode: (state, action: PayloadAction<string>) => {
      state.nodes = state.nodes.filter(node => node.id !== action.payload);
      // 同时移除相关的连接
      state.connections = state.connections.filter(
        conn => conn.source !== action.payload && conn.target !== action.payload
      );
    },
    updateNodePosition: (state, action: PayloadAction<{ id: string; position: { x: number; y: number } }>) => {
      const node = state.nodes.find(n => n.id === action.payload.id);
      if (node) {
        node.position = action.payload.position;
      }
    },
    addConnection: (state, action: PayloadAction<NetworkConnection>) => {
      state.connections.push(action.payload);
    },
    removeConnection: (state, action: PayloadAction<string>) => {
      state.connections = state.connections.filter(conn => conn.id !== action.payload);
    },
    setConnectionActive: (state, action: PayloadAction<{ id: string; active: boolean }>) => {
      const conn = state.connections.find(c => c.id === action.payload.id);
      if (conn) {
        conn.active = action.payload.active;
      }
    },
    setTopology: (state, action: PayloadAction<TopologyType>) => {
      state.topology = action.payload;
    },
    setActiveNode: (state, action: PayloadAction<string | null>) => {
      state.activeNodeId = action.payload;
    },
    reset: (state) => {
      state.nodes = [];
      state.connections = [];
      state.activeNodeId = null;
    },
  },
});

export const {
  addNode,
  removeNode,
  updateNodePosition,
  addConnection,
  removeConnection,
  setConnectionActive,
  setTopology,
  setActiveNode,
  reset,
} = networkSlice.actions;

export default networkSlice.reducer;