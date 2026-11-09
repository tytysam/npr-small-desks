import { rankHearts } from './hearts';

const channels = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

describe('rankHearts', () => {
  it('ranks hearted concerts by count, most first', () => {
    expect(rankHearts(channels, { b: 1, d: 5, c: 3 })).toEqual([3, 2, 1]);
  });

  it('breaks ties in favour of the newer concert', () => {
    expect(rankHearts(channels, { d: 2, b: 2 })).toEqual([1, 3]);
  });

  it('leaves out unhearted concerts and ones no longer in the lineup', () => {
    expect(rankHearts(channels, { a: 0, gone: 9, c: 1 })).toEqual([2]);
    expect(rankHearts(channels, {})).toEqual([]);
  });
});
