// 手势滑动
interface SwipeCallbacks {
  onSwipeNext: () => void
  onSwipePrev: () => void
}

interface TouchEventWithStart extends TouchEvent {
  _startX?: number
  _startY?: number
}

export function useSwipeGesture(callbacks: SwipeCallbacks) {
  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0]
    if (touch) {
      (e as TouchEventWithStart)._startX = touch.clientX
      ;(e as TouchEventWithStart)._startY = touch.clientY
    }
  }

  function handleTouchMove(e: TouchEvent) {
    const touch = e.touches[0]
    const startX = (e as TouchEventWithStart)._startX
    if (startX !== undefined && Math.abs(touch.clientX - startX) > 10) {
      e.preventDefault()
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0]
    const startX = (e as TouchEventWithStart)._startX
    const startY = (e as TouchEventWithStart)._startY
    if (!touch || startX === undefined || startY === undefined) return

    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY

    if (Math.abs(deltaX) > 30 && Math.abs(deltaY) < 80) {
      if (deltaX < 0) {
        callbacks.onSwipeNext()
      } else {
        callbacks.onSwipePrev()
      }
    }
  }

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  }
}