import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import Home from '@/containers/Home';
import Simulation from '@/containers/Simulation';
import ProtocolDetail from '@/containers/ProtocolDetail';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/protocol/:id" element={<ProtocolDetail />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
};

export default App;