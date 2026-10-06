import { useMemo, useRef, useState } from 'preact/hooks';
import { getSwipeDirection, getWeekDates } from '../utils/weekCarousel';

const WeekCarousel = ({
  selectedDate,
  onSelectDate,
  hasWorkout,
  isToday,
  toDateKey,
  formatDayName,
  formatDate,
}) => {
  const [dragOffset, setDragOffset] = useState(0);
  const [slideDirection, setSlideDirection] = useState(null);
  const [slideTransition, setSlideTransition] = useState('none');
  const dragStateRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    lastDeltaX: 0,
    dragging: false,
  });
  const isAnimatingRef = useRef(false);
  const weekPanels = useMemo(
    () => [-1, 0, 1].map(offset => getWeekDates(selectedDate, offset)),
    [selectedDate],
  );

  const handlePointerDown = (event) => {
    if (isAnimatingRef.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSlideTransition('none');
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastDeltaX: 0,
      dragging: false,
    };
  };

  const handlePointerMove = (event) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId || isAnimatingRef.current) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (!state.dragging) {
      if (Math.abs(deltaX) < 18 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      state.dragging = true;
    }

    state.lastDeltaX = deltaX;
    const maxOffset = event.currentTarget.clientWidth;
    setDragOffset(Math.max(-maxOffset, Math.min(maxOffset, deltaX)));
  };

  const finishPointerGesture = (event, cancelled = false) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture?.(state.pointerId)) {
      event.currentTarget.releasePointerCapture(state.pointerId);
    }

    const direction = !cancelled && state.dragging
      ? getSwipeDirection(state.lastDeltaX, event.currentTarget.clientWidth)
      : null;
    const shouldAnimate = state.dragging && Math.abs(state.lastDeltaX) >= 1;

    isAnimatingRef.current = shouldAnimate;
    setSlideTransition(shouldAnimate ? 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)' : 'none');
    setSlideDirection(direction);
    setDragOffset(0);
    dragStateRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      lastDeltaX: 0,
      dragging: state.dragging,
    };
  };

  const handleTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;

    if (slideDirection) {
      const nextDate = new Date(selectedDate);
      nextDate.setDate(selectedDate.getDate() + (slideDirection === 'next' ? 7 : -7));
      onSelectDate(nextDate);
    }

    setSlideTransition('none');
    setSlideDirection(null);
    setDragOffset(0);
    isAnimatingRef.current = false;
  };

  const trackTransform = slideDirection === 'next'
    ? 'translate3d(-200%, 0, 0)'
    : slideDirection === 'prev'
      ? 'translate3d(0, 0, 0)'
      : `translate3d(calc(-100% + ${dragOffset}px), 0, 0)`;

  return (
    <div
      aria-label="Week calendar"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointerGesture(event)}
      onPointerCancel={(event) => finishPointerGesture(event, true)}
      style={{
        marginBottom: '20px',
        width: '100%',
        touchAction: 'pan-y',
        userSelect: 'none',
        overflow: 'hidden'
      }}
    >
      <div
        data-testid="week-carousel-track"
        onTransitionEnd={handleTransitionEnd}
        style={{
          display: 'flex',
          width: '100%',
          transform: trackTransform,
          transition: slideTransition,
          willChange: 'transform'
        }}
      >
        {weekPanels.map((panelDates) => (
          <div
            key={toDateKey(panelDates[0])}
            style={{
              flex: '0 0 100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '5px',
              minWidth: 0
            }}
          >
            {panelDates.map((date) => {
              const hasWorkoutOnDate = hasWorkout(date);
              const isSelected = toDateKey(date) === toDateKey(selectedDate);
              const isTodayDate = isToday(date);

              return (
                <div
                  key={toDateKey(date)}
                  onClick={() => {
                    if (dragStateRef.current.dragging) {
                      dragStateRef.current.dragging = false;
                      return;
                    }
                    onSelectDate(date);
                  }}
                  style={{
                    padding: '10px 5px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: hasWorkoutOnDate
                      ? (isTodayDate ? '#4f7a2a' : '#2d5016')
                      : (isTodayDate ? '#4a4a4a' : '#333'),
                    border: isSelected ? '2px solid #646cff' : isTodayDate ? '2px solid #555' : '1px solid #444',
                    transition: 'background-color 0.2s, border-color 0.2s, color 0.2s',
                    minWidth: 0
                  }}
                >
                  <div style={{ fontSize: '0.75em', color: '#aaa', marginBottom: '5px' }}>
                    {formatDayName(date)}
                  </div>
                  <div style={{ fontSize: '0.95em', fontWeight: isSelected ? 'bold' : 'normal' }}>
                    {formatDate(date)}
                  </div>
                  {hasWorkoutOnDate && (
                    <div style={{ marginTop: '3px', fontSize: '0.7em', color: '#8bc34a' }}>
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeekCarousel;
