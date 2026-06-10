import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import './UploadPage.css'

// ── 타입 ─────────────────────────────────────────────────────
type Routine = {
  emoji: string
  content: string
}

type Player = {
  id: number
  nickname: string
  character: string
  colorClass: string
  routines: Routine[]
}

type DailyLogEntry = {
  memberId: number
  routineIndex: number
  imageUrl: string
  uploadedAt: string
}

type PartyLogEntry = {
  memberId: number
  dotIndex: number   // 0~3 (파티퀘스트 시간대)
  imageUrl: string
  uploadedAt: string
}

interface PartyQuestInfo {
  scheduledHour: number  // 1 | 7 | 13 | 19
  content: string
  acceptedAt: string
  expiresAt: string
  dotIndex: number       // 0~3
}

type UploadMode = 'daily' | 'party'
type DeleteMode = 'daily' | 'party'

// ── 상수 ─────────────────────────────────────────────────────
const PARTY_QUEST_LS_KEY = 'activePartyQuestInfo'
const PARTY_LOGS_LS_KEY = 'routinePartyLogs'
const API_BASE = 'http://localhost:4000/api'

// 슬롯 번호 → CSS 색상 클래스 (store의 DEFAULT_PLAYER_COLORS와 동일)
const SLOT_COLOR_CLASS: Record<number, string> = {
  1: 'uploadscreen-white',
  2: 'uploadscreen-green',
  3: 'uploadscreen-blue',
  4: 'uploadscreen-yellow',
  5: 'uploadscreen-red',
}

// 슬롯 번호 → 기본 캐릭터 이미지 (스킨 미설정 시 fallback)
const SLOT_DEFAULT_IMAGE: Record<number, string> = {
  1: '/assets/player/player_white.png',
  2: '/assets/player/player_green.png',
  3: '/assets/player/player_blue.png',
  4: '/assets/player/player_yellow.png',
  5: '/assets/player/player_red.png',
}

const getSecondsUntil = (isoString: string) =>
  Math.max(0, Math.floor((new Date(isoString).getTime() - Date.now()) / 1000))

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function UploadPage() {
  const navigate = useNavigate()
  const { roomCode } = useParams<{ roomCode: string }>()

  // Zustand store에서 현재 플레이어 ID 가져오기
  const myPlayerFromStore = useRoomStore((s) => s.myPlayer)
  const myPlayerId = myPlayerFromStore?.playerId ?? 0

  // ── 플레이어 목록 상태 (API) ──────────────────────────────
  const [players, setPlayers] = useState<Player[]>([])

  useEffect(() => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/players-with-routines`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data?.players) {
          const mapped: Player[] = json.data.players.map((p: {
            playerId: number
            slotNumber: number
            nickname: string
            skinImageUrl: string | null
            routines: { slotNumber: number; emoji: string; title: string }[]
          }) => ({
            id: p.playerId,
            nickname: p.nickname,
            character: p.skinImageUrl ?? SLOT_DEFAULT_IMAGE[p.slotNumber] ?? '/assets/player/player_white.png',
            colorClass: SLOT_COLOR_CLASS[p.slotNumber] ?? 'uploadscreen-white',
            routines: p.routines.map(r => ({ emoji: r.emoji, content: r.title })),
          }))
          setPlayers(mapped)
        }
      })
      .catch(err => console.error('플레이어 목록 조회 실패:', err))
  }, [roomCode])

  const myPlayer = players.find((p) => p.id === myPlayerId) ?? players[0]

  // ── 공통 UI 상태 ──────────────────────────────────────────
  const [homeHover, setHomeHover] = useState(false)

  // ── Daily 상태 ────────────────────────────────────────────
  const [selectedDailyDot, setSelectedDailyDot] = useState(0)
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>(() =>
    JSON.parse(localStorage.getItem('routineDailyLogs') ?? '[]')
  )
  const [showDailyPopup, setShowDailyPopup] = useState(false)
  const [showHelpPopup, setShowHelpPopup] = useState(false)

  // ── Party 상태 ────────────────────────────────────────────
  const [activeQuestInfo] = useState<PartyQuestInfo | null>(() => {
    const saved = localStorage.getItem(PARTY_QUEST_LS_KEY)
    if (!saved) return null
    const info: PartyQuestInfo = JSON.parse(saved)
    if (getSecondsUntil(info.expiresAt) > 0) return info
    return null
  })

  const [selectedPartyDot, setSelectedPartyDot] = useState<number>(
    () => activeQuestInfo?.dotIndex ?? 0
  )

  const [partyLogs, setPartyLogs] = useState<PartyLogEntry[]>(() =>
    JSON.parse(localStorage.getItem(PARTY_LOGS_LS_KEY) ?? '[]')
  )

  const [partyTimeLeft, setPartyTimeLeft] = useState<number>(() =>
    activeQuestInfo ? getSecondsUntil(activeQuestInfo.expiresAt) : 0
  )

  const [showPartyInfoPopup, setShowPartyInfoPopup] = useState(false)

  // ── 업로드 팝업 상태 ──────────────────────────────────────
  const [showUploadPopup, setShowUploadPopup] = useState(false)
  const [uploadMode, setUploadMode] = useState<UploadMode>('daily')
  const [selectedRoutineIndex, setSelectedRoutineIndex] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // ── 삭제 팝업 상태 ────────────────────────────────────────
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('daily')

  // ── Party time left 카운트다운 ─────────────────────────────
  useEffect(() => {
    if (!activeQuestInfo) return
    if (partyTimeLeft <= 0) return
    const timer = window.setInterval(() =>
      setPartyTimeLeft(prev => Math.max(0, prev - 1)), 1000
    )
    return () => clearInterval(timer)
  }, [activeQuestInfo, partyTimeLeft])

  // ── isPartyQuestTime (party 버튼 활성화 여부) ─────────────
  const isPartyQuestActive = useMemo(() => {
    if (!activeQuestInfo) return false
    return partyTimeLeft > 0
  }, [activeQuestInfo, partyTimeLeft])

  // ── Daily 헬퍼 ────────────────────────────────────────────
  const getDailyImage = (playerId: number, routineIndex: number) =>
    dailyLogs.find((log) => log.memberId === playerId && log.routineIndex === routineIndex)

  const allPlayersUploadedForRoutine = (routineIndex: number) =>
    players.every((p) =>
      dailyLogs.some((log) => log.memberId === p.id && log.routineIndex === routineIndex)
    )

  const getDotColor = (dotIndex: number) => {
    if (allPlayersUploadedForRoutine(dotIndex)) return '#F287FB'
    if (dotIndex === selectedDailyDot) return '#B39EFF'
    return '#ffffff'
  }

  // ── Party 헬퍼 ────────────────────────────────────────────
  const getPartyImage = (playerId: number, dotIndex: number) =>
    partyLogs.find((log) => log.memberId === playerId && log.dotIndex === dotIndex)

  const allPlayersUploadedForParty = (dotIndex: number) =>
    players.every((p) =>
      partyLogs.some((log) => log.memberId === p.id && log.dotIndex === dotIndex)
    )

  const getPartyDotColor = (dotIndex: number) => {
    if (allPlayersUploadedForParty(dotIndex)) return '#F287FB'
    if (dotIndex === selectedPartyDot) return '#B39EFF'
    return '#ffffff'
  }

  // 해당 dot이 클릭 가능한 파티퀘스트 슬롯인지 (add.png 표시 조건)
  const isPartySlotActive = (dotIndex: number) =>
    isPartyQuestActive && activeQuestInfo?.dotIndex === dotIndex

  // ── Daily 핸들러 ──────────────────────────────────────────
  const handleOpenDailyUploadPopup = () => {
    if (getDailyImage(myPlayerId, selectedDailyDot)) return

    setUploadMode('daily')
    setSelectedRoutineIndex(selectedDailyDot)
    setPreviewImage(null)
    setShowUploadPopup(true)
  }

  // ── Party 핸들러 ──────────────────────────────────────────
  const handleOpenPartyUploadPopup = (playerId: number) => {
    if (playerId !== myPlayerId) return
    if (!isPartySlotActive(selectedPartyDot)) return
    if (getPartyImage(myPlayerId, selectedPartyDot)) return

    setUploadMode('party')
    setPreviewImage(null)
    setShowUploadPopup(true)
  }

  // ── 공통 업로드 핸들러 ────────────────────────────────────
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setPreviewImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = () => {
    if (!previewImage) return

    const now = new Date()
    const uploadedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    if (uploadMode === 'daily') {
      if (selectedRoutineIndex === null) {
        alert('업로드할 루틴을 선택해주세요.')
        return
      }
      if (getDailyImage(myPlayerId, selectedRoutineIndex)) {
        alert('이미 업로드된 루틴입니다.')
        return
      }
      const newLog: DailyLogEntry = {
        memberId: myPlayerId,
        routineIndex: selectedRoutineIndex,
        imageUrl: previewImage,
        uploadedAt,
      }
      const updatedLogs = [
        ...dailyLogs.filter(
          (log) => !(log.memberId === myPlayerId && log.routineIndex === selectedRoutineIndex)
        ),
        newLog,
      ]
      setDailyLogs(updatedLogs)
      localStorage.setItem('routineDailyLogs', JSON.stringify(updatedLogs))
    } else {
      // party
      const newLog: PartyLogEntry = {
        memberId: myPlayerId,
        dotIndex: selectedPartyDot,
        imageUrl: previewImage,
        uploadedAt,
      }
      const updatedLogs = [
        ...partyLogs.filter(
          (log) => !(log.memberId === myPlayerId && log.dotIndex === selectedPartyDot)
        ),
        newLog,
      ]
      setPartyLogs(updatedLogs)
      localStorage.setItem(PARTY_LOGS_LS_KEY, JSON.stringify(updatedLogs))
    }

    setShowUploadPopup(false)
  }

  const handleCloseUploadPopup = () => {
    setShowUploadPopup(false)
    setSelectedRoutineIndex(null)
    setPreviewImage(null)
  }

  // ── 삭제 핸들러 ───────────────────────────────────────────
  const handleOpenDeletePopup = (
    event: React.MouseEvent<HTMLButtonElement>,
    playerId: number,
    mode: DeleteMode,
  ) => {
    event.stopPropagation()
    if (playerId !== myPlayerId) return

    if (mode === 'daily' && !getDailyImage(playerId, selectedDailyDot)) return
    if (mode === 'party') {
      if (!getPartyImage(playerId, selectedPartyDot)) return
      // 전원 완료 후 삭제 불가
      if (allPlayersUploadedForParty(selectedPartyDot)) return
    }

    setDeleteMode(mode)
    setDeleteTargetId(playerId)
  }

  const handleDeleteImage = () => {
    if (deleteTargetId === null) return

    if (deleteMode === 'daily') {
      const updatedLogs = dailyLogs.filter(
        (log) => !(log.memberId === deleteTargetId && log.routineIndex === selectedDailyDot)
      )
      setDailyLogs(updatedLogs)
      localStorage.setItem('routineDailyLogs', JSON.stringify(updatedLogs))
    } else {
      const updatedLogs = partyLogs.filter(
        (log) => !(log.memberId === deleteTargetId && log.dotIndex === selectedPartyDot)
      )
      setPartyLogs(updatedLogs)
      localStorage.setItem(PARTY_LOGS_LS_KEY, JSON.stringify(updatedLogs))
    }

    setDeleteTargetId(null)
  }

  const handleCancelDelete = () => setDeleteTargetId(null)

  // ── 렌더 ──────────────────────────────────────────────────
  return (
    <div className="uploadscreen-page">
      <div className="uploadscreen-board">

        {/* 헤더 */}
        <header className="uploadscreen-header">
          <div className="uploadscreen-logo-area">
            <img className="uploadscreen-logo" src="/assets/logo/6.png" alt="RoutineMon" />
            <img className="uploadscreen-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
          </div>

          <button className="uploadscreen-question-btn" onClick={() => setShowHelpPopup(true)}>
            <img src="/assets/button/question.png" alt="question" />
          </button>

          <button className="uploadscreen-back-btn" onClick={() => navigate(-1)}>
            <img src="/assets/button/previous.png" alt="back" />
          </button>

          <button
            className="uploadscreen-home-btn"
            onMouseEnter={() => setHomeHover(true)}
            onMouseLeave={() => setHomeHover(false)}
            onClick={() => navigate('/')}
          >
            <img
              src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'}
              alt="home"
            />
          </button>
        </header>

        {/* 상단 버튼 */}
        <div className="uploadscreen-top-buttons">
          <button
            className="uploadscreen-create-btn"
            onClick={() => navigate(`/room/${roomCode}/log-create`)}
          >
            <img src="/assets/button/createlog1.png" alt="create log" />
          </button>

          <button className="uploadscreen-daily-btn" onClick={() => setShowDailyPopup(true)}>
            <img src="/assets/button/daily.png" alt="daily" />
          </button>

          <button
            className={`uploadscreen-party-btn ${
              isPartyQuestActive ? 'uploadscreen-party-active' : 'uploadscreen-party-disabled'
            }`}
            onClick={() => isPartyQuestActive && setShowPartyInfoPopup(true)}
            disabled={!isPartyQuestActive}
          >
            <img
              src={isPartyQuestActive ? '/assets/button/party_2.png' : '/assets/button/party_1.png'}
              alt="party"
            />
          </button>
        </div>

        {/* Dot 행 */}
        <div className="uploadscreen-dots-row">
          <span></span>

          {/* Daily dots */}
          <div className="uploadscreen-dots">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                className="uploadscreen-dot-btn"
                style={{ background: getDotColor(i) }}
                onClick={() => setSelectedDailyDot(i)}
              />
            ))}
          </div>

          {/* Party dots */}
          <div className="uploadscreen-dots">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                className="uploadscreen-dot-btn"
                style={{ background: getPartyDotColor(i) }}
                onClick={() => setSelectedPartyDot(i)}
              />
            ))}
          </div>
        </div>

        {/* 플레이어 리스트 */}
        <section className="uploadscreen-player-list">
          {players.map((player) => {
            const dailyUploaded = getDailyImage(player.id, selectedDailyDot)
            const partyUploaded = getPartyImage(player.id, selectedPartyDot)
            const isMyPlayer = player.id === myPlayerId
            const partyAllDone = allPlayersUploadedForParty(selectedPartyDot)

            return (
              <div className="uploadscreen-player-row" key={player.id}>
                {/* 플레이어 정보 */}
                <div className="uploadscreen-player-info">
                  <img
                    className="uploadscreen-player-img"
                    src={player.character}
                    alt={player.nickname}
                  />
                  <div className="uploadscreen-speech-wrap">
                    <img
                      className="uploadscreen-speech-img"
                      src="/assets/frame/말풍선.png"
                      alt="speech bubble"
                    />
                    <span>
                      {dailyUploaded
                        ? player.routines[selectedDailyDot]?.emoji ?? 'Zzz'
                        : 'Zzz'}
                    </span>
                  </div>
                  <span className={`uploadscreen-player-name ${player.colorClass}`}>
                    {player.nickname}
                  </span>
                </div>

                {/* Daily 슬롯 — 내 칸: button / 다른 플레이어: div */}
                {isMyPlayer ? (
                  <button
                    className={`uploadscreen-upload-slot ${player.colorClass}`}
                    onClick={handleOpenDailyUploadPopup}
                  >
                    {dailyUploaded ? (
                      <>
                        <img
                          className="uploadscreen-uploaded-img"
                          src={dailyUploaded.imageUrl}
                          alt="uploaded"
                        />
                        <span className="uploadscreen-upload-time">{dailyUploaded.uploadedAt}</span>
                        <button
                          type="button"
                          className="uploadscreen-star-btn"
                          onClick={(e) => handleOpenDeletePopup(e, player.id, 'daily')}
                        >
                          <img src="/assets/button/star.png" alt="delete" />
                        </button>
                      </>
                    ) : (
                      <img
                        className="uploadscreen-add-icon"
                        src="/assets/button/add.png"
                        alt="add"
                      />
                    )}
                  </button>
                ) : (
                  <div className={`uploadscreen-upload-slot ${player.colorClass}`}>
                    {dailyUploaded && (
                      <>
                        <img
                          className="uploadscreen-uploaded-img"
                          src={dailyUploaded.imageUrl}
                          alt="uploaded"
                        />
                        <span className="uploadscreen-upload-time">{dailyUploaded.uploadedAt}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Party 슬롯 */}
                <button
                  className={`uploadscreen-party-slot ${player.colorClass}`}
                  onClick={() => handleOpenPartyUploadPopup(player.id)}
                  style={{ cursor: isMyPlayer && isPartySlotActive(selectedPartyDot) && !partyUploaded ? 'pointer' : 'default' }}
                >
                  {partyUploaded ? (
                    <>
                      <img
                        className="uploadscreen-uploaded-img"
                        src={partyUploaded.imageUrl}
                        alt="uploaded"
                      />
                      <span className="uploadscreen-upload-time">{partyUploaded.uploadedAt}</span>
                      {isMyPlayer && !partyAllDone && (
                        <button
                          type="button"
                          className="uploadscreen-star-btn"
                          onClick={(e) => handleOpenDeletePopup(e, player.id, 'party')}
                        >
                          <img src="/assets/button/star.png" alt="delete" />
                        </button>
                      )}
                    </>
                  ) : (
                    isMyPlayer && isPartySlotActive(selectedPartyDot) && (
                      <img
                        className="uploadscreen-add-icon"
                        src="/assets/button/add.png"
                        alt="add"
                      />
                    )
                  )}
                </button>
              </div>
            )
          })}
        </section>

        {/* ── DAILY 팝업 ───────────────────────────────────── */}
        {showDailyPopup && (
          <div className="uploadscreen-popup-backdrop" onClick={() => setShowDailyPopup(false)}>
            <div className="uploadscreen-daily-popup" onClick={(e) => e.stopPropagation()}>
              <h2>Players' Daily Routine</h2>
              <div className="uploadscreen-daily-list">
                {players.map((player) => (
                  <div className="uploadscreen-daily-row" key={player.id}>
                    <span className={`uploadscreen-daily-name ${player.colorClass}`}>
                      {player.nickname}
                    </span>
                    <div className="uploadscreen-daily-routines">
                      {player.routines.map((routine, index) => (
                        <div
                          className="uploadscreen-daily-routine-item"
                          key={`${player.id}-${index}`}
                        >
                          <span className="uploadscreen-daily-emoji">{routine.emoji}</span>
                          <span>{index + 1}. {routine.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="uploadscreen-popup-yes-btn"
                onClick={() => setShowDailyPopup(false)}
              >
                <img src="/assets/button/yes.png" alt="yes" />
              </button>
            </div>
          </div>
        )}

        {/* ── PARTY INFO 팝업 ──────────────────────────────── */}
        {showPartyInfoPopup && activeQuestInfo && (
          <div
            className="uploadscreen-popup-backdrop"
            onClick={() => setShowPartyInfoPopup(false)}
          >
            <div className="uploadscreen-party-info-popup" onClick={(e) => e.stopPropagation()}>
              <h2>Party Quest</h2>
              <p className="uploadscreen-party-quest-text">{activeQuestInfo.content}</p>
              <div className={`uploadscreen-party-timelimit${partyTimeLeft <= 600 ? ' time-critical' : partyTimeLeft <= 1800 ? ' time-warn' : ''}`}>
                time limit {formatTime(partyTimeLeft)}
              </div>
              <button
                className="uploadscreen-popup-yes-btn"
                onClick={() => setShowPartyInfoPopup(false)}
              >
                <img src="/assets/button/yes.png" alt="yes" />
              </button>
            </div>
          </div>
        )}

        {/* ── 업로드 팝업 ──────────────────────────────────── */}
        {showUploadPopup && (
          <div className="uploadscreen-popup-backdrop">
            <div className="uploadscreen-upload-popup">
              <h2>
                {uploadMode === 'party' ? '파티 퀘스트 사진 업로드' : '사진을 업로드 하시겠습니까?'}
              </h2>

              {/* Daily: 루틴 선택 */}
              {uploadMode === 'daily' && (
                <div className="uploadscreen-routine-select-list">
                  {myPlayer.routines.map((routine, index) => {
                    const alreadyUploaded = !!getDailyImage(myPlayerId, index)
                    return (
                      <button
                        key={index}
                        className={`uploadscreen-routine-select-btn ${
                          selectedRoutineIndex === index ? 'uploadscreen-routine-selected' : ''
                        } ${alreadyUploaded ? 'uploadscreen-routine-done' : ''}`}
                        onClick={() => !alreadyUploaded && setSelectedRoutineIndex(index)}
                        disabled={alreadyUploaded}
                      >
                        <span>{alreadyUploaded ? '✓' : routine.emoji} #{index + 1}</span>
                        <p>{alreadyUploaded ? '이미 업로드됨' : routine.content}</p>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Party: 퀘스트 내용 표시 */}
              {uploadMode === 'party' && activeQuestInfo && (
                <p className="uploadscreen-party-quest-hint">
                  {activeQuestInfo.content}
                </p>
              )}

              <label className="uploadscreen-file-label">
                Choose File
                <input type="file" accept="image/*" onChange={handleFileChange} />
              </label>

              <div className="uploadscreen-preview-box">
                {previewImage
                  ? <img src={previewImage} alt="preview" />
                  : <span>선택된 파일 없음</span>
                }
              </div>

              <div className="uploadscreen-popup-actions">
                <button onClick={handleUpload} disabled={!previewImage} className={!previewImage ? 'uploadscreen-btn-disabled' : ''}>
                  <img src="/assets/button/yes.png" alt="yes" />
                </button>
                <button onClick={handleCloseUploadPopup}>
                  <img src="/assets/button/no.png" alt="no" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 도움말 팝업 ──────────────────────────────────── */}
        {showHelpPopup && (
          <div className="uploadscreen-popup-backdrop" onClick={() => setShowHelpPopup(false)}>
            <div className="uploadscreen-help-popup" onClick={(e) => e.stopPropagation()}>
              <h2 className="uploadscreen-help-title">📋 이 페이지 설명</h2>

              <div className="uploadscreen-help-section">
                <p className="uploadscreen-help-section-title">🟣 Daily Routine</p>
                <p className="uploadscreen-help-desc">
                  루틴 번호 점(dot)을 눌러 확인할 루틴을 선택하세요.<br />
                  내 사진 칸을 눌러 오늘의 루틴 인증 사진을 업로드할 수 있어요.<br />
                  사진이 있으면 말풍선에 루틴 이모지가 표시됩니다.
                </p>
              </div>

              <div className="uploadscreen-help-divider" />

              <div className="uploadscreen-help-section">
                <p className="uploadscreen-help-section-title">🎉 Party Quest</p>
                <p className="uploadscreen-help-desc">
                  Room 페이지에서 누군가 퀘스트를 수락하면 활성화돼요.<br />
                  <span className="uploadscreen-help-accent">2시간 이내</span>에 모든 플레이어가 퀘스트 인증 사진을 업로드해야 해요.<br />
                  전원 완료 후에는 사진을 삭제할 수 없어요.
                </p>
              </div>

              <div className="uploadscreen-help-divider" />

              <div className="uploadscreen-help-section">
                <p className="uploadscreen-help-section-title">⬤ Dot 색상 의미</p>
                <div className="uploadscreen-help-dots">
                  <div className="uploadscreen-help-dot-row">
                    <span className="uploadscreen-help-dot" style={{ background: '#ffffff', border: '1px solid #8f6cff' }} />
                    <span>미완료</span>
                  </div>
                  <div className="uploadscreen-help-dot-row">
                    <span className="uploadscreen-help-dot" style={{ background: '#B39EFF' }} />
                    <span>현재 선택</span>
                  </div>
                  <div className="uploadscreen-help-dot-row">
                    <span className="uploadscreen-help-dot" style={{ background: '#F287FB' }} />
                    <span>전원 완료</span>
                  </div>
                </div>
              </div>

              <div className="uploadscreen-help-divider" />

              <div className="uploadscreen-help-section">
                <p className="uploadscreen-help-section-title">⭐ 별 버튼</p>
                <p className="uploadscreen-help-desc">
                  내 사진 우측 하단의 별 버튼으로 업로드한 사진을 삭제할 수 있어요.
                </p>
              </div>

              <div className="uploadscreen-help-divider" />

              <div className="uploadscreen-help-section">
                <p className="uploadscreen-help-section-title">⏱ Time Limit 경고</p>
                <p className="uploadscreen-help-desc">
                  파티 퀘스트 남은 시간이<br />
                  <span className="uploadscreen-help-warn">30분 이하</span>이면 빨간색으로 변해요.<br />
                  <span className="uploadscreen-help-warn">10분 이하</span>이면 빨간색 + 깜빡임으로 알려줘요.
                </p>
              </div>

              <button
                className="uploadscreen-popup-yes-btn"
                style={{ marginTop: '20px' }}
                onClick={() => setShowHelpPopup(false)}
              >
                <img src="/assets/button/yes.png" alt="yes" />
              </button>
            </div>
          </div>
        )}

        {/* ── 삭제 팝업 ────────────────────────────────────── */}
        {deleteTargetId !== null && (
          <div className="uploadscreen-popup-backdrop">
            <div className="uploadscreen-delete-popup">
              <h2>사진을 삭제 하시겠습니까?</h2>
              <div className="uploadscreen-popup-actions">
                <button onClick={handleDeleteImage}>
                  <img src="/assets/button/yes.png" alt="yes" />
                </button>
                <button onClick={handleCancelDelete}>
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
