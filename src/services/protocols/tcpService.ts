// TCP协议服务实现

import { NetworkPacket, TcpConnection, TcpConnectionState, TcpFlags } from '@/types/networkTypes';

// 生成安全的随机 ID
function generateSecureId(): string {
    const timestamp = Date.now().toString(36);
    let randomPart = '';

    // 使用 crypto.getRandomValues 生成更安全的随机数
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const array = new Uint8Array(6);
        window.crypto.getRandomValues(array);
        randomPart = Array.from(array, byte => byte.toString(36)).join('');
    } else {
        // 服务端降级方案
        randomPart = Math.random().toString(36).slice(2, 8);
    }

    return `${timestamp}_${randomPart}`;
}

// 生成安全的随机序列号
function generateSecureSeqNum(): number {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        return array[0] % 4294967295; // TCP 序列号范围
    }
    return Math.floor(Math.random() * 4294967295);
}

export class TcpService {
  // 创建TCP连接
  static createConnection(sourceIp: string, destIp: string, sourcePort: number, destPort: number): TcpConnection {
    return {
      id: `conn_${generateSecureId()}`,
      sourceIp,
      destinationIp: destIp,
      sourcePort,
      destinationPort: destPort,
      state: TcpConnectionState.CLOSED,
      localSeqNum: generateSecureSeqNum(), // 安全随机初始序列号
      remoteSeqNum: 0,
      localAckNum: 0,
      remoteAckNum: 0,
      windowSize: 65535, // 默认窗口大小
      rtt: 0,
    };
  }

  // 开始三次握手过程
  static initiateHandshake(connection: TcpConnection): [TcpConnection, NetworkPacket[]] {
    // 更新连接状态
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.SYN_SENT,
    };

    const packets: NetworkPacket[] = [];

