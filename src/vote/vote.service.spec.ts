import { VoteService } from './vote.service';

describe('VoteService', () => {
  it('should be defined', () => {
    const service = new VoteService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    expect(service).toBeDefined();
  });
});
