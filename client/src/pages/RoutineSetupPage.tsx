import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import { registerPlayer } from '../api/rooms'
import ConfirmPopup from '../components/ConfirmPopup'
import { useBgm } from '../context/BgmContext'
import { API_BASE as BASE_URL } from '../config'
import './RoutineSetupPage.css'

interface RoutineSlot {
  emoji: string
  title: string
}

const SLOT_COUNT = 4
const MIN_REQUIRED = 3
const MAX_TITLE_LENGTH = 15

const EMOJI_OPTIONS = [
  // 운동/신체
  '🏃', '💪', '🧘', '🚴', '🏋️', '🤸', '🚶', '🏊',
  // 식습관
  '🍎', '💧', '🥗', '☕', '🥤', '🍳',
  // 공부/업무
  '📚', '📝', '💻', '📖', '🎯', '✏️',
  // 청결/생활
  '🛁', '🧹', '🪥', '🛏️', '🧴', '👕',
  // 마음/취미
  '🧸', '🎵', '🌱', '📷', '🎮', '😴',
]

export default function RoutineSetupPage() {
  const navigate = useNavigate()
  const { roomCode: urlRoomCode } = useParams<{ roomCode?: string }>()

  const { room, pendingPlayer, setMyPlayer, setMyPin, setPendingPlayer } = useRoomStore()
  const { muted, setMuted, restart } = useBgm()

  const roomCode = urlRoomCode ?? room?.roomCode ?? ''

  const [slots, setSlots] = useState<RoutineSlot[]>(
    Array.from({ length: SLOT_COUNT }, () => ({ emoji: '', title: '' }))
  )
  const [emojiPopupIndex, setEmojiPopupIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [showExitPopup, setShowExitPopup] = useState(false)
  const [homeHover, setHomeHover] = useState(false)

  const canSave = slots.slice(0, MIN_REQUIRED).every((s) => s.emoji && s.title.trim())

  const handleTitleChange = (index: number, value: string) => {
    setSlots((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], title: value.slice(0, MAX_TITLE_LENGTH) }
      return next
    })
  }

  const handleSelectEmoji = (index: number, emoji: string) => {
    setSlots((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], emoji }
      return next
    })
    setEmojiPopupIndex(null)
  }

  const handleEmojiBtnClick = (index: number) => {
    setEmojiPopupIndex((prev) => (prev === index ? null : index))
  }

  const handleSave = async () => {
    if (!canSave || loading || !pendingPlayer) return
    setLoading(true)

    const routines = slots
      .map((s, i) => ({ slotNumber: i + 1, emoji: s.emoji, title: s.title.trim() }))
      .filter((r) => r.emoji && r.title)

    try {
      // 1단계: 플레이어 DB 등록
      const { player } = await registerPlayer(
        roomCode,
        pendingPlayer.slotNumber,
        pendingPlayer.nickname,
        pendingPlayer.pin,
      )

      // 2단계: 루틴 저장
      const res = await fetch(`${BASE_URL}/players/${player.playerId}/routines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routines }),
      })

      if (!res.ok) {
        const data = await res.json()
        console.error('루틴 저장 실패:', data)
        return
      }

      // 3단계: store 업데이트
      setMyPlayer({ ...player, roomId: room?.roomId ?? 0 })
      setMyPin(pendingPlayer.pin)
      setPendingPlayer(null)
      restart()
      navigate(`/room/${roomCode}`, { replace: true })
    } catch (e) {
      console.error('등록 오류:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="routine-setup-container"
      onClick={() => setEmojiPopupIndex(null)}
    >
      {/* 이전 버튼 */}
      <button className="back-btn" onClick={(e) => { e.stopPropagation(); navigate(-1) }}>
        <img src="/assets/button/previous.png" alt="back" />
      </button>

      {/* 스피커 버튼 */}
      <button className="speaker-btn" onClick={(e) => { e.stopPropagation(); setMuted(!muted) }}>
        <img src={muted ? '/assets/button/speaker2.png' : '/assets/button/speaker1.png'} alt="speaker" />
      </button>

      {/* 홈 버튼 */}
      <button
        className="home-btn"
        onMouseEnter={() => setHomeHover(true)}
        onMouseLeave={() => setHomeHover(false)}
        onClick={(e) => { e.stopPropagation(); setShowExitPopup(true) }}
      >
        <img src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'} alt="home" />
      </button>

      {/* 로고 */}
      <div className="logo-section">
        <img className="logo-main" src="/assets/logo/6.png" alt="RoutineMon" />
        <img className="logo-sub" src="/assets/logo/low.png" alt="같이 루틴 키울래?" />
      </div>

      {/* 메인 프레임 */}
      <div className="routine-setup-frame" onClick={(e) => e.stopPropagation()}>
        <p className="routine-setup-title">루틴을 설정해 주세요.</p>
        <p className="routine-setup-sub">최소 {MIN_REQUIRED}개 이상 설정해야 합니다.</p>

        <div className="routine-slots">
          {slots.map((slot, i) => {
            const isRequired = i < MIN_REQUIRED
            const titleLen = slot.title.length

            return (
              <div key={i} className="routine-slot">
                <div className="routine-slot-header">
                  <span className="routine-slot-number">#{i + 1}</span>
                  <span className={`routine-slot-badge ${isRequired ? 'required' : 'optional'}`}>
                    {isRequired ? '필수' : '선택'}
                  </span>
                </div>

                <div className="routine-slot-inputs">
                  {/* 이모지 버튼 */}
                  <div
                    className="routine-emoji-btn-wrap"
                    onClick={(e) => { e.stopPropagation(); handleEmojiBtnClick(i) }}
                  >
                    <button className="routine-emoji-btn" type="button">
                      {slot.emoji
                        ? <span className="routine-emoji-selected">{slot.emoji}</span>
                        : <img src="/assets/button/add.png" alt="add" />
                      }
                    </button>

                    {emojiPopupIndex === i && (
                      <div
                        className="routine-emoji-popup"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            className={`routine-emoji-option ${slot.emoji === emoji ? 'selected' : ''}`}
                            onClick={() => handleSelectEmoji(i, emoji)}
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 루틴 제목 입력 */}
                  <div className="routine-title-wrap">
                    <img className="routine-input-frame" src="/assets/frame/nickpin_frame.png" alt="frame" />
                    <input
                      className="routine-title-input"
                      type="text"
                      placeholder="루틴을 입력하세요."
                      value={slot.title}
                      maxLength={MAX_TITLE_LENGTH}
                      onChange={(e) => handleTitleChange(i, e.target.value)}
                    />
                    <span
                      className="routine-char-count"
                      style={{ color: titleLen >= MAX_TITLE_LENGTH ? '#FF4444' : '#aaaaaa' }}
                    >
                      {titleLen}/{MAX_TITLE_LENGTH}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 진행 표시 */}
        <p className="routine-progress">
          {slots.filter((s) => s.emoji && s.title.trim()).length} / {SLOT_COUNT} 완료
        </p>

        {/* SAVE 버튼 */}
        <button
          className="routine-save-btn"
          onClick={handleSave}
          disabled={!canSave || loading}
        >
          <img
            src={canSave ? '/assets/button/start_long2.png' : '/assets/button/start_long1.png'}
            alt="SAVE"
          />
        </button>
      </div>

      {/* 방 코드 */}
      {roomCode && (
        <p className="routine-room-code">ROOM CODE: {roomCode}</p>
      )}

      {/* 나가기 확인 팝업 */}
      {showExitPopup && (
        <ConfirmPopup
          message="나가면 설정이 취소됩니다."
          onYes={() => { setPendingPlayer(null); navigate('/') }}
          onNo={() => setShowExitPopup(false)}
        />
      )}
    </div>
  )
}