    // 第一步：客户端发送SYN
    const synPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_syn`,
      source: `${connection.sourceIp}:${connection.sourcePort}`,
      destination: `${connection.destinationIp}:${connection.destinationPort}`,
      payload: 'SYN',
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.sourcePort,
        destinationPort: connection.destinationPort,
        sequenceNumber: connection.localSeqNum,
        acknowledgmentNumber: 0,
        headerLength: 5,
        flags: TcpFlags.SYN,
        windowSize: connection.windowSize,
        checksum: 0, // 实际实现中需要计算
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'request',
    };

    packets.push(synPacket);

    return [updatedConn, packets];
  }

  // 处理SYN并回复SYN-ACK
  static handleSynAndSendSynAck(connection: TcpConnection, synPacket: NetworkPacket): [TcpConnection, NetworkPacket] {
    // 更新远程序列号
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.SYN_RECEIVED,
      remoteSeqNum: synPacket.tcpHeader!.sequenceNumber,
      localAckNum: synPacket.tcpHeader!.sequenceNumber + 1,
    };

    // 创建SYN-ACK包
    const synAckPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_syn_ack`,
      source: `${connection.destinationIp}:${connection.destinationPort}`,
      destination: `${connection.sourceIp}:${connection.sourcePort}`,
      payload: 'SYN-ACK',
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.destinationPort,
        destinationPort: connection.sourcePort,
        sequenceNumber: connection.localSeqNum,
        acknowledgmentNumber: synPacket.tcpHeader!.sequenceNumber + 1,
        headerLength: 5,
        flags: TcpFlags.SYN | TcpFlags.ACK,
        windowSize: connection.windowSize,
        checksum: 0, // 实际实现中需要计算
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'response',
    };

    return [updatedConn, synAckPacket];
  }

  // 处理SYN-ACK并发送ACK
  static handleSynAckAndSendAck(connection: TcpConnection, synAckPacket: NetworkPacket): [TcpConnection, NetworkPacket] {
    // 更新连接状态和序列号
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.ESTABLISHED,
      remoteSeqNum: synAckPacket.tcpHeader!.sequenceNumber,
      localAckNum: synAckPacket.tcpHeader!.sequenceNumber + 1,
      remoteAckNum: synAckPacket.tcpHeader!.acknowledgmentNumber,
    };

    // 创建ACK包
    const ackPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_ack`,
      source: `${connection.sourceIp}:${connection.sourcePort}`,
      destination: `${connection.destinationIp}:${connection.destinationPort}`,
      payload: 'ACK',
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.sourcePort,
        destinationPort: connection.destinationPort,
        sequenceNumber: synAckPacket.tcpHeader!.acknowledgmentNumber,
        acknowledgmentNumber: synAckPacket.tcpHeader!.sequenceNumber + 1,
        headerLength: 5,
        flags: TcpFlags.ACK,
        windowSize: connection.windowSize,
        checksum: 0, // 实际实现中需要计算
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'request',
    };

    return [updatedConn, ackPacket];
  }

  // 发送数据包
  static sendData(connection: TcpConnection, data: any): [TcpConnection, NetworkPacket] {
    if (connection.state !== TcpConnectionState.ESTABLISHED) {
      throw new Error('Connection is not established');
    }

    // 创建数据包
    const dataPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_data`,
      source: `${connection.sourceIp}:${connection.sourcePort}`,
      destination: `${connection.destinationIp}:${connection.destinationPort}`,
      payload: data,
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.sourcePort,
        destinationPort: connection.destinationPort,
        sequenceNumber: connection.localSeqNum,
        acknowledgmentNumber: connection.remoteAckNum,
        headerLength: 5,
        flags: TcpFlags.ACK, // 可能还需要PSH标志
        windowSize: connection.windowSize,
        checksum: 0, // 实际实现中需要计算
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'request',
    };

    // 更新序列号
    const updatedConn: TcpConnection = {
      ...connection,
      localSeqNum: connection.localSeqNum + (typeof data === 'string' ? data.length : 1),
    };

    return [updatedConn, dataPacket];
  }

  // 处理收到的数据包
  static receiveData(connection: TcpConnection, dataPacket: NetworkPacket): TcpConnection {
    // 更新远程序列号和本地确认号
    const updatedConn: TcpConnection = {
      ...connection,
      remoteSeqNum: dataPacket.tcpHeader!.sequenceNumber,
      localAckNum: dataPacket.tcpHeader!.sequenceNumber + 
                   (typeof dataPacket.payload === 'string' ? dataPacket.payload.length : 1),
    };

    return updatedConn;
  }

  // 发送ACK确认
  static sendAck(connection: TcpConnection, dataPacket: NetworkPacket): NetworkPacket {
    const ackPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_data_ack`,
      source: `${connection.destinationIp}:${connection.destinationPort}`,
      destination: `${connection.sourceIp}:${connection.sourcePort}`,
      payload: 'ACK',
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.destinationPort,
        destinationPort: connection.sourcePort,
        sequenceNumber: connection.localSeqNum,
        acknowledgmentNumber: dataPacket.tcpHeader!.sequenceNumber + 
                             (typeof dataPacket.payload === 'string' ? dataPacket.payload.length : 1),
        headerLength: 5,
        flags: TcpFlags.ACK,
        windowSize: connection.windowSize,
        checksum: 0, // 实际实现中需要计算
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'response',
    };

    return ackPacket;
  }

  // 开始关闭连接（主动关闭方发送FIN）
  static initiateClose(connection: TcpConnection): [TcpConnection, NetworkPacket] {
    if (connection.state !== TcpConnectionState.ESTABLISHED) {
      throw new Error('Connection is not established');
    }

    // 创建FIN包
    const finPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_fin`,
      source: `${connection.sourceIp}:${connection.sourcePort}`,
      destination: `${connection.destinationIp}:${connection.destinationPort}`,
      payload: 'FIN',
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.sourcePort,
        destinationPort: connection.destinationPort,
        sequenceNumber: connection.localSeqNum,
        acknowledgmentNumber: connection.remoteAckNum,
        headerLength: 5,
        flags: TcpFlags.FIN | TcpFlags.ACK,
        windowSize: connection.windowSize,
        checksum: 0, // 实际实现中需要计算
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'request',
    };

    // 更新连接状态
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.FIN_WAIT_1,
      localSeqNum: connection.localSeqNum + 1, // FIN占用一个序列号
    };

    return [updatedConn, finPacket];
  }

  // 处理收到的FIN并发送ACK
  static handleFinAndSendAck(connection: TcpConnection, finPacket: NetworkPacket): [TcpConnection, NetworkPacket] {
    // 创建ACK包
    const ackPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_fin_ack`,
      source: `${connection.destinationIp}:${connection.destinationPort}`,
      destination: `${connection.sourceIp}:${connection.sourcePort}`,
      payload: 'ACK',
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.destinationPort,
        destinationPort: connection.sourcePort,
        sequenceNumber: connection.localSeqNum,
        acknowledgmentNumber: finPacket.tcpHeader!.sequenceNumber + 1,
        headerLength: 5,
        flags: TcpFlags.ACK,
        windowSize: connection.windowSize,
        checksum: 0, // 实际实现中需要计算
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'response',
    };

    // 更新连接状态
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.CLOSE_WAIT,
      remoteSeqNum: finPacket.tcpHeader!.sequenceNumber,
      localAckNum: finPacket.tcpHeader!.sequenceNumber + 1,
    };

    return [updatedConn, ackPacket];
  }

  // 发送自己的FIN（被动关闭方）
  static sendFinalFin(connection: TcpConnection): [TcpConnection, NetworkPacket] {
    // 创建FIN包
    const finPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_final_fin`,
      source: `${connection.destinationIp}:${connection.destinationPort}`,
      destination: `${connection.sourceIp}:${connection.sourcePort}`,
      payload: 'FIN',
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.destinationPort,
        destinationPort: connection.sourcePort,
        sequenceNumber: connection.localSeqNum,
        acknowledgmentNumber: connection.remoteAckNum,
        headerLength: 5,
        flags: TcpFlags.FIN | TcpFlags.ACK,
        windowSize: connection.windowSize,
        checksum: 0, // 实际实现中需要计算
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'response',
    };

    // 更新连接状态
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.LAST_ACK,
      localSeqNum: connection.localSeqNum + 1, // FIN占用一个序列号
    };

    return [updatedConn, finPacket];
  }

  // 处理最后的ACK
  static handleCloseAck(connection: TcpConnection, ackPacket: NetworkPacket): TcpConnection {
    // 更新连接状态
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.TIME_WAIT, // 或者CLOSED，取决于实现
      remoteSeqNum: ackPacket.tcpHeader!.sequenceNumber,
      localAckNum: ackPacket.tcpHeader!.sequenceNumber,
    };

    return updatedConn;
  }

  // ========== 服务器主动关闭连接场景 ==========

  // 服务器主动发起关闭（服务器作为主动关闭方发送FIN）
  static serverInitiateClose(connection: TcpConnection): [TcpConnection, NetworkPacket] {
    if (connection.state !== TcpConnectionState.ESTABLISHED) {
      throw new Error('Connection is not established');
    }

    // 创建FIN包（从服务器发送到客户端）
    const finPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_server_fin`,
      source: `${connection.destinationIp}:${connection.destinationPort}`,
      destination: `${connection.sourceIp}:${connection.sourcePort}`,
      payload: 'FIN',
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.destinationPort,
        destinationPort: connection.sourcePort,
        sequenceNumber: connection.localSeqNum,
        acknowledgmentNumber: connection.remoteAckNum,
        headerLength: 5,
        flags: TcpFlags.FIN | TcpFlags.ACK,
        windowSize: connection.windowSize,
        checksum: 0,
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'response',
    };

    // 更新连接状态（服务器进入 FIN_WAIT_1）
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.FIN_WAIT_1,
      localSeqNum: connection.localSeqNum + 1,
    };

    return [updatedConn, finPacket];
  }

  // 客户端处理服务器发来的FIN并发送ACK
  static clientHandleServerFinAndSendAck(connection: TcpConnection, finPacket: NetworkPacket): [TcpConnection, NetworkPacket] {
    // 创建ACK包（从客户端发送到服务器）
    const ackPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_server_fin_ack`,
      source: `${connection.sourceIp}:${connection.sourcePort}`,
      destination: `${connection.destinationIp}:${connection.destinationPort}`,
      payload: 'ACK',
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.sourcePort,
        destinationPort: connection.destinationPort,
        sequenceNumber: connection.localSeqNum,
        acknowledgmentNumber: finPacket.tcpHeader!.sequenceNumber + 1,
        headerLength: 5,
        flags: TcpFlags.ACK,
        windowSize: connection.windowSize,
        checksum: 0,
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'request',
    };

    // 更新连接状态（客户端进入 CLOSE_WAIT）
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.CLOSE_WAIT,
      remoteSeqNum: finPacket.tcpHeader!.sequenceNumber,
      localAckNum: finPacket.tcpHeader!.sequenceNumber + 1,
    };

    return [updatedConn, ackPacket];
  }

  // 客户端发送自己的FIN（客户端作为被动关闭方发起关闭）
  static clientSendFinalFin(connection: TcpConnection): [TcpConnection, NetworkPacket] {
    // 创建FIN包（从客户端发送到服务器）
    const finPacket: NetworkPacket = {
      id: `pkt_${Date.now()}_client_final_fin`,
      source: `${connection.sourceIp}:${connection.sourcePort}`,
      destination: `${connection.destinationIp}:${connection.destinationPort}`,
      payload: 'FIN',
      timestamp: Date.now(),
      tcpHeader: {
        sourcePort: connection.sourcePort,
        destinationPort: connection.destinationPort,
        sequenceNumber: connection.localSeqNum,
        acknowledgmentNumber: connection.remoteAckNum,
        headerLength: 5,
        flags: TcpFlags.FIN | TcpFlags.ACK,
        windowSize: connection.windowSize,
        checksum: 0,
        urgentPointer: 0,
      },
      layer: 'transport',
      direction: 'request',
    };

    // 更新连接状态（客户端进入 LAST_ACK）
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.LAST_ACK,
      localSeqNum: connection.localSeqNum + 1,
    };

    return [updatedConn, finPacket];
  }

  // 服务器处理客户端的最终ACK
  static serverHandleFinalAck(connection: TcpConnection, ackPacket: NetworkPacket): TcpConnection {
    const updatedConn: TcpConnection = {
      ...connection,
      state: TcpConnectionState.TIME_WAIT,
      remoteSeqNum: ackPacket.tcpHeader!.sequenceNumber,
      localAckNum: ackPacket.tcpHeader!.acknowledgmentNumber,
    };

    return updatedConn;
  }
}