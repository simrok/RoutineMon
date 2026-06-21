import { useState, useEffect } from 'react'

const DESIGN_WIDTH = 430
const DESIGN_HEIGHT = 932

export function useViewportScale() {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    function updateScale() {
      const scaleByWidth = window.innerWidth / DESIGN_WIDTH

      let newScale: number
      if (scaleByWidth < 1) {
        // 모바일: 화면이 디자인 너비보다 좁음 → 너비 기준으로만 축소
        newScale = scaleByWidth
      } else {
        // 데스크탑/태블릿: 너비+높이 모두 고려, 최대 1배 (확대 없음)
        newScale = Math.min(scaleByWidth, window.innerHeight / DESIGN_HEIGHT, 1)
      }

      setScale(newScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  return scale
}
