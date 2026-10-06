import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import WeekCarousel from './weekCarousel';

const toDateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const firePointer = (element, type, properties) => {
  const event = new Event(type, { bubbles: true });
  Object.entries(properties).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value });
  });
  fireEvent(element, event);
};

const finishTransition = (element) => {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: 'transform' });
  fireEvent(element, event);
};

const renderCarousel = (onSelectDate = vi.fn()) => {
  render(
    <WeekCarousel
      selectedDate={new Date(2026, 9, 6)}
      onSelectDate={onSelectDate}
      hasWorkout={() => false}
      isToday={() => false}
      toDateKey={toDateKey}
      formatDayName={(date) => date.toLocaleDateString('en-US', { weekday: 'short' })}
      formatDate={(date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
    />,
  );
  const calendar = screen.getByLabelText('Week calendar');
  Object.defineProperty(calendar, 'clientWidth', { value: 360 });
  return {
    calendar,
    track: screen.getByTestId('week-carousel-track'),
    onSelectDate,
  };
};

describe('WeekCarousel', () => {
  it('moves with the pointer and selects the previous week after the transition', () => {
    const { calendar, track, onSelectDate } = renderCarousel();

    firePointer(calendar, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 20 });
    firePointer(calendar, 'pointermove', { pointerId: 1, clientX: 180, clientY: 20 });
    expect(track.style.transform).toContain('80px');

    firePointer(calendar, 'pointerup', { pointerId: 1, clientX: 180, clientY: 20 });
    expect(track.style.transform).toBe('translate3d(0, 0, 0)');
    finishTransition(track);

    expect(onSelectDate).toHaveBeenCalledOnce();
    expect(toDateKey(onSelectDate.mock.calls[0][0])).toBe('2026-09-29');
  });

  it('selects the next week after a left swipe', () => {
    const { calendar, track, onSelectDate } = renderCarousel();

    firePointer(calendar, 'pointerdown', { pointerId: 2, clientX: 180, clientY: 20 });
    firePointer(calendar, 'pointermove', { pointerId: 2, clientX: 100, clientY: 20 });
    firePointer(calendar, 'pointerup', { pointerId: 2, clientX: 100, clientY: 20 });
    expect(track.style.transform).toBe('translate3d(-200%, 0, 0)');
    finishTransition(track);

    expect(toDateKey(onSelectDate.mock.calls[0][0])).toBe('2026-10-13');
  });

  it('snaps back without changing weeks after a short drag', () => {
    const { calendar, track, onSelectDate } = renderCarousel();

    firePointer(calendar, 'pointerdown', { pointerId: 3, clientX: 100, clientY: 20 });
    firePointer(calendar, 'pointermove', { pointerId: 3, clientX: 130, clientY: 20 });
    firePointer(calendar, 'pointerup', { pointerId: 3, clientX: 130, clientY: 20 });
    expect(track.style.transform).toContain('-100%');
    finishTransition(track);

    expect(onSelectDate).not.toHaveBeenCalled();
  });
});
