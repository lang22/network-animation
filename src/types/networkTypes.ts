// 定义TCP/IP协议相关的数据结构

// TCP标志位枚举
export enum TcpFlags {
  FIN = 1,    // 断开连接
  SYN = 2,    // 建立连接
  RST = 4,    // 重置连接
  PSH = 8,    // 推送数据
  ACK = 16,   // 确认
  URG = 32,   // 紧急指针
}

// TCP头部结构
export interface TcpHeader {
  sourcePort: number;      // 源端口
  destinationPort: number; // 目标端口
  sequenceNumber: number;  // 序列号
  acknowledgmentNumber: number; // 确认号
  headerLength: number;    // 头部长度（以4字节为单位）
  flags: TcpFlags;        // 标志位
  windowSize: number;     // 窗口大小
  checksum: number;       // 校验和
  urgentPointer: number;  // 紧急指针
}

// IP头部结构
export interface IpHeader {
  version: number;         // 版本 (IPv4 = 4)
  headerLength: number;    // 头部长度（以4字节为单位）
  typeOfService: number;   // 服务类型
  totalLength: number;     // 总长度
  identification: number;  // 标识
  flags: number;          // 标志
  fragmentOffset: number; // 分片偏移
  ttl: number;            // 生存时间
  protocol: number;       // 协议 (TCP = 6)
  headerChecksum: number; // 头部校验和
  sourceIp: string;       // 源IP地址
  destinationIp: string;  // 目标IP地址
}

// 以太网帧头部结构
export interface EthernetHeader {
  destinationMac: string;  // 目标MAC地址
  sourceMac: string;       // 源MAC地址
  etherType: number;       // 以太网类型 (IPv4 = 0x0800)
}

// 网络数据包结构
export interface NetworkPacket {
  id: string;                    // 数据包唯一标识
  source: string;               // 源地址
  destination: string;          // 目标地址
  payload: any;                 // 负载数据
  timestamp: number;            // 时间戳
  ethernetHeader?: EthernetHeader; // 以太网头部
  ipHeader?: IpHeader;          // IP头部
  tcpHeader?: TcpHeader;        // TCP头部
  layer: 'application' | 'transport' | 'network' | 'link'; // 当前所在层级
  direction: 'request' | 'response'; // 方向
}

// TCP连接状态枚举
export enum TcpConnectionState {
  CLOSED = 'CLOSED',
  LISTEN = 'LISTEN',
  SYN_SENT = 'SYN_SENT',
  SYN_RECEIVED = 'SYN_RECEIVED',
  ESTABLISHED = 'ESTABLISHED',
  FIN_WAIT_1 = 'FIN_WAIT_1',
  FIN_WAIT_2 = 'FIN_WAIT_2',
  CLOSE_WAIT = 'CLOSE_WAIT',
  CLOSING = 'CLOSING',
  LAST_ACK = 'LAST_ACK',
  TIME_WAIT = 'TIME_WAIT',
}

// TCP连接状态
export interface TcpConnection {
  id: string;
  sourceIp: string;
  destinationIp: string;
  sourcePort: number;
  destinationPort: number;
  state: TcpConnectionState;
  localSeqNum: number;        // 本地序列号
  remoteSeqNum: number;       // 远程序列号
  localAckNum: number;        // 本地确认号
  remoteAckNum: number;       // 远程确认号
  windowSize: number;         // 窗口大小
  rtt: number;                // 往返时间
}