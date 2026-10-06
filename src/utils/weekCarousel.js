export const getWeekDates = (centerDate, weekOffset = 0) => {
  const startOfWeek = new Date(
    centerDate.getFullYear(),
    centerDate.getMonth(),
    centerDate.getDate(),
  );
  startOfWeek.setDate(centerDate.getDate() - centerDate.getDay() + (weekOffset * 7));

  return Array.from({ length: 7 }, (_, dayOffset) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + dayOffset);
    return date;
  });
};

export const getSwipeDirection = (deltaX, containerWidth) => {
  const threshold = Math.min(80, Math.max(50, containerWidth * 0.2));
  if (Math.abs(deltaX) < threshold) return null;
  return deltaX > 0 ? 'prev' : 'next';
};
