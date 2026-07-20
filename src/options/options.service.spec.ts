import { OptionsService } from './options.service';

describe('OptionsService', () => {
  it('should be defined', () => {
    const service = new OptionsService({} as any, {} as any);

    expect(service).toBeDefined();
  });
});
