import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import ConfirmPopup from '../components/ConfirmPopup'
import { createRoom } from '../api/rooms'
import './NicknameSetupPage.css'

const MAX_NICKNAME_LENGTH = 7
const PIN_LENGTH = 4

function validateNickname(value: string): string | null {
  if (value.length === 0) return null
  if (value.length > MAX_NICKNAME_LENGTH) return 'fail'
  if (!/^[a-zA-Z0-9가-힣]+$/.test(value)) return 'fail'
  return 'ok'
}

function validatePin(digits: string[]): string | null {
  const value = digits.join('')
  if (value.length === 0) return null
  if (value.length < PIN_LENGTH) return null
  return 'ok'
}

export default function NicknameSetupPage() {
  const navigate = useNavigate()
  const { roomCode, slotNumber } = useParams<{ roomCode?: string; slotNumber: string }>()

  // roomCode가 없으면 방 신설 중, 있으면 방 참가 중
  const isCreating = !roomCode

  const { setRoom, setPendingPlayer, pendingMaxPlayers } = useRoomStore()

  const [homeHover, setHomeHover] = useState(false)
  const [startHover, setStartHover] = useState(false)
  const [showExitPopup, setShowExitPopup] = useState(false)
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)

  // 닉네임
  const [nickname, setNickname] = useState('')
  const [nicknameStatus, setNicknameStatus] = useState<'ok' | 'fail' | null>(null)
  const [nicknameConfirmed, setNicknameConfirmed] = useState(false)

  // PIN
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', ''])
  const [pinStatus, setPinStatus] = useState<'ok' | 'fail' | null>(null)
  const [pinConfirmed, setPinConfirmed] = useState(false)
  const [pinVisible, setPinVisible] = useState(false)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  const canStart = nicknameStatus === 'ok' && pinStatus === 'ok'

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, MAX_NICKNAME_LENGTH)
    setNickname(val)
    setNicknameConfirmed(false)
    setNicknameStatus(null)
  }

  const handleNicknameConfirm = () => {
    const result = validateNickname(nickname)
    if (result === 'ok') {
      setNicknameStatus('ok')
      setNicknameConfirmed(true)
    } else {
      setNicknameStatus('fail')
      setNicknameConfirmed(false)
    }
  }

  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...pinDigits]
    newDigits[index] = value.slice(-1)
    setPinDigits(newDigits)
    setPinConfirmed(false)
    setPinStatus(null)

    if (value && index < PIN_LENGTH - 1) {
      pinRefs.current[index + 1]?.focus()
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs.current[index - 1]?.focus()
    }
  }

  const handlePinConfirm = () => {
    const result = validatePin(pinDigits)
    if (result === 'ok') {
      setPinStatus('ok')
      setPinConfirmed(true)
    } else {
      setPinStatus('fail')
      setPinConfirmed(false)
    }
  }

  const handleStart = async () => {
    if (!canStart || loading || submittingRef.current) return
    submittingRef.current = true
    const pin = pinDigits.join('')
    const slot = Number(slotNumber)

    setLoading(true)
    try {
      if (isCreating) {
        // 방 신설: 방만 먼저 생성, 플레이어는 루틴 설정 완료 시 등록
        const { roomCode: newCode, roomId } = await createRoom(pendingMaxPlayers)
        setRoom({
          roomId,
          roomCode: newCode,
          roomName: '루틴몬 방',
          maxPlayers: pendingMaxPlayers,
          currentPlayers: 0,
          createdAt: new Date().toISOString(),
        })
        setPendingPlayer({ nickname, pin, slotNumber: slot })
        navigate(`/create/routines`, { replace: true })
      } else {
        // 방 참가: 플레이어 정보 임시 저장, 루틴 설정 완료 시 등록
        setPendingPlayer({ nickname, pin, slotNumber: slot })
        navigate(`/join/${roomCode}/routines`)
      }
    } catch (e) {
      console.error('방 신설/참가 실패:', e)
      submittingRef.current = false
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <div className="setup-container">

      {/* 이전 버튼 */}
      <button className="back-btn" onClick={() => navigate(-1)}>
        <img src="/assets/button/previous.png" alt="back" />
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

        {/* ─── 닉네임 섹션 ─── */}
        <div className="section">
          <p className="section-title">닉네임을 설정해 주세요.</p>
          <p className="section-sub">한글/영문/숫자만 가능, 최대 {MAX_NICKNAME_LENGTH}자</p>

          <div className="input-wrap">
            <img className="input-frame-img" src="/assets/frame/nickpin_frame.png" alt="frame" />
            <input
              className="nickname-input"
              type="text"
              placeholder="닉네임을 입력해 주세요."
              value={nickname}
              maxLength={MAX_NICKNAME_LENGTH}
              onChange={handleNicknameChange}
            />
            <span
              className="char-count"
              style={{ color: nickname.length >= MAX_NICKNAME_LENGTH ? '#FF4444' : '#aaaaaa' }}
            >
              {nickname.length}/{MAX_NICKNAME_LENGTH}
            </span>
          </div>

          <div className="confirm-row">
            <button className="confirm-btn" onClick={handleNicknameConfirm}>
              <img src="/assets/button/confirm.png" alt="CONFIRM" />
            </button>
            {nicknameStatus && (
              <span className={`status-text ${nicknameStatus} ${nicknameStatus ? 'visible' : ''}`}>
                {nicknameStatus}
              </span>
            )}
          </div>
        </div>

        {/* 구분선 */}
        <div className="divider" />

        {/* ─── PIN 섹션 ─── */}
        <div className="section">
          <p className="section-title">개인 입장 PIN을 설정해 주세요.</p>
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

            {/* 눈 버튼 */}
            <button
              className="eye-btn"
              onClick={() => setPinVisible(!pinVisible)}
            >
              <img
                src={pinVisible ? '/assets/button/eye_on.png' : '/assets/button/eye_off.png'}
                alt={pinVisible ? '숨기기' : '보기'}
              />
            </button>
          </div>

          <div className="confirm-row">
            <button className="confirm-btn" onClick={handlePinConfirm}>
              <img src="/assets/button/confirm.png" alt="CONFIRM" />
            </button>
            {pinStatus && (
              <span className={`status-text ${pinStatus} ${pinStatus ? 'visible' : ''}`}>
                {pinStatus}
              </span>
            )}
          </div>
        </div>

        {/* ─── START 버튼 ─── */}
        <button
          className="setup-start-btn"
          onMouseEnter={() => setStartHover(true)}
          onMouseLeave={() => setStartHover(false)}
          onClick={handleStart}
          disabled={!canStart || loading}
        >
          <img
            src={startHover && canStart ? '/assets/button/start_long2.png' : '/assets/button/start_long1.png'}
            alt="START"
          />
        </button>

      </div>

      {/* 방 코드 — 참가 시에만 표시 */}
      {!isCreating && (
        <p className="setup-room-code">ROOM CODE: {roomCode}</p>
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
