/**
 * Seats of the sections a student may enroll themselves in (GET /enrollments/next-class): each section carries
 * `enrolled` (students in it now) and `seats` (what it takes from students enrolling themselves: CLASS_SEATS,
 * or CLASS_SEATS + CLASS_EXTRA_SEATS once every section of the grade is full). The office may enroll beyond
 * the seats, so `enrolled` can exceed `seats`.
 */

/** A section with this many seats left or fewer shows its count in the attention colour. */
export const FEW_SEATS_LEFT = 5;

/**
 * Where a section stands: the seats left (never below 0), whether it is full (POST /enrollments/next-class
 * answers 409 `class_full`) and whether only a few seats are left.
 * @param {{ enrolled: number, seats: number }} section
 * @returns {{ left: number, isFull: boolean, isFew: boolean }}
 */
export function seatsOf({ enrolled, seats }) {
  const left = Math.max(seats - enrolled, 0);
  return { left, isFull: left === 0, isFew: left > 0 && left <= FEW_SEATS_LEFT };
}

/**
 * The seat line of a section tile: "28 of 35 seats taken", "33 of 35 seats taken · 2 left", or "No seats left".
 * @param {{ enrolled: number, seats: number }} section
 */
export function seatsLabel(section) {
  const { left, isFull, isFew } = seatsOf(section);
  if (isFull) return 'No seats left';
  const taken = `${section.enrolled} of ${section.seats} seats taken`;
  return isFew ? `${taken} · ${left} left` : taken;
}

/** True when a failed self-enrollment means the section filled up meanwhile. */
export const isClassFullError = (error) => error?.details?.reason === 'class_full';
