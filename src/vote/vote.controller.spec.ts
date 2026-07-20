import { VoteController } from './vote.controller';

describe('VoteController', () => {
  it('should be defined', () => {
    const controller = new VoteController({} as any);

    expect(controller).toBeDefined();
  });
});
