import { OptionsController } from './options.controller';

describe('OptionsController', () => {
  it('should be defined', () => {
    const controller = new OptionsController({} as any);

    expect(controller).toBeDefined();
  });
});
