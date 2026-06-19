import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import ConfirmPopup from '../components/ConfirmPopup'
import { getRoom } from '../api/rooms'
import { useBgm } from '../context/BgmContext'
import './CharacterSelectPage.css'

export default function CharacterSelectPage() {
  const navigate = useNavigate()
  const { roomCode } = useParams<{ roomCode?: string }>()

  // roomCode가 없으면 방 신설 중, 있으면 방 참가 중
  const isCreating = !roomCode

  const { room, setRoom, myPlayer, playerColors, pendingMaxPlayers, setPlayerColor } = useRoomStore()

  // 방 신설 흐름: 이미 방에 입장한 상태면 기존 방으로 리다이렉트 (뒤로가기 방지)
  useEffect(() => {
    if (isCreating && myPlayer && room?.roomCode) {
      navigate(`/room/${room.roomCode}`, { replace: true })
    }
  }, [])

  // 방 참가 시: 마운트할 때마다 최신 방 정보 재조회 (뒤로가기 후 슬롯 현황 갱신)
  useEffect(() => {
    if (isCreating || !roomCode) return
    getRoom(roomCode)
      .then(data => {
        setRoom({
          roomId: data.roomId,
          roomCode: data.roomCode,
          roomName: '루틴몬 방',
          maxPlayers: data.maxPlayers,
          currentPlayers: data.players.length,
          createdAt: new Date().toISOString(),
          players: data.players,
        })
        // 실제 characterType으로 playerColors 업데이트
        data.players.forEach((p: { slotNumber: number; characterType?: string }) => {
          if (p.characterType) setPlayerColor(p.slotNumber, p.characterType)
        })
      })
      .catch(err => console.error('방 정보 갱신 실패:', err))
  }, [roomCode])

  // 방 신설: pendingMaxPlayers 사용 / 방 참가: 서버에서 받은 room.maxPlayers 사용
  const maxPlayers = isCreating ? pendingMaxPlayers : (room?.maxPlayers ?? 5)

  // 참가 모드에서 isActive 결정 기준도 maxPlayers로 통일


  const { muted, setMuted } = useBgm()

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [startHover, setStartHover] = useState(false)
  const [homeHover, setHomeHover] = useState(false)
  const [showExitPopup, setShowExitPopup] = useState(false)

  const handleSelectSlot = (slot: number) => {
    if (slot > maxPlayers) return
    setSelectedSlot(slot)
  }

  const roomPlayers = isCreating ? [] : (room?.players ?? [])


  const handleStart = () => {
    if (!selectedSlot) return
    if (isCreating) {
      navigate(`/create/setup/${selectedSlot}`)
    } else {
      const isOccupied = roomPlayers.some(p => p.slotNumber === selectedSlot)
      if (isOccupied) {
        navigate(`/join/${roomCode}/verify/${selectedSlot}`)
      } else {
        navigate(`/join/${roomCode}/setup/${selectedSlot}`)
      }
    }
  }

  return (
    <div className="charselect-container">

      {/* 스피커 버튼 */}
      <button className="speaker-btn" onClick={() => setMuted(!muted)}>
        <img src={muted ? '/assets/button/speaker2.png' : '/assets/button/speaker1.png'} alt="speaker" />
      </button>

      {/* 홈 버튼 */}
      <button
        className="home-btn"
        onMouseEnter={() => setHomeHover(true)}
        onMouseLeave={() => setHomeHover(false)}
        onClick={() => setShowExitPopup(true)}
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
            const occupiedPlayer = roomPlayers.find(p => p.slotNumber === slot)
            const isOccupied = !!occupiedPlayer

            return (
              <div
                key={slot}
                className={`player-row ${isActive ? '' : 'inactive'} ${isOccupied ? 'occupied' : ''}`}
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
                  className={`character-img${isSelected ? ' floating' : ''}`}
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
                      {occupiedPlayer ? occupiedPlayer.nickname : '비어있음'}
                    </span>
                  </div>
                </div>

                {/* 점유 dot */}
                {isActive && (
                  <div
                    className="slot-dot"
                    style={{
                      background: isOccupied ? '#00e78c' : '#dddddd',
                      border: 'none',
                    }}
                  />
                )}
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

      {/* 방 코드 — 참가 시에만 표시 */}
      {!isCreating && (
        <p className="room-code-display">ROOM CODE: {roomCode}</p>
      )}

      {/* 나가기 확인 팝업 */}
      {showExitPopup && (
        <ConfirmPopup
          message={isCreating ? '나가면 방 신설이 취소됩니다.' : '나가시겠습니까?'}
          onYes={() => navigate('/')}
          onNo={() => setShowExitPopup(false)}
        />
      )}

    </div>
  )
}
