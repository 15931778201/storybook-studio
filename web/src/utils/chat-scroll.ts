export interface ScrollSnapshot {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

export interface AutoScrollState {
  shouldAutoScroll: boolean;
  showNewOutput: boolean;
}

const DEFAULT_BOTTOM_THRESHOLD = 80;

export function getAutoScrollState(
  snapshot: ScrollSnapshot,
  bottomThreshold = DEFAULT_BOTTOM_THRESHOLD,
): AutoScrollState {
  const distanceFromBottom = snapshot.scrollHeight - snapshot.scrollTop - snapshot.clientHeight;
  const shouldAutoScroll = distanceFromBottom <= bottomThreshold;
  return {
    shouldAutoScroll,
    showNewOutput: !shouldAutoScroll,
  };
}
