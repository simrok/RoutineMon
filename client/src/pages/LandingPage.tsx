import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom, joinRoom } from '../api/rooms'
import { useRoomStore } from '../store/useRoomStore'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const { setRoom, setMyPlayer } = useRoomStore()

  const [selectedPlayers, setSelectedPlayers] = useState<number | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [hoveredNum, setHoveredNum] = useState<number | null>(null)
  const [createHover, setCreateHover] = useState(false)
  const [startHover, setStartHover] = useState(false)
  const [homeHover, setHomeHover] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCreateRoom = async () => {
    if (!selectedPlayers) return
    setLoading(true)
    try {
      const { roomCode: newCode } = await createRoom('루틴몬 방')
      const { player } = await joinRoom(newCode, '방장', 'rabbit')
      setRoom({
        roomId: 1,
        roomCode: newCode,
        roomName: '루틴몬 방',
        maxPlayers: selectedPlayers,
        currentPlayers: 1,
        createdAt: new Date().toISOString(),
      })
      setMyPlayer(player)
      navigate(`/room/${newCode}/select`)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinRoom = async () => {
    if (roomCode.length !== 6) return
    setLoading(true)
    try {
      const { player } = await joinRoom(roomCode, '플레이어', 'rabbit')
      setRoom({
        roomId: 1,
        roomCode,
        roomName: '루틴몬 방',
        maxPlayers: 5,
        currentPlayers: 1,
        createdAt: new Date().toISOString(),
      })
      setMyPlayer(player)
      navigate(`/room/${roomCode}/select`)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-container">

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
            disabled={loading}
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
        <div className="roomcode-frame">
          <img src="/assets/frame/roomcode.png" alt="roomcode frame" />
          <input
            className="roomcode-input"
            placeholder="방 코드 입력"
            value={roomCode}
            maxLength={6}
            onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <button
          className="start-btn"
          onMouseEnter={() => setStartHover(true)}
          onMouseLeave={() => setStartHover(false)}
          onClick={handleJoinRoom}
          disabled={loading}
        >
          <img
            src={startHover ? '/assets/button/start2.png' : '/assets/button/start1.png'}
            alt="START"
          />
        </button>
      </div>

    </div>
  )
}