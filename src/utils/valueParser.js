/**
 * Utility functions for parsing different types of performance measurement values
 */

/**
 * Parse a value based on the unit type
 * @param {string} value - The input value as a string
 * @param {string} unit - The unit type (e.g., 'seconds', 'minutes', 'kg', 'm', etc.)
 * @returns {number} - The parsed numeric value
 */
export const parsePerformanceValue = (value, unit) => {
  if (!value || value.trim() === '') {
    return null;
  }

  const trimmedValue = value.trim();

  // Handle time-based units that might be in MM:SS.ms or MM:SS format
  if (unit && (unit.toLowerCase().includes('second') || unit.toLowerCase().includes('minute') || unit.toLowerCase().includes('time'))) {
    return parseTimeValue(trimmedValue);
  }

  // Handle regular numeric values
  const numericValue = parseFloat(trimmedValue);
  if (isNaN(numericValue)) {
    throw new Error(`Invalid numeric value: ${trimmedValue}`);
  }

  return numericValue;
};

/**
 * Parse time values in various formats:
 * - "1:23.45" (minutes:seconds.milliseconds)
 * - "1:23" (minutes:seconds)
 * - "123.45" (seconds with milliseconds)
 * - "123" (whole seconds)
 * @param {string} timeString - The time string to parse
 * @returns {number} - Time in seconds as a decimal
 */
export const parseTimeValue = (timeString) => {
  if (!timeString || timeString.trim() === '') {
    return null;
  }

  const trimmed = timeString.trim();

  // Check if it contains a colon (MM:SS format)
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const minutes = parseFloat(parts[0]);
      const seconds = parseFloat(parts[1]);

      if (isNaN(minutes) || isNaN(seconds)) {
        throw new Error(`Invalid time format: ${trimmed}. Expected format: MM:SS or MM:SS.ms`);
      }

      // Convert to total seconds
      return minutes * 60 + seconds;
    } else {
      throw new Error(`Invalid time format: ${trimmed}. Expected format: MM:SS or MM:SS.ms`);
    }
  } else {
    // No colon, treat as seconds
    const seconds = parseFloat(trimmed);
    if (isNaN(seconds)) {
      throw new Error(`Invalid time value: ${trimmed}. Expected decimal number or MM:SS format`);
    }
    return seconds;
  }
};

/**
 * Format a time value in seconds back to a readable string
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time string
 */
export const formatTimeValue = (seconds) => {
  if (seconds === null || seconds === undefined) {
    return '';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toFixed(2).padStart(5, '0')}`;
  } else {
    return remainingSeconds.toFixed(2);
  }
};

/**
 * Check if a unit represents a time measurement
 * @param {string} unit - The unit to check
 * @returns {boolean} - True if it's a time unit
 */
export const isTimeUnit = (unit) => {
  if (!unit) return false;
  const lowerUnit = unit.toLowerCase();
  return lowerUnit.includes('second') ||
         lowerUnit.includes('minute') ||
         lowerUnit.includes('time') ||
         lowerUnit === 'sec' ||
         lowerUnit === 'min';
};
