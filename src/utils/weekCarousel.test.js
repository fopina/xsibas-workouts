import { describe, expect, it } from 'vitest';
import { getSwipeDirection, getWeekDates } from './weekCarousel';

const toLocalDateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

describe('getWeekDates', () => {
  it('builds Sunday through Saturday for the selected week', () => {
    const dates = getWeekDates(new Date(2026, 9, 6));
    expect(dates.map(toLocalDateKey)).toEqual([
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
  });

  it('builds adjacent weeks across month boundaries', () => {
    const previousWeek = getWeekDates(new Date(2026, 9, 1), -1);
    const nextWeek = getWeekDates(new Date(2026, 9, 1), 1);
    expect(toLocalDateKey(previousWeek[0])).toBe('2026-09-20');
    expect(toLocalDateKey(nextWeek[0])).toBe('2026-10-04');
  });
});

describe('getSwipeDirection', () => {
  it('selects the direction after crossing the responsive threshold', () => {
    expect(getSwipeDirection(72, 360)).toBe('prev');
    expect(getSwipeDirection(-72, 360)).toBe('next');
  });

  it('snaps back when the gesture is below the threshold', () => {
    expect(getSwipeDirection(40, 360)).toBeNull();
    expect(getSwipeDirection(-40, 360)).toBeNull();
  });
});
