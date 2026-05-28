import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import './CharacterSelectPage.css'

export default function CharacterSelectPage() {
  const navigate = useNavigate()
  const { roomCode } = useParams<{ roomCode: string }>()
  const { room, playerColors } = useRoomStore()

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [startHover, setStartHover] = useState(false)
  const [homeHover, setHomeHover] = useState(false)

  const maxPlayers = room?.maxPlayers ?? 5

  const handleSelectSlot = (slot: number) => {
    if (slot > maxPlayers) return
    setSelectedSlot(slot)
  }

  const handleStart = () => {
    if (!selectedSlot) return
    // 나중에: 닉네임/PIN 설정 여부 확인 후 분기
    navigate(`/room/${roomCode}/setup/${selectedSlot}`)
  }

  return (
    <div className="charselect-container">

      {/* 홈 버튼 */}
      <button
        className="home-btn"
        onMouseEnter={() => setHomeHover(true)}
        onMouseLeave={() => setHomeHover(false)}
        onClick={() => navigate('/')}
      >
        <img src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'} alt="home" />
      </button>

      {/* 로고 */}
      <div className="logo-section">
        <img className="logo-main" src="/assets/logo/6.png" alt="RoutineMon" />
        <img className="logo-sub" src="/assets/logo/low.png" alt="같이 루틴 키울래?" />
      </div>

      {/* 캐릭터 선택 프레임 */}
      <div className="charselect-frame">
        <img
          className="choose-title"
          src="/assets/letter/ChooseYourCharacter.png"
          alt="Choose Your Character"
        />

        <div className="player-list">
          {[1, 2, 3, 4, 5].map((slot) => {
            const isActive = slot <= maxPlayers
            const isSelected = selectedSlot === slot
            const color = isActive ? (playerColors[slot] ?? 'white') : 'no'

            return (
              <div
                key={slot}
                className={`player-row ${isActive ? '' : 'inactive'}`}
                onClick={() => handleSelectSlot(slot)}
              >
                {/* 별 */}
                <div className="star-area">
                  {isSelected && (
                    <img src="/assets/button/star.png" alt="selected" />
                  )}
                </div>

                {/* 캐릭터 */}
                <img
                  className="character-img"
                  src={`/assets/player/player_${color}.png`}
                  alt={`player${slot}`}
                />

                {/* 닉네임 프레임 */}
                <div className="nickname-frame-wrap">
                  <img
                    className="nickname-frame-img"
                    src="/assets/frame/choose_frame.png"
                    alt="frame"
                  />
                  <div className="player-info">
                    <span
                      className="player-num"
                      style={{
                        color: isActive
                          ? isSelected ? '#4800FF' : '#000000'
                          : '#B6B6B6',
                      }}
                    >
                      player {slot}
                    </span>
                    <span
                      className="player-nickname"
                      style={{
                        color: isActive
                          ? isSelected ? '#4800FF' : '#000000'
                          : '#B6B6B6',
                      }}
                    >
                      Unknown
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* START 버튼 */}
        <button
          className="start-long-btn"
          onMouseEnter={() => setStartHover(true)}
          onMouseLeave={() => setStartHover(false)}
          onClick={handleStart}
          disabled={!selectedSlot}
        >
          <img
            src={startHover ? '/assets/button/start_long2.png' : '/assets/button/start_long1.png'}
            alt="START"
          />
        </button>
      </div>

      {/* 방 코드 */}
      <p className="room-code-display">ROOM CODE: {roomCode}</p>

    </div>
  )
}
