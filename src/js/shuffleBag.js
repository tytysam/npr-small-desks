/**
 * Random picks without the clumping of Math.random: every index comes up at
 * most once per pass through a shuffled deck, and a draw never returns
 * `exclude` (the channel you're leaving).
 */
export const makeShuffleBag = (size, random = Math.random) => {
  let deck = [];
  const refill = () => {
    deck = Array.from({ length: size }, (_, i) => i);
    for (let i = size - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  };
  return {
    next(exclude) {
      if (size <= 1) return 0;
      // The channel being left just sits out the rest of this pass.
      let pick;
      do {
        if (deck.length === 0) refill();
        pick = deck.pop();
      } while (pick === exclude);
      return pick;
    },
  };
};
