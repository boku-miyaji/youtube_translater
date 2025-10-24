// Format processing time to human readable format
export function formatProcessingTime(seconds: number): string {
  // Handle sub-second times
  if (seconds < 1) {
    return `${seconds.toFixed(1)} sec`;
  } else if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds > 0) {
      return `${hours} hr ${minutes} min ${remainingSeconds} sec`;
    } else if (minutes > 0) {
      return `${hours} hr ${minutes} min`;
    } else {
      return `${hours} hr`;
    }
  }
}