import congestionReducer, {
  trackPacketSent,
  markTrackedPacketLost,
  markPacketWaitingTimeout,
  markPacketAcked,
  enqueueRetransmission,
  dequeueRetransmission,
  setLossRate,
  setDropSeqs,
  removeDropSeq,
  incrementTimeout,
  incrementRetransmission,
  incrementPartialAck,
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
    state = congestionReducer(state, setDropSeqs([9, 12]));
    state = congestionReducer(state, incrementTimeout());
    state = congestionReducer(state, incrementRetransmission());
    state = congestionReducer(state, incrementPartialAck());

    expect(state.lossRate).toBe(0.2);
    expect(state.dropSeqs).toEqual([9, 12]);
    expect(state.timeoutCount).toBe(1);
    expect(state.retransmissionCount).toBe(1);
    expect(state.partialAcks).toBe(1);
  });

  it('removes a single planned drop after it is consumed', () => {
    let state = congestionReducer(undefined, reset());
    state = congestionReducer(state, setDropSeqs([9, 12]));
    state = congestionReducer(state, removeDropSeq(9));

    expect(state.dropSeqs).toEqual([12]);
  });
});
