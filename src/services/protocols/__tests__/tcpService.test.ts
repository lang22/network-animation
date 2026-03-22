import { TcpService } from '../tcpService';
import { TcpConnectionState, TcpFlags } from '@/types/networkTypes';

describe('TcpService', () => {
  describe('createConnection', () => {
    it('should create a new TCP connection with correct properties', () => {
      const connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );

      expect(connection.sourceIp).toBe('192.168.1.10');
      expect(connection.destinationIp).toBe('192.168.1.20');
      expect(connection.sourcePort).toBe(54321);
      expect(connection.destinationPort).toBe(80);
      expect(connection.state).toBe(TcpConnectionState.CLOSED);
      expect(connection.windowSize).toBe(65535);
      expect(connection.id).toMatch(/^conn_/);
    });

    it('should generate unique connection IDs', () => {
      const conn1 = TcpService.createConnection('192.168.1.10', '192.168.1.20', 54321, 80);
      const conn2 = TcpService.createConnection('192.168.1.10', '192.168.1.20', 54321, 80);

      expect(conn1.id).not.toBe(conn2.id);
    });
  });

  describe('initiateHandshake', () => {
    it('should create SYN packet for handshake initiation', () => {
      const connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );

      const [updatedConn, packets] = TcpService.initiateHandshake(connection);

      expect(packets).toHaveLength(1);
      expect(packets[0].payload).toBe('SYN');
      expect(packets[0].tcpHeader?.flags).toBe(TcpFlags.SYN);
      expect(packets[0].tcpHeader?.sourcePort).toBe(54321);
      expect(packets[0].tcpHeader?.destinationPort).toBe(80);
      expect(packets[0].direction).toBe('request');
      expect(updatedConn.state).toBe(TcpConnectionState.SYN_SENT);
    });
  });

  describe('handleSynAndSendSynAck', () => {
    it('should create SYN-ACK packet in response to SYN', () => {
      const connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );

      const [, synPackets] = TcpService.initiateHandshake(connection);
      const [updatedConn, synAckPacket] = TcpService.handleSynAndSendSynAck(connection, synPackets[0]);

      expect(updatedConn.state).toBe(TcpConnectionState.SYN_RECEIVED);
      expect(synAckPacket.payload).toBe('SYN-ACK');
      expect(synAckPacket.tcpHeader?.flags).toBe(TcpFlags.SYN | TcpFlags.ACK);
      expect(synAckPacket.direction).toBe('response');
    });

    it('should update acknowledgment number correctly', () => {
      const connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );

      const [, synPackets] = TcpService.initiateHandshake(connection);
      const synPacket = synPackets[0];
      const [updatedConn] = TcpService.handleSynAndSendSynAck(connection, synPacket);

      expect(updatedConn.localAckNum).toBe(synPacket.tcpHeader!.sequenceNumber + 1);
    });
  });

  describe('handleSynAckAndSendAck', () => {
    it('should create ACK packet and establish connection', () => {
      const connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );

      const [, synPackets] = TcpService.initiateHandshake(connection);
      const [, synAckPacket] = TcpService.handleSynAndSendSynAck(connection, synPackets[0]);
      const [finalConn, ackPacket] = TcpService.handleSynAckAndSendAck(connection, synAckPacket);

      expect(finalConn.state).toBe(TcpConnectionState.ESTABLISHED);
      expect(ackPacket.payload).toBe('ACK');
      expect(ackPacket.tcpHeader?.flags).toBe(TcpFlags.ACK);
    });
  });

  describe('sendData', () => {
    it('should throw error when connection is not established', () => {
      const connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );

      expect(() => TcpService.sendData(connection, 'test data')).toThrow('Connection is not established');
    });

    it('should create data packet when connection is established', () => {
      let connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );
      connection = { ...connection, state: TcpConnectionState.ESTABLISHED };

      const [updatedConn, dataPacket] = TcpService.sendData(connection, 'test data');

      expect(dataPacket.payload).toBe('test data');
      expect(dataPacket.tcpHeader?.flags).toBe(TcpFlags.ACK);
      expect(updatedConn.localSeqNum).toBe(connection.localSeqNum + 9); // 'test data' length
    });
  });

  describe('initiateClose', () => {
    it('should throw error when connection is not established', () => {
      const connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );

      expect(() => TcpService.initiateClose(connection)).toThrow('Connection is not established');
    });

    it('should create FIN packet and update state to FIN_WAIT_1', () => {
      let connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );
      connection = { ...connection, state: TcpConnectionState.ESTABLISHED };

      const [updatedConn, finPacket] = TcpService.initiateClose(connection);

      expect(updatedConn.state).toBe(TcpConnectionState.FIN_WAIT_1);
      expect(finPacket.payload).toBe('FIN');
      expect(finPacket.tcpHeader?.flags).toBe(TcpFlags.FIN | TcpFlags.ACK);
    });
  });

  describe('handleFinAndSendAck', () => {
    it('should create ACK packet and update state to CLOSE_WAIT', () => {
      const connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );

      const finPacket = {
        id: 'test_fin',
        source: '192.168.1.10:54321',
        destination: '192.168.1.20:80',
        payload: 'FIN',
        timestamp: Date.now(),
        tcpHeader: {
          sourcePort: 54321,
          destinationPort: 80,
          sequenceNumber: 1000,
          acknowledgmentNumber: 0,
          headerLength: 5,
          flags: TcpFlags.FIN | TcpFlags.ACK,
          windowSize: 65535,
          checksum: 0,
          urgentPointer: 0,
        },
        layer: 'transport' as const,
        direction: 'request' as const,
      };

      const [updatedConn, ackPacket] = TcpService.handleFinAndSendAck(connection, finPacket);

      expect(updatedConn.state).toBe(TcpConnectionState.CLOSE_WAIT);
      expect(ackPacket.payload).toBe('ACK');
      expect(ackPacket.tcpHeader?.flags).toBe(TcpFlags.ACK);
    });
  });

  // 服务器主动关闭连接场景测试
  describe('serverInitiateClose', () => {
    it('should throw error when connection is not established', () => {
      const connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );

      expect(() => TcpService.serverInitiateClose(connection)).toThrow('Connection is not established');
    });

    it('should create FIN packet from server and update state to FIN_WAIT_1', () => {
      let connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );
      connection = { ...connection, state: TcpConnectionState.ESTABLISHED };

      const [updatedConn, finPacket] = TcpService.serverInitiateClose(connection);

      expect(updatedConn.state).toBe(TcpConnectionState.FIN_WAIT_1);
      expect(finPacket.payload).toBe('FIN');
      expect(finPacket.tcpHeader?.flags).toBe(TcpFlags.FIN | TcpFlags.ACK);
      expect(finPacket.direction).toBe('response');
      expect(finPacket.source).toBe('192.168.1.20:80');
      expect(finPacket.destination).toBe('192.168.1.10:54321');
    });
  });

  describe('clientHandleServerFinAndSendAck', () => {
    it('should create ACK packet and update state to CLOSE_WAIT', () => {
      const connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );

      const serverFinPacket = {
        id: 'server_fin',
        source: '192.168.1.20:80',
        destination: '192.168.1.10:54321',
        payload: 'FIN',
        timestamp: Date.now(),
        tcpHeader: {
          sourcePort: 80,
          destinationPort: 54321,
          sequenceNumber: 2000,
          acknowledgmentNumber: 100,
          headerLength: 5,
          flags: TcpFlags.FIN | TcpFlags.ACK,
          windowSize: 65535,
          checksum: 0,
          urgentPointer: 0,
        },
        layer: 'transport' as const,
        direction: 'response' as const,
      };

      const [updatedConn, ackPacket] = TcpService.clientHandleServerFinAndSendAck(connection, serverFinPacket);

      expect(updatedConn.state).toBe(TcpConnectionState.CLOSE_WAIT);
      expect(ackPacket.payload).toBe('ACK');
      expect(ackPacket.direction).toBe('request');
      expect(ackPacket.tcpHeader?.acknowledgmentNumber).toBe(2001);
    });
  });

  describe('clientSendFinalFin', () => {
    it('should create FIN packet from client', () => {
      let connection = TcpService.createConnection(
        '192.168.1.10',
        '192.168.1.20',
        54321,
        80
      );
      connection = { ...connection, state: TcpConnectionState.CLOSE_WAIT };

      const [updatedConn, finPacket] = TcpService.clientSendFinalFin(connection);

      expect(updatedConn.state).toBe(TcpConnectionState.LAST_ACK);
      expect(finPacket.payload).toBe('FIN');
      expect(finPacket.tcpHeader?.flags).toBe(TcpFlags.FIN | TcpFlags.ACK);
      expect(finPacket.direction).toBe('request');
    });
  });
});