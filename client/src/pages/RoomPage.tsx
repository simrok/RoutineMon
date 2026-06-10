import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import './RoomPage.css'

type PartyState = 'none' | 'pending' | 'active'

// ── 파티 퀘스트 상수 ──────────────────────────────────────────
const PARTY_HOURS = [1, 7, 13, 19] // 실제 발생 시각
const HOUR_TO_DOT: Record<number, number> = { 1: 0, 7: 1, 13: 2, 19: 3 }
const COMPLETE_WINDOW_SEC = 7200   // 수락 후 2시간
const PARTY_QUEST_LS_KEY = 'activePartyQuestInfo'

// TODO: API 연동 시 /rooms/:roomCode/party-quests/active 응답으로 교체
const MOCK_QUEST_CONTENT = '주변에 있는 빨간 지붕을 찍어라!'

interface PartyQuestInfo {
  scheduledHour: number // 1 | 7 | 13 | 19
  content: string
  acceptedAt: string    // ISO
  expiresAt: string     // ISO (acceptedAt + 2시간)
  dotIndex: number      // 0~3
}

// 테스트 모드: 3시간 윈도우 (실제: 1시간 수락 창)
const getCurrentPartyHour = (): number | null => {
  const h = new Date().getHours()
  return PARTY_HOURS.find(slot => h >= slot && h < slot + 3) ?? null
}

const getSecondsUntil = (isoString: string) =>
  Math.max(0, Math.floor((new Date(isoString).getTime() - Date.now()) / 1000))

// ─────────────────────────────────────────────────────────────

const initialPlayers = [
  {
    id: 1,
    slotNumber: 1,
    nickname: '닉넴',
    image: '/assets/player/player_white.png',
    rankImage: '/assets/button/ranking/1st.png',
    isMine: true,
    active: true,
  },
  {
    id: 2,
    slotNumber: 2,
    nickname: '닉넴',
    image: '/assets/player/player_blue.png',
    rankImage: '/assets/button/ranking/2nd.png',
    isMine: false,
    active: true,
  },
  {
    id: 3,
    slotNumber: 3,
    nickname: '닉넴',
    image: '/assets/player/player_green.png',
    rankImage: '',
    isMine: false,
    active: true,
  },
  {
    id: 4,
    slotNumber: 4,
    nickname: '닉넴',
    image: '/assets/player/player_yellow.png',
    rankImage: '/assets/button/ranking/3rd.png',
    isMine: false,
    active: true,
  },
  {
    id: 5,
    slotNumber: 5,
    nickname: '',
    image: '',
    rankImage: '',
    isMine: false,
    active: false,
  },
]

export default function RoomPage() {
  const navigate = useNavigate()
  const { roomCode } = useParams<{ roomCode: string }>()

  // ====================
  // STATE
  // ====================
  const [players] = useState(initialPlayers)
  const [homeHover, setHomeHover] = useState(false)
  const [startHover, setStartHover] = useState(false)
  const [showPartyPopup, setShowPartyPopup] = useState(false)
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [copyDone, setCopyDone] = useState(false)

  // ── 파티 퀘스트 상태 (localStorage 기반 초기화) ──────────────
  const [activeQuestInfo, setActiveQuestInfo] = useState<PartyQuestInfo | null>(() => {
    const saved = localStorage.getItem(PARTY_QUEST_LS_KEY)
    if (!saved) return null
    const info: PartyQuestInfo = JSON.parse(saved)
    if (getSecondsUntil(info.expiresAt) > 0) return info
    localStorage.removeItem(PARTY_QUEST_LS_KEY)
    return null
  })

  const [partyState, setPartyState] = useState<PartyState>(() => {
    const saved = localStorage.getItem(PARTY_QUEST_LS_KEY)
    if (saved) {
      const info: PartyQuestInfo = JSON.parse(saved)
      if (getSecondsUntil(info.expiresAt) > 0) return 'active'
      localStorage.removeItem(PARTY_QUEST_LS_KEY)
    }
    return getCurrentPartyHour() !== null ? 'pending' : 'none'
  })

  // active: 완료까지 남은 시간 (localStorage에서 복원)
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const saved = localStorage.getItem(PARTY_QUEST_LS_KEY)
    if (!saved) return COMPLETE_WINDOW_SEC
    const info: PartyQuestInfo = JSON.parse(saved)
    return getSecondsUntil(info.expiresAt)
  })

  // pending: 수락 마감까지 남은 시간
  const [acceptTimeLeft, setAcceptTimeLeft] = useState<number>(() => {
    const hour = getCurrentPartyHour()
    if (hour === null) return 0
    const now = new Date()
    // 실제: scheduledHour + 1:00 까지 / 테스트: 그것도 지났으면 +3:00 기준
    let deadline = new Date()
    deadline.setHours(hour + 1, 0, 0, 0)
    if (deadline <= now) deadline.setHours(hour + 3, 0, 0, 0)
    return Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000))
  })

  // ====================
  // DATA VARIABLES
  // ====================
  const mon = {
    name: '아기 고녕이',
    image: '/assets/routinemon/cat/cat1.png',
    face: partyState === 'active' ? 'O - O' : partyState === 'pending' ? '0 . 0' : 'Zz',
    level: 3,
    step: 'BABY',
    exp: 80,
    expImage: '/assets/expBar/exp8.png',
  }

  const activePlayerCount = players.filter((player) => player.active).length
  const dailyCompletedCount = 2
  const partyCompletedCount = partyState === 'active' ? 1 : 0

  const questContent = activeQuestInfo?.content ?? MOCK_QUEST_CONTENT

  // 수락 마감 시각 텍스트 (ex: "02:00까지 수락 가능")
  const acceptDeadlineText = useMemo(() => {
    const hour = getCurrentPartyHour()
    if (hour === null) return ''
    return `${String(hour + 1).padStart(2, '0')}:00까지 수락 가능`
  }, [])

  // ====================
  // FUNCTIONS
  // ====================
  const getQuestProgressImage = (totalPlayers: number, completedPlayers: number) => {
    const total = String(totalPlayers).padStart(2, '0')
    const completed = String(completedPlayers).padStart(2, '0')
    return `/assets/questProcess/star${total}${completed}.png`
  }

  const handleStart = () => {
    navigate(`/room/${roomCode}/upload`)
  }

  const handleAddPlayerSlot = (slotNumber: number) => {
    navigate(`/room/${roomCode}/setup/${slotNumber}`)
  }

  const handleAcceptPartyQuest = () => {
    const scheduledHour = getCurrentPartyHour() ?? 1
    const now = new Date()
    const expiresAt = new Date(now.getTime() + COMPLETE_WINDOW_SEC * 1000).toISOString()

    const info: PartyQuestInfo = {
      scheduledHour,
      content: MOCK_QUEST_CONTENT, // TODO: API 연동 시 교체
      acceptedAt: now.toISOString(),
      expiresAt,
      dotIndex: HOUR_TO_DOT[scheduledHour] ?? 0,
    }

    localStorage.setItem(PARTY_QUEST_LS_KEY, JSON.stringify(info))
    setActiveQuestInfo(info)
    setTimeLeft(COMPLETE_WINDOW_SEC)
    setPartyState('active')
    setShowPartyPopup(false)
  }

  const handleRejectPartyQuest = () => {
    setPartyState('none')
    setShowPartyPopup(false)
  }

  // ── 설정 핸들러 ───────────────────────────────────────────
  const myPlayer = useRoomStore((s) => s.myPlayer)

  const handleCopyRoomCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    })
  }

  const handleShareRoom = async () => {
    const shareData = {
      title: 'RoutineMon',
      text: `같이 루틴 키울래? 방 코드: ${roomCode}`,
      url: `${window.location.origin}/join/${roomCode}`,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (e) {
        // 사용자가 공유 취소한 경우 무시
      }
    } else {
      // Web Share API 미지원 브라우저: URL 복사로 폴백
      navigator.clipboard.writeText(shareData.url)
      alert('링크가 복사되었습니다.')
    }
  }

  const handleLeaveRoom = async () => {
    if (!myPlayer?.playerId) {
      navigate('/')
      return
    }
    try {
      await fetch(`http://localhost:4000/api/players/${myPlayer.playerId}/leave`, {
        method: 'DELETE',
      })
    } catch (e) {
      console.error('방 나가기 실패:', e)
    }
    localStorage.removeItem(PARTY_QUEST_LS_KEY)
    navigate('/')
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  // ====================
  // EFFECTS
  // ====================
  // active: 완료 타이머 (만료 시 자동 해제)
  useEffect(() => {
    if (partyState !== 'active') return
    if (timeLeft <= 0) {
      localStorage.removeItem(PARTY_QUEST_LS_KEY)
      setActiveQuestInfo(null)
      setPartyState('none')
      return
    }
    const timer = window.setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [partyState, timeLeft])

  // pending: 수락 마감 타이머 (만료 시 자동 해제)
  useEffect(() => {
    if (partyState !== 'pending') return
    if (acceptTimeLeft <= 0) {
      setPartyState('none')
      return
    }
    const timer = window.setInterval(() => {
      setAcceptTimeLeft(prev => {
        if (prev <= 1) { setPartyState('none'); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [partyState, acceptTimeLeft])

  // ====================
  // RENDER
  // ====================
  return (
    <div className="roompage-container">
      <div className="roompage-phone">
        
        {/* HEADER */}
        <header className="roompage-header">
          <div className="roompage-logo-area">
            <img className="roompage-logo" src="/assets/logo/6.png" alt="RoutineMon" />
            <img className="roompage-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
          </div>

          <div className="roompage-side-buttons">
            <button
              className="roompage-side-btn-home"
              onMouseEnter={() => setHomeHover(true)}
              onMouseLeave={() => setHomeHover(false)}
              onClick={() => navigate('/')}
            >
              <img src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'} alt="home" />
            </button>

            <button className="roompage-side-btn-dex" onClick={() => navigate(`/room/${roomCode}/dex`)}>
              <img src="/assets/button/dic1.png" alt="dex" />
            </button>

            <button className="roompage-side-btn-custom" onClick={() => navigate(`/room/${roomCode}/custom/1`)}>
              <img src="/assets/button/custom1.png" alt="custom" />
            </button>

            <button className="roompage-side-btn-setting" onClick={() => setShowSettingsPopup(true)}>
              <img src="/assets/button/setting1.png" alt="setting" />
            </button>
          </div>
        </header>

        {/* MON STATUS */}
        <section className="roompage-mon-area">
          <div className="roompage-mon-left">
            <div className="roompage-mon-frame">
              <img className="roompage-mon-frame-img" src="/assets/frame/mon_frame.png" alt="mon frame" />
              <img className="roompage-main-mon" src={mon.image} alt={mon.name} />
            </div>

            <p className="roompage-mon-name">{mon.name}</p>
          </div>

          <div className="roompage-mon-right">
            <button className="roompage-question-btn">
              <img src="/assets/button/question.png" alt="question" />
            </button>

            <div className="roompage-face-bubble">
              <img src="/assets/frame/상태창1.png" alt="status bubble" />
              <span>{mon.face}</span>
            </div>

            <div className="roompage-level-text">
              <p>LV. {mon.level}</p>
              <p>STEP. {mon.step}</p>
            </div>
          </div>
        </section>

        {/* EXP BAR */}
        <section className="roompage-exp-area">
          <span className="roompage-exp-label">EXP</span>
          <span className="roompage-exp-value">{mon.exp} / 100 %</span>

          <div className="roompage-exp-wrap">
            <img className="roompage-exp-frame" src="/assets/expBar/exp_frame.png" alt="exp frame" />
            <img className="roompage-exp-fill-img" src={mon.expImage} alt="exp" />
          </div>
        </section>

        {/* PLAYERS */}
        <section className="roompage-player-area">
          <div className="roompage-player-title">
            <span>PLAYERS</span>
          </div>

          <div className="roompage-player-list">
            {players.map((player) => (
              <div className="roompage-player-item" key={player.slotNumber}>
                {player.rankImage && player.active && (
                  <img className="roompage-rank-img" src={player.rankImage} alt="rank" />
                )}

                <button
                  className={`${
                    player.isMine ? 'roompage-player-card1' : 'roompage-player-card2'
                  } ${!player.active ? 'roompage-player-card-empty' : ''}`}
                  onClick={() => {
                    if (!player.active) handleAddPlayerSlot(player.slotNumber)
                  }}
                  disabled={player.active}
                >
                  <img
                    className={player.isMine ? 'roompage-player-frame1' : 'roompage-player-frame2'}
                    src={player.isMine ? '/assets/frame/캐릭터슬롯창1.png' : '/assets/frame/캐릭터슬롯창2.png'}
                    alt="player frame"
                  />

                  {player.active ? (
                    <img className={player.isMine ? 'roompage-player-mon1' : 'roompage-player-mon2'}src={player.image}alt={player.nickname}/>
                  ) : (
                    <img className="roompage-add-icon" src="/assets/button/add.png" alt="add" />
                  )}
                </button>

                {player.active && (
                  <div className="roompage-nickname-wrap">
                    <img src="/assets/frame/nickname_frame.png" alt="nickname frame" />
                    <span>{player.nickname || 'Unknown'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* START BUTTON */}
        <button
          className="roompage-start-btn"
          onMouseEnter={() => setStartHover(true)}
          onMouseLeave={() => setStartHover(false)}
          onClick={handleStart}
        >
          <img src={startHover ? '/assets/button/questStart2.png' : '/assets/button/questStart1.png'} alt="start" />
        </button>

        {/* DAILY QUEST BOX */}
        <section className="roompage-daily-box">
          <button className="roompage-box-question">
            <img src="/assets/button/question.png" alt="question" />
          </button>

          <h2>일일 퀘스트 진행도</h2>

          <img
            className="roompage-quest-stars"
            src={getQuestProgressImage(activePlayerCount, dailyCompletedCount)}
            alt="daily progress"
          />
        </section>

        {/* PARTY QUEST BOX */}
        <section className="roompage-party-box">
          <button className="roompage-box-question">
            <img src="/assets/button/question.png" alt="question" />
          </button>

          <h2>파티 퀘스트</h2>

          {partyState === 'none' && (
            <p className="roompage-party-empty">
              현재 파티 퀘스트가 없습니다.
            </p>
          )}

          {partyState === 'pending' && (
            <>
              <p className="roompage-party-quest-content">{questContent}</p>
              <p className="roompage-party-alert">
                파티 퀘스트가 발생했습니다!<br />
                {acceptDeadlineText} ({formatTime(acceptTimeLeft)})
              </p>
              <div className="roompage-party-actions">
                <button onClick={() => setShowPartyPopup(true)}>
                  <img src="/assets/button/yes.png" alt="yes" />
                </button>
                <button onClick={handleRejectPartyQuest}>
                  <img src="/assets/button/no.png" alt="no" />
                </button>
              </div>
            </>
          )}

          {partyState === 'active' && (
            <>
              <p className="roompage-party-active">{questContent}</p>
              <img
                className="roompage-party-stars"
                src={getQuestProgressImage(activePlayerCount, partyCompletedCount)}
                alt="party progress"
              />
              <div className={`roompage-time-limit${timeLeft <= 600 ? ' time-critical' : timeLeft <= 1800 ? ' time-warn' : ''}`}>
                time limit {formatTime(timeLeft)}
              </div>
            </>
          )}
        </section>

        {/* 설정 팝업 */}
        {showSettingsPopup && (
          <div className="roompage-modal-backdrop" onClick={() => { setShowSettingsPopup(false); setShowLeaveConfirm(false) }}>
            <div className="roompage-settings-popup" onClick={(e) => e.stopPropagation()}>
              <p className="roompage-settings-title">SETTINGS</p>

              {/* 방 코드 복사 */}
              <div className="roompage-settings-section">
                <p className="roompage-settings-label">ROOM CODE</p>
                <div className="roompage-settings-code-row">
                  <span className="roompage-settings-code">{roomCode}</span>
                  <button className="roompage-settings-copy-btn" onClick={handleCopyRoomCode}>
                    {copyDone ? '✓ 복사됨' : '복사'}
                  </button>
                </div>
              </div>

              {/* 공유 버튼 */}
              <button className="roompage-settings-share-btn" onClick={handleShareRoom}>
                🔗 방 링크 공유하기
              </button>

              <div className="roompage-settings-divider" />

              {/* 방 탈퇴 */}
              {!showLeaveConfirm ? (
                <button
                  className="roompage-settings-leave-btn"
                  onClick={() => setShowLeaveConfirm(true)}
                >
                  방 탈퇴하기
                </button>
              ) : (
                <div className="roompage-settings-confirm">
                  <p className="roompage-settings-confirm-text">탈퇴하면 내 루틴과 기록이<br />모두 삭제됩니다. 계속할까요?</p>
                  <div className="roompage-settings-confirm-actions">
                    <button className="roompage-settings-confirm-yes" onClick={handleLeaveRoom}>
                      <img src="/assets/button/yes.png" alt="yes" />
                    </button>
                    <button className="roompage-settings-confirm-no" onClick={() => setShowLeaveConfirm(false)}>
                      <img src="/assets/button/no.png" alt="no" />
                    </button>
                  </div>
                </div>
              )}

              <div className="roompage-settings-divider" />

              {/* 닫기 */}
              <button
                className="roompage-settings-close-btn"
                onClick={() => { setShowSettingsPopup(false); setShowLeaveConfirm(false) }}
              >
                <img src="/assets/button/yes.png" alt="close" />
              </button>
            </div>
          </div>
        )}

        {/* MODAL */}
        {showPartyPopup && (
          <div className="roompage-modal-backdrop">
            <div className="roompage-party-modal">
              
              <div className="roompage-modal-frame-wrapper">
                <img
                  className="roompage-modal-frame-img"
                  src="/assets/frame/퀘스트창.png" 
                  alt="quest frame"
                />

                <button
                  className="roompage-invisible-close-btn"
                  onClick={() => setShowPartyPopup(false)}
                />

                <div className="roompage-modal-content-overlay">
                  <p>{questContent}</p>
                  <div className="roompage-modal-timer-box">
                    수락 시 time limit 2:00:00
                  </div>
                </div>
              </div>

              <div className="roompage-modal-actions">
                <button className="roompage-modal-yes" onClick={handleAcceptPartyQuest}>
                  <img src="/assets/button/yes.png" alt="yes" />
                </button>
                <button className="roompage-modal-no" onClick={handleRejectPartyQuest}>
                  <img src="/assets/button/no.png" alt="no" />
                </button>
              </div>
              
            </div>
          </div>
        )}
      </div>
    </div>
  )
}