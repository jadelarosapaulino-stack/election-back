import { VotersService } from './voters.service';

describe('VotersService', () => {
  it('should be defined', () => {
    const service = new VotersService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    expect(service).toBeDefined();
  });
});
