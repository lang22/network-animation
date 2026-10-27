import congestionReducer, {
  trackPacketSent,
  markTrackedPacketLost,
  markPacketWaitingTimeout,
  markPacketAcked,
  enqueueRetransmission,
  dequeueRetransmission,
  setLossRate,
  setDropNextSeq,
  incrementTimeout,
  incrementRetransmission,
  reset,
} from '../congestionSlice';

describe('congestionSlice retransmission state', () => {
  it('tracks packet lifecycle from sent to timeout to acked', () => {
    let state = congestionReducer(undefined, reset());

    state = congestionReducer(state, trackPacketSent({
      seqNum: 4,
      ballId: 'ball_4',
      sentAt: 1000,
      rtoAt: 5000,
      attempt: 1,
      status: 'flying',
    }));
    state = congestionReducer(state, markTrackedPacketLost(4));
    state = congestionReducer(state, markPacketWaitingTimeout(4));
    state = congestionReducer(state, markPacketAcked(4));

    expect(state.inFlightPackets).toHaveLength(0);
    expect(state.ackedPackets).toBe(1);
  });

  it('queues and dequeues retransmission items', () => {
    let state = congestionReducer(undefined, reset());

    state = congestionReducer(state, enqueueRetransmission({
      seqNum: 5,
      attempt: 2,
      originalBallId: 'ball_5',
    }));
    state = congestionReducer(state, dequeueRetransmission(5));

    expect(state.retransmissionQueue).toEqual([]);
  });

  it('stores loss controls and counters', () => {
    let state = congestionReducer(undefined, reset());

    state = congestionReducer(state, setLossRate(0.2));
    state = congestionReducer(state, setDropNextSeq(9));
    state = congestionReducer(state, incrementTimeout());
    state = congestionReducer(state, incrementRetransmission());

    expect(state.lossRate).toBe(0.2);
    expect(state.dropNextSeq).toBe(9);
    expect(state.timeoutCount).toBe(1);
    expect(state.retransmissionCount).toBe(1);
  });
});
