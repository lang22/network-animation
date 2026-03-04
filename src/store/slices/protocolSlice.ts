import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Protocol, ProtocolInfo } from '@/types/protocolTypes';

interface ProtocolState {
  selectedProtocol: string | null;
  protocols: Record<string, ProtocolInfo>;
}

const initialState: ProtocolState = {
  selectedProtocol: null,
  protocols: {},
};

export const protocolSlice = createSlice({
  name: 'protocol',
  initialState,
  reducers: {
    selectProtocol: (state, action: PayloadAction<string>) => {
      state.selectedProtocol = action.payload;
    },
    clearSelectedProtocol: (state) => {
      state.selectedProtocol = null;
    },
    addProtocol: (state, action: PayloadAction<ProtocolInfo>) => {
      state.protocols[action.payload.id] = action.payload;
    },
    removeProtocol: (state, action: PayloadAction<string>) => {
      delete state.protocols[action.payload];
    },
  },
});

export const { selectProtocol, clearSelectedProtocol, addProtocol, removeProtocol } = protocolSlice.actions;

export default protocolSlice.reducer;