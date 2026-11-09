import { ease } from './useFade';

describe('ease', () => {
  it("follows CSS's ease curve", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    // cubic-bezier(0.25, 0.1, 0.25, 1) at its midpoint
    expect(ease(0.5)).toBeCloseTo(0.8024, 3);
    expect(ease(0.25)).toBeCloseTo(0.4085, 3);
  });

  it('only rises', () => {
    const steps = Array.from({ length: 21 }, (_, i) => ease(i / 20));
    steps.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(steps[i]));
  });
});
