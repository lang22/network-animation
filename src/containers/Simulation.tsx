import React, { FC } from 'react';
import TcpProtocolVisualizer from '@/components/TcpProtocolVisualizer';

const Simulation: FC = () => {
  return (
    <div className="simulation">
      <h1>Protocol Simulation</h1>
      <div className="simulation-container">
        <TcpProtocolVisualizer />
      </div>
    </div>
  );
};

export default Simulation;