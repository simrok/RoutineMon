import { createContext, useContext, useRef, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

interface BgmContextType {
  muted: boolean
  volume: number
  setMuted: (m: boolean) => void
  setVolume: (v: number) => void
  restart: () => void
}

const BgmContext = createContext<BgmContextType | null>(null)

export function BgmProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startedRef = useRef(false)
  const [muted, setMutedState] = useState(false)
  const [volume, setVolumeState] = useState(0.3)

  useEffect(() => {
    const audio = new Audio('/assets/audio/bgm.mp3')
    audio.loop = true
    audio.volume = 0.3
    audioRef.current = audio

    const onFirstInteraction = () => {
      if (startedRef.current) return
      startedRef.current = true
      audio.play().catch(() => {})
    }

    window.addEventListener('click', onFirstInteraction, { once: true })
    window.addEventListener('keydown', onFirstInteraction, { once: true })

    return () => {
      audio.pause()
      window.removeEventListener('click', onFirstInteraction)
      window.removeEventListener('keydown', onFirstInteraction)
    }
  }, [])

  const setMuted = (m: boolean) => {
    setMutedState(m)
    if (audioRef.current) audioRef.current.muted = m
  }

  const setVolume = (v: number) => {
    setVolumeState(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  // RoomPage 진입 시 BGM 처음부터 재시작
  const restart = () => {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0
    if (!audioRef.current.muted) {
      audioRef.current.play().catch(() => {})
    }
    startedRef.current = true
  }

  return (
    <BgmContext.Provider value={{ muted, volume, setMuted, setVolume, restart }}>
      {children}
    </BgmContext.Provider>
  )
}

export const useBgm = () => {
  const ctx = useContext(BgmContext)
  if (!ctx) throw new Error('useBgm must be used within BgmProvider')
  return ctx
}
