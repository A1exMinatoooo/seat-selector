export type RemainingPrize = { remaining: number };

export function prizeIndexForRoll(prizes: RemainingPrize[], remainingPool: number, roll: number): number | null {
  if (!Number.isInteger(remainingPool) || remainingPool < 1 || !Number.isInteger(roll) || roll < 0 || roll >= remainingPool) throw new Error("Invalid lottery roll");
  const inventory = prizes.reduce((sum, prize) => {
    if (!Number.isInteger(prize.remaining) || prize.remaining < 0) throw new Error("Invalid prize inventory");
    return sum + prize.remaining;
  }, 0);
  if (inventory > remainingPool) throw new Error("Prize inventory exceeds lottery pool");
  let cursor = 0;
  for (const [index, prize] of prizes.entries()) {
    cursor += prize.remaining;
    if (roll < cursor) return index;
  }
  return null;
}
