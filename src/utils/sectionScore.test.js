import { describe, it, expect } from 'vitest';
import {
  getSectionAutoStats,
  buildSectionScoreValue,
  formatStopwatchTime,
  parseStopwatchTimeToSeconds,
} from './sectionScore';

describe('sectionScore helpers', () => {
  describe('getSectionAutoStats', () => {
    it('returns manual text only when there is no auto suffix', () => {
      expect(getSectionAutoStats('Felt strong today')).toEqual({
        timer: '',
        rounds: 0,
        manualText: 'Felt strong today',
      });
    });

    it('parses auto-only score', () => {
      expect(getSectionAutoStats('[auto: 00:05 / 5]')).toEqual({
        timer: '00:05',
        rounds: 5,
        manualText: '',
      });
    });

    it('parses manual text with auto suffix', () => {
      expect(getSectionAutoStats('Nice pace [auto: 12:34 / 7]')).toEqual({
        timer: '12:34',
        rounds: 7,
        manualText: 'Nice pace',
      });
    });

    it('supports hour-long timer format', () => {
      expect(getSectionAutoStats('Long one [auto: 01:02:03 / 9]')).toEqual({
        timer: '01:02:03',
        rounds: 9,
        manualText: 'Long one',
      });
    });
  });

  describe('buildSectionScoreValue', () => {
    it('returns manual text unchanged when no auto values are present', () => {
      expect(buildSectionScoreValue('Manual only', '', 0)).toBe('Manual only');
    });

    it('returns only auto suffix when there is no manual text', () => {
      expect(buildSectionScoreValue('', '00:05', 5)).toBe('[auto: 00:05 / 5]');
    });

    it('preserves manual text and appends auto suffix', () => {
      expect(buildSectionScoreValue('Manual note', '00:05', 5)).toBe('Manual note [auto: 00:05 / 5]');
    });
  });

  describe('stopwatch formatting/parsing', () => {
    it('formats short durations as mm:ss', () => {
      expect(formatStopwatchTime(65)).toBe('01:05');
    });

    it('formats long durations as hh:mm:ss', () => {
      expect(formatStopwatchTime(3723)).toBe('01:02:03');
    });

    it('parses mm:ss back to seconds', () => {
      expect(parseStopwatchTimeToSeconds('01:05')).toBe(65);
    });

    it('parses hh:mm:ss back to seconds', () => {
      expect(parseStopwatchTimeToSeconds('01:02:03')).toBe(3723);
    });

    it('returns zero for invalid or empty timer text', () => {
      expect(parseStopwatchTimeToSeconds('')).toBe(0);
      expect(parseStopwatchTimeToSeconds('abc')).toBe(0);
    });
  });
});
