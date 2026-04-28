export const getSectionAutoStats = (sectionScoreValue = '') => {
  const match = sectionScoreValue.match(/\[auto:\s*(\d{2}:\d{2}(?::\d{2})?)\s*\/\s*(\d+)\]$/);
  if (!match) {
    return { timer: '', rounds: 0, manualText: sectionScoreValue.trim() };
  }

  return {
    timer: match[1],
    rounds: Number(match[2]) || 0,
    manualText: sectionScoreValue.replace(match[0], '').trim(),
  };
};

export const buildSectionScoreValue = (manualText = '', timer = '', rounds = 0) => {
  const autoPart = timer ? `[auto: ${timer} / ${rounds}]` : '';
  if (manualText && autoPart) return `${manualText} ${autoPart}`;
  return manualText || autoPart;
};

export const formatStopwatchTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
};

export const parseStopwatchTimeToSeconds = (timerText = '') => {
  const timerParts = timerText ? timerText.split(':').map(Number) : [];
  if (timerParts.length === 3) {
    return (timerParts[0] * 3600) + (timerParts[1] * 60) + timerParts[2];
  }
  if (timerParts.length === 2) {
    return (timerParts[0] * 60) + timerParts[1];
  }
  return 0;
};
