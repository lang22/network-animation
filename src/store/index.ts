import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import simulationReducer from './slices/simulationSlice';
import protocolReducer from './slices/protocolSlice';
import networkReducer from './slices/networkSlice';
import congestionReducer from './slices/congestionSlice';

export const store = configureStore({
  reducer: {
    simulation: simulationReducer,
    protocol: protocolReducer,
    network: networkReducer,
    congestion: congestionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// 类型化的 hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;