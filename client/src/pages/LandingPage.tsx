import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRoom } from '../api/rooms'
import { useRoomStore } from '../store/useRoomStore'
import { useBgm } from '../context/BgmContext'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const { setRoom, setPendingMaxPlayers, reset } = useRoomStore()

  const { muted, setMuted } = useBgm()
  const [selectedPlayers, setSelectedPlayers] = useState<number | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [hoveredNum, setHoveredNum] = useState<number | null>(null)
  const [createHover, setCreateHover] = useState(false)
  const [startHover, setStartHover] = useState(false)
  const [homeHover, setHomeHover] = useState(false)
  const [loading, setLoading] = useState(false)
  const [joinError, setJoinError] = useState('')

  // 방 신설: maxPlayers 저장 후 슬롯 선택 페이지로 이동 (API 호출 없음)
  const handleCreateRoom = () => {
    if (!selectedPlayers) return
    reset()                          // 이전 방/플레이어 정보 초기화
    setPendingMaxPlayers(selectedPlayers)
    navigate('/create/select')
  }

  // 방 참가: 방 코드 유효성 확인 후 슬롯 선택 페이지로 이동
  const handleJoinRoom = async () => {
    if (roomCode.length !== 6) return
    setLoading(true)
    setJoinError('')
    try {
      const room = await getRoom(roomCode)
      setRoom(room)
      navigate(`/join/${roomCode}/select`)
    } catch (e) {
      setJoinError('존재하지 않는 방 코드입니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-container">

      {/* 스피커 버튼 */}
      <button className="speaker-btn" onClick={() => setMuted(!muted)}>
        <img src={muted ? '/assets/button/speaker2.png' : '/assets/button/speaker1.png'} alt="speaker" />
      </button>

      {/* 홈 버튼 */}
      <button
        className="home-btn"
        onMouseEnter={() => setHomeHover(true)}
        onMouseLeave={() => setHomeHover(false)}
      >
        <img src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'} alt="home" />
      </button>

      {/* 로고 */}
      <div className="logo-section">
        <img className="logo-main" src="/assets/logo/6.png" alt="RoutineMon" />
        <img className="logo-sub" src="/assets/logo/low.png" alt="같이 루틴 키울래?" />
      </div>

      {/* 배너 */}
      <img className="banner-img" src="/assets/picture/banner1.png" alt="banner" />

      {/* 방 만들기 섹션 */}
      <div className="create-section">
        <img className="select-frame" src="/assets/frame/select_frame.png" alt="frame" />
        <div className="create-content">
          <img className="select-players-img" src="/assets/letter/selectPlayers.png" alt="Select Players" />

          <div className="number-buttons">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                className="number-btn"
                onMouseEnter={() => setHoveredNum(num)}
                onMouseLeave={() => setHoveredNum(null)}
                onClick={() => setSelectedPlayers(num)}
              >
                <img
                  src={
                    hoveredNum === num || selectedPlayers === num
                      ? `/assets/button/number/${num}_hover.png`
                      : `/assets/button/number/${num}.png`
                  }
                  alt={`${num}명`}
                />
              </button>
            ))}
          </div>

          <button
            className="create-room-btn"
            onMouseEnter={() => setCreateHover(true)}
            onMouseLeave={() => setCreateHover(false)}
            onClick={handleCreateRoom}
            disabled={!selectedPlayers}
          >
            <img
              src={createHover ? '/assets/button/createroom2.png' : '/assets/button/createroom1.png'}
              alt="CREATE ROOM"
            />
          </button>
        </div>
      </div>

      {/* 방 참여 섹션 */}
      <div className="join-section">
        <div className="join-section-row">
          <div className="roomcode-frame">
            <img src="/assets/frame/roomcode.png" alt="roomcode frame" />
            <input
              className="roomcode-input"
              placeholder="방 코드 입력"
              value={roomCode}
              maxLength={6}
              onChange={(e) => {
                setRoomCode(e.target.value.replace(/\D/g, ''))
                setJoinError('')
              }}
            />
          </div>

          <button
            className="start-btn"
            onMouseEnter={() => setStartHover(true)}
            onMouseLeave={() => setStartHover(false)}
            onClick={handleJoinRoom}
            disabled={loading || roomCode.length !== 6}
          >
            <img
              src={startHover ? '/assets/button/start2.png' : '/assets/button/start1.png'}
              alt="START"
            />
          </button>
        </div>

        {joinError && (
          <p className="join-error">{joinError}</p>
        )}
      </div>

      {/* 하단 캐릭터 퍼레이드 */}
      <div className="landing-characters">
        {[
          { src: '/assets/player/player_red.png',    alt: 'red',    delay: '0s'   },
          { src: '/assets/player/player_white.png',  alt: 'white',  delay: '-3.2s' },
          { src: '/assets/player/player_blue.png',   alt: 'blue',   delay: '-6.4s' },
          { src: '/assets/player/player_yellow.png', alt: 'yellow', delay: '-9.6s' },
          { src: '/assets/player/player_green.png',  alt: 'green',  delay: '-12.8s' },
        ].map(({ src, alt, delay }) => (
          <div key={alt} className="landing-char-walker" style={{ animationDelay: delay }}>
            <img className="landing-char" src={src} alt={alt} />
            <div className="landing-char-shadow" />
          </div>
        ))}
      </div>

    </div>
  )
}
