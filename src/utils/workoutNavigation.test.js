import { describe, expect, it } from 'vitest';
import { findAdjacentWorkoutDateKeys, hasWorkoutInDateKeys } from './workoutNavigation';

describe('hasWorkoutInDateKeys', () => {
  const displayedWeek = [
    '2026-10-04',
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
  ];

  it('detects a workout anywhere in the displayed week', () => {
    expect(hasWorkoutInDateKeys(displayedWeek, ['2026-09-28', '2026-10-07', '2026-10-12'])).toBe(true);
  });

  it('returns false when workouts only exist outside the displayed week', () => {
    expect(hasWorkoutInDateKeys(displayedWeek, ['2026-09-28', '2026-10-12'])).toBe(false);
  });
});

describe('findAdjacentWorkoutDateKeys', () => {
  it('finds the nearest workouts around an empty day', () => {
    expect(findAdjacentWorkoutDateKeys([
      '2026-10-12',
      '2026-09-28',
      '2026-10-20',
    ], '2026-10-06')).toEqual({
      previous: '2026-09-28',
      next: '2026-10-12',
    });
  });

  it('excludes the selected day from both results', () => {
    expect(findAdjacentWorkoutDateKeys([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ], '2026-10-06')).toEqual({
      previous: '2026-10-05',
      next: '2026-10-07',
    });
  });

  it('returns null when there is no workout in one direction', () => {
    expect(findAdjacentWorkoutDateKeys(['2026-10-12'], '2026-10-06')).toEqual({
      previous: null,
      next: '2026-10-12',
    });
    expect(findAdjacentWorkoutDateKeys(['2026-09-28'], '2026-10-06')).toEqual({
      previous: '2026-09-28',
      next: null,
    });
  });

  it('ignores invalid and duplicate date keys', () => {
    expect(findAdjacentWorkoutDateKeys([
      'not-a-date',
      '2026-09-28',
      '2026-09-28',
      '',
      '2026-10-12',
    ], '2026-10-06')).toEqual({
      previous: '2026-09-28',
      next: '2026-10-12',
    });
  });

  it('returns no shortcuts when there are no workout dates', () => {
    expect(findAdjacentWorkoutDateKeys([], '2026-10-06')).toEqual({
      previous: null,
      next: null,
    });
  });
});
