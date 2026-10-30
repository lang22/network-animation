import {
  handleTimeoutLoss,
  handleFastRetransmit,
  shouldDropPacket,
  canRetransmit,
  isPartialAck,
} from '../congestionService';
import { CongestionPhase, SenderWindowState } from '@/types/congestionTypes';

const makeWindow = (cwnd: number): SenderWindowState => ({
  cwnd,
  ssthresh: 64,
  lastAcked: 0,
  nextSeq: 1,
  allowedToSend: cwnd,
});

describe('congestionService retransmission helpers', () => {
  it('collapses cwnd to 1 and halves ssthresh on timeout loss', () => {
    const result = handleTimeoutLoss(makeWindow(12));

    expect(result.window.cwnd).toBe(1);
    expect(result.window.ssthresh).toBe(6);
    expect(result.window.allowedToSend).toBe(1);
    expect(result.phase).toBe(CongestionPhase.SLOW_START);
  });

  it('keeps ssthresh at least 2 on timeout loss', () => {
    const result = handleTimeoutLoss(makeWindow(3));

    expect(result.window.ssthresh).toBe(2);
    expect(result.window.cwnd).toBe(1);
  });

  it('drops the configured deterministic packet before random loss', () => {
    expect(shouldDropPacket({
      enabled: true,
      lossRate: 0,
      dropSeqs: [7],
    }, 7, 0.99)).toBe(true);
  });

  it('drops every configured sequence in the same window', () => {
    const config = { enabled: true, lossRate: 0, dropSeqs: [8, 12] };

    expect(shouldDropPacket(config, 8, 0.99)).toBe(true);
    expect(shouldDropPacket(config, 12, 0.99)).toBe(true);
    expect(shouldDropPacket(config, 9, 0.99)).toBe(false);
  });

  it('uses loss rate when deterministic sequence does not match', () => {
    expect(shouldDropPacket({
      enabled: true,
      lossRate: 0.1,
      dropSeqs: [7],
    }, 8, 0.05)).toBe(true);
  });

  it('does not drop packets when loss is disabled', () => {
    expect(shouldDropPacket({
      enabled: false,
      lossRate: 1,
      dropSeqs: [1],
    }, 1, 0)).toBe(false);
  });

  it('detects partial ACKs in fast recovery', () => {
    expect(isPartialAck(12, 16)).toBe(true);
    expect(isPartialAck(16, 16)).toBe(false);
  });

  it('halves the window and enters fast recovery on 3 duplicate ACKs', () => {
    const result = handleFastRetransmit(makeWindow(10));

    expect(result.window.cwnd).toBe(5);
    expect(result.window.ssthresh).toBe(5);
    expect(result.window.allowedToSend).toBe(5);
    expect(result.phase).toBe(CongestionPhase.FAST_RECOVERY);
  });

  it('never reduces fast-recovery window below 2', () => {
    const result = handleFastRetransmit(makeWindow(2));

    expect(result.window.cwnd).toBe(2);
    expect(result.window.ssthresh).toBe(2);
  });

  it('allows attempts below max retransmissions', () => {
    expect(canRetransmit(2, 3)).toBe(true);
    expect(canRetransmit(3, 3)).toBe(false);
  });
});
