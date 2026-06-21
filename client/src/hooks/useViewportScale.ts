import { useState, useEffect } from 'react'

const DESIGN_WIDTH = 430

export function useViewportScale() {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    function updateScale() {
      // 너비 기준으로만 스케일, 데스크탑에서 확대되지 않도록 최대 1배
      const newScale = Math.min(window.innerWidth / DESIGN_WIDTH, 1)
      setScale(newScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  return scale
}
