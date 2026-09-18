import { driverDeDados } from '../ambiente';

describe('driverDeDados', () => {
  it('usa mock por padrão', () => {
    expect(driverDeDados()).toBe('mock');
  });
});
