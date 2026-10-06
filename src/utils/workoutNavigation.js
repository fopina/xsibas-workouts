const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const findAdjacentWorkoutDateKeys = (dateKeys = [], selectedDateKey = '') => {
  const sortedDateKeys = [...new Set(dateKeys.filter(isDateKey))].sort();
  let previous = null;
  let next = null;

  for (const dateKey of sortedDateKeys) {
    if (dateKey < selectedDateKey) {
      previous = dateKey;
      continue;
    }

    if (dateKey > selectedDateKey) {
      next = dateKey;
      break;
    }
  }

  return { previous, next };
};
