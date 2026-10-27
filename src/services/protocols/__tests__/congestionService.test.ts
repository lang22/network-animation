import {
  handleTimeoutLoss,
  shouldDropPacket,
  canRetransmit,
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
      dropNextSeq: 7,
    }, 7, 0.99)).toBe(true);
  });

  it('uses loss rate when deterministic sequence does not match', () => {
    expect(shouldDropPacket({
      enabled: true,
      lossRate: 0.1,
      dropNextSeq: 7,
    }, 8, 0.05)).toBe(true);
  });

  it('does not drop packets when loss is disabled', () => {
    expect(shouldDropPacket({
      enabled: false,
      lossRate: 1,
      dropNextSeq: 1,
    }, 1, 0)).toBe(false);
  });

  it('allows attempts below max retransmissions', () => {
    expect(canRetransmit(2, 3)).toBe(true);
    expect(canRetransmit(3, 3)).toBe(false);
  });
});
