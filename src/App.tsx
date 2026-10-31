import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import Home from '@/containers/Home';
import Simulation from '@/containers/Simulation';
import ProtocolDetail from '@/containers/ProtocolDetail';
import CongestionVisualizer from '@/components/CongestionControl/CongestionVisualizer';
import HttpVisualizer from '@/components/Http/HttpVisualizer';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/protocol/tcp" element={<Simulation />} />
          <Route path="/protocol/congestion" element={<CongestionVisualizer />} />
          <Route path="/protocol/http" element={<HttpVisualizer />} />
          <Route path="/protocol/:id" element={<ProtocolDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
};

export default App;