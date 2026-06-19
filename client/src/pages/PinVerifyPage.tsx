import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import ConfirmPopup from '../components/ConfirmPopup'
import { verifyPin } from '../api/rooms'
import { useBgm } from '../context/BgmContext'
import './NicknameSetupPage.css'

const PIN_LENGTH = 4

export default function PinVerifyPage() {
  const navigate = useNavigate()
  const { roomCode, slotNumber } = useParams<{ roomCode: string; slotNumber: string }>()

  const { room, setMyPlayer, setMyPin } = useRoomStore()
  const { muted, setMuted, restart } = useBgm()

  // 해당 슬롯의 닉네임 찾기
  const occupiedPlayer = room?.players?.find(p => p.slotNumber === Number(slotNumber))
  const displayName = occupiedPlayer?.nickname ?? `player ${slotNumber}`

  const [homeHover, setHomeHover] = useState(false)
  const [startHover, setStartHover] = useState(false)
  const [showExitPopup, setShowExitPopup] = useState(false)
  const [loading, setLoading] = useState(false)

  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', ''])
  const [pinVisible, setPinVisible] = useState(false)
  const [pinError, setPinError] = useState(false)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  const canSubmit = pinDigits.every(d => d !== '')

  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...pinDigits]
    newDigits[index] = value.slice(-1)
    setPinDigits(newDigits)
    setPinError(false)

    if (value && index < PIN_LENGTH - 1) {
      pinRefs.current[index + 1]?.focus()
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit || loading) return
    const pin = pinDigits.join('')
    const slot = Number(slotNumber)

    setLoading(true)
    try {
      const { player } = await verifyPin(roomCode!, slot, pin)
      setMyPlayer(player)
      setMyPin(pin)
      restart()
      navigate(`/room/${roomCode}`)
    } catch {
      setPinError(true)
      setPinDigits(['', '', '', ''])
      setTimeout(() => pinRefs.current[0]?.focus(), 0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-container">

      {/* 이전 버튼 */}
      <button className="back-btn" onClick={() => navigate(-1)}>
        <img src="/assets/button/previous.png" alt="back" />
      </button>

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

      {/* 메인 프레임 */}
      <div className="setup-frame">

        <p className="section-title">{displayName}의 PIN을 입력해주세요.</p>
        <p className="section-sub">숫자 0~9로 이뤄진 4자리 PIN</p>

        <div className="pin-row">
          <div className="pin-boxes">
            {pinDigits.map((digit, i) => (
              <div className="pin-box-wrap" key={i}>
                <img className="pin-frame-img" src="/assets/frame/nickpin_frame.png" alt="frame" />
                <input
                  className="pin-box-input"
                  ref={(el) => { pinRefs.current[i] = el }}
                  type={pinVisible ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinInput(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                />
              </div>
            ))}
          </div>

          <button className="eye-btn" onClick={() => setPinVisible(!pinVisible)}>
            <img
              src={pinVisible ? '/assets/button/eye_on.png' : '/assets/button/eye_off.png'}
              alt={pinVisible ? '숨기기' : '보기'}
            />
          </button>
        </div>

        <span className={`status-text fail${pinError ? ' visible' : ''}`}>
          PIN 번호가 틀렸습니다.
        </span>

        <button
          className="setup-start-btn"
          onMouseEnter={() => setStartHover(true)}
          onMouseLeave={() => setStartHover(false)}
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
        >
          <img
            src={startHover && canSubmit ? '/assets/button/start_long2.png' : '/assets/button/start_long1.png'}
            alt="START"
          />
        </button>

      </div>

      {/* 방 코드 */}
      <p className="setup-room-code">ROOM CODE: {roomCode}</p>

      {/* 나가기 확인 팝업 */}
      {showExitPopup && (
        <ConfirmPopup
          message="나가시겠습니까?"
          onYes={() => navigate('/')}
          onNo={() => setShowExitPopup(false)}
        />
      )}

    </div>
  )
}
