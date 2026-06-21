import { useState, useEffect } from 'react'

const DESIGN_WIDTH = 430
const DESIGN_HEIGHT = 932

export function useViewportScale() {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    function updateScale() {
      const scaleX = window.innerWidth / DESIGN_WIDTH
      const scaleY = window.innerHeight / DESIGN_HEIGHT
      // 너비와 높이 중 더 작은 비율을 사용해 잘리지 않게
      const newScale = Math.min(scaleX, scaleY)
      setScale(newScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  return scale
}
