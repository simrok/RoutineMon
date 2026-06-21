import { useState, useEffect } from 'react'

const DESIGN_WIDTH = 430
const DESIGN_HEIGHT = 932

interface ViewportScale {
  scale: number
  isDesktop: boolean
}

export function useViewportScale(): ViewportScale {
  const [state, setState] = useState<ViewportScale>({ scale: 1, isDesktop: false })

  useEffect(() => {
    function updateScale() {
      const scaleByWidth = window.innerWidth / DESIGN_WIDTH
      const isDesktop = scaleByWidth >= 1

      let newScale: number
      if (!isDesktop) {
        // 모바일: 너비 기준으로만 축소
        newScale = scaleByWidth
      } else {
        // 데스크탑/태블릿: 너비+높이 모두 고려, 최대 1배
        newScale = Math.min(scaleByWidth, window.innerHeight / DESIGN_HEIGHT, 1)
      }

      setState({ scale: newScale, isDesktop })
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  return state
}
