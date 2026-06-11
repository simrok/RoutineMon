import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBgm } from '../context/BgmContext'
import './JoinPage.css'

const API_BASE = 'http://localhost:4000/api'

const SLOT_COLOR: Record<number, string> = {
  1: '#ffffff',
  2: '#00e78c',
  3: '#14e8ff',
  4: '#fff700',
  5: '#ff6b6b',
}

type SlotInfo = {
  slotNumber: number
  nickname: string | null
}

export default function JoinPage() {
  const navigate = useNavigate()
  const { roomCode } = useParams<{ roomCode: string }>()
  const { muted, setMuted } = useBgm()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [maxPlayers, setMaxPlayers] = useState(0)
  const [slots, setSlots] = useState<SlotInfo[]>([])

  useEffect(() => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}`)
      .then(res => res.json())
      .then(json => {
        if (!json.success) {
          setError('존재하지 않는 방 코드입니다.')
          return
        }
        const { maxPlayers, players } = json.data
        setMaxPlayers(maxPlayers)

        const allSlots: SlotInfo[] = Array.from({ length: maxPlayers }, (_, i) => {
          const player = players.find((p: { slotNumber: number; nickname: string }) => p.slotNumber === i + 1)
          return {
            slotNumber: i + 1,
            nickname: player?.nickname ?? null,
          }
        })
        setSlots(allSlots)
      })
      .catch(() => setError('방 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [roomCode])

  const takenCount = slots.filter(s => s.nickname !== null).length
  const hasEmptySlot = takenCount < maxPlayers

  return (
    <div className="joinpage-container">
      <div className="joinpage-board">

        {/* 로고 */}
        <div className="joinpage-logo-area">
          <img className="joinpage-logo" src="/assets/logo/6.png" alt="RoutineMon" />
          <img className="joinpage-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
        </div>

        {/* 스피커 버튼 */}
        <button className="joinpage-speaker-btn" onClick={() => setMuted(!muted)}>
          <img src={muted ? '/assets/button/speaker2.png' : '/assets/button/speaker1.png'} alt="speaker" />
        </button>

        {/* 홈 버튼 */}
        <button className="joinpage-home-btn" onClick={() => navigate('/')}>
          <img src="/assets/button/home1.png" alt="home" />
        </button>

        {loading && (
          <p className="joinpage-loading">loading...</p>
        )}

        {!loading && error && (
          <div className="joinpage-error-box">
            <p className="joinpage-error-text">{error}</p>
            <button className="joinpage-home-text-btn" onClick={() => navigate('/')}>
              홈으로 돌아가기
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="joinpage-card">

            {/* 방 코드 */}
            <p className="joinpage-card-label">ROOM CODE</p>
            <p className="joinpage-room-code">{roomCode}</p>

            {/* 인원 수 */}
            <p className="joinpage-player-count">
              <span className="joinpage-count-current">{takenCount}</span>
              <span className="joinpage-count-sep"> / </span>
              <span>{maxPlayers}</span>
              <span className="joinpage-count-unit"> 명 참여 중</span>
            </p>

            {/* 슬롯 목록 */}
            <div className="joinpage-slots">
              {slots.map(slot => (
                <div
                  key={slot.slotNumber}
                  className={`joinpage-slot ${slot.nickname ? 'joinpage-slot-taken' : 'joinpage-slot-empty'}`}
                >
                  <span
                    className="joinpage-slot-dot"
                    style={{ background: SLOT_COLOR[slot.slotNumber] ?? '#ffffff' }}
                  />
                  <span className="joinpage-slot-name">
                    {slot.nickname ?? '빈 슬롯'}
                  </span>
                  {!slot.nickname && (
                    <span className="joinpage-slot-badge">입장 가능</span>
                  )}
                </div>
              ))}
            </div>

            {/* 참가 or 풀방 */}
            {hasEmptySlot ? (
              <button
                className="joinpage-join-btn"
                onClick={() => navigate(`/join/${roomCode}/select`)}
              >
                <img src="/assets/button/start_long1.png" alt="참가하기" />
              </button>
            ) : (
              <p className="joinpage-full-text">방이 꽉 찼습니다.</p>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
