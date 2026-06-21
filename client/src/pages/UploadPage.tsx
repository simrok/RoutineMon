import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import { getSocket, joinRoom, leaveRoom } from '../socket'
import { API_BASE, SERVER_BASE } from '../config'
import './UploadPage.css'

// ── 타입 ─────────────────────────────────────────────────────
type Routine = { emoji: string; content: string }

type Player = {
  id: number
  nickname: string
  character: string
  colorClass: string
  routines: Routine[]
}

// 일일 업로드: routineId(DB) + imageUrl + uploadTime (HH:MM)
type DailySlot = { routineId: number; imageUrl: string | null; uploadTime: string | null }

// 파티 퀘스트
type PartyUpload = { playerId: number; imageUrl: string; uploadTime: string | null }

type ActivePartyQuest = {
  partyQuestId: number
  status: string
  expiresAt: string
  scheduledHour: number
  content: string
  uploads: PartyUpload[]
}

type UploadMode = 'daily' | 'party'

const toAbsoluteUrl = (url: string | null) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${SERVER_BASE}${url}`
}


const SLOT_COLOR_CLASS: Record<number, string> = {
  1: 'uploadscreen-white',
  2: 'uploadscreen-green',
  3: 'uploadscreen-blue',
  4: 'uploadscreen-yellow',
  5: 'uploadscreen-red',
}

const CHARACTER_TYPE_COLOR_CLASS: Record<string, string> = {
  white:  'uploadscreen-white',
  green:  'uploadscreen-green',
  blue:   'uploadscreen-blue',
  yellow: 'uploadscreen-yellow',
  red:    'uploadscreen-red',
}
const SLOT_DEFAULT_IMAGE: Record<number, string> = {
  1: '/assets/player/player_white.png',
  2: '/assets/player/player_green.png',
  3: '/assets/player/player_blue.png',
  4: '/assets/player/player_yellow.png',
  5: '/assets/player/player_red.png',
}

const scheduledHourToDotIndex: Record<number, number> = { 1: 0, 7: 1, 13: 2, 19: 3 }

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
  const myPlayerId = useRoomStore((s) => s.myPlayer?.playerId ?? 0)

  // ── 플레이어 목록 ─────────────────────────────────────────
  const [players, setPlayers] = useState<Player[]>([])

  // ── 일일 업로드 상태: playerId → DailySlot[] (index 0~3) ──
  const [dailyMap, setDailyMap] = useState<Record<number, DailySlot[]>>({})

  // ── 파티 퀘스트 ───────────────────────────────────────────
  const [partyQuest, setPartyQuest] = useState<ActivePartyQuest | null>(null)
  const [partyTimeLeft, setPartyTimeLeft] = useState(0)

  // ── UI 상태 ───────────────────────────────────────────────
  const [homeHover, setHomeHover] = useState(false)
  const [selectedDailyDot, setSelectedDailyDot] = useState(0)
  const [selectedPartyDot, setSelectedPartyDot] = useState(0)
  const [showDailyPopup, setShowDailyPopup] = useState(false)
  const [showHelpPopup, setShowHelpPopup] = useState(false)
  const [helpOkHovered, setHelpOkHovered] = useState(false)
  const [showPartyInfoPopup, setShowPartyInfoPopup] = useState(false)
  const [showUploadPopup, setShowUploadPopup] = useState(false)
  const [uploadMode, setUploadMode] = useState<UploadMode>('daily')
  const [selectedRoutineIndex, setSelectedRoutineIndex] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ mode: 'daily' | 'party'; routineId?: number } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [validationState, setValidationState] = useState<'idle' | 'checking' | 'approved' | 'rejected'>('idle')
  const [rejectionReason, setRejectionReason] = useState<string>('')

  // ── 성공 연출 ─────────────────────────────────────────────
  const [showSuccess, setShowSuccess] = useState<'daily' | 'party' | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerSuccess = (type: 'daily' | 'party') => {
    setShowSuccess(type)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setShowSuccess(null), 2800)
  }

  const partyQuestRef = useRef(partyQuest)
  partyQuestRef.current = partyQuest

  // ── 플레이어 목록 fetch ───────────────────────────────────
  useEffect(() => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/players-with-routines`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.players) {
          setPlayers(json.data.players.map((p: {
            playerId: number; slotNumber: number; nickname: string
            skinImageUrl: string | null; characterType: string | null
            routines: { slotNumber: number; emoji: string; title: string }[]
          }) => ({
            id: p.playerId,
            nickname: p.nickname,
            character: p.skinImageUrl ?? (p.characterType ? `/assets/player/player_${p.characterType}.png` : SLOT_DEFAULT_IMAGE[p.slotNumber]) ?? '/assets/player/player_white.png',
            colorClass: (p.characterType ? CHARACTER_TYPE_COLOR_CLASS[p.characterType] : null) ?? SLOT_COLOR_CLASS[p.slotNumber] ?? 'uploadscreen-white',
            routines: p.routines.map(r => ({ emoji: r.emoji, content: r.title })),
          })))
        }
      })
      .catch(err => console.error('플레이어 목록 조회 실패:', err))
  }, [roomCode])

  // ── 일일 업로드 현황 fetch ────────────────────────────────
  const fetchDailyStatus = () => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/daily-uploads/today`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.players) {
          const map: Record<number, DailySlot[]> = {}
          for (const p of json.data.players) {
            map[p.playerId] = p.uploads // [{ routineId, imageUrl, uploadedAt }]
            console.log(`[DEBUG] player ${p.playerId} uploads:`, p.uploads)
          }
          setDailyMap(map)
        }
      })
      .catch(err => console.error('일일 업로드 조회 실패:', err))
  }

  // ── 파티 퀘스트 fetch ─────────────────────────────────────
  const fetchPartyQuest = () => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/party-quests/active`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          const q: ActivePartyQuest = json.data
          const left = getSecondsUntil(q.expiresAt)
          if (left > 0) {
            setPartyQuest(q)
            setPartyTimeLeft(left)
            setSelectedPartyDot(scheduledHourToDotIndex[q.scheduledHour] ?? 0)
          } else {
            setPartyQuest(null)
            setPartyTimeLeft(0)
          }
        } else {
          setPartyQuest(null)
          setPartyTimeLeft(0)
        }
      })
      .catch(err => console.error('파티 퀘스트 조회 실패:', err))
  }

  useEffect(() => {
    fetchDailyStatus()
    fetchPartyQuest()
  }, [roomCode])

  // KST 자정 자동 갱신
  useEffect(() => {
    const msUntilKSTMidnight = () => {
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
      const kstMidnight = new Date(kstNow)
      kstMidnight.setUTCHours(24, 0, 0, 0)
      return kstMidnight.getTime() - kstNow.getTime()
    }
    const timer = setTimeout(() => {
      fetchDailyStatus()
    }, msUntilKSTMidnight() + 1000)
    return () => clearTimeout(timer)
  }, [roomCode])

  // ── 파티 타이머 카운트다운 ────────────────────────────────
  useEffect(() => {
    if (partyTimeLeft <= 0) return
    const timer = setInterval(() => setPartyTimeLeft(p => {
      if (p <= 1) { setPartyQuest(null); return 0 }
      return p - 1
    }), 1000)
    return () => clearInterval(timer)
  }, [partyTimeLeft])

  // ── 소켓 연결 + 이벤트 리스너 ────────────────────────────
  useEffect(() => {
    if (!roomCode) return
    const socket = getSocket()
    joinRoom(roomCode, myPlayerId)

    // 다른 플레이어가 일일 업로드 → 현황 재조회
    socket.on('daily:upload-updated', fetchDailyStatus)
    socket.on('daily:upload-deleted', fetchDailyStatus)

    // 다른 플레이어가 파티 업로드 → 파티 퀘스트 재조회
    socket.on('party-quest:upload-updated', fetchPartyQuest)
    socket.on('party-quest:upload-deleted', fetchPartyQuest)

    // 파티 퀘스트 완료 → 성공 연출 + 재조회
    const handlePartyCompleted = () => {
      triggerSuccess('party')
      fetchPartyQuest()
    }
    socket.on('party-quest:completed', handlePartyCompleted)

    return () => {
      leaveRoom(roomCode, myPlayerId)
      socket.off('daily:upload-updated', fetchDailyStatus)
      socket.off('daily:upload-deleted', fetchDailyStatus)
      socket.off('party-quest:upload-updated', fetchPartyQuest)
      socket.off('party-quest:upload-deleted', fetchPartyQuest)
      socket.off('party-quest:completed', handlePartyCompleted)
    }
  }, [roomCode])

  // ── 헬퍼 ─────────────────────────────────────────────────
  const myPlayer = players.find(p => p.id === myPlayerId) ?? players[0]

  const getDailySlot = (playerId: number, dotIndex: number): DailySlot | null => {
    const slot = dailyMap[playerId]?.[dotIndex]
    return slot?.imageUrl ? slot : null
  }

  const getRoutineId = (playerId: number, dotIndex: number): number | null =>
    dailyMap[playerId]?.[dotIndex]?.routineId ?? null

  const allDailyUploaded = (dotIndex: number) =>
    players.length > 0 && players.every(p => !!dailyMap[p.id]?.[dotIndex]?.imageUrl)

  const getDotColor = (dotIndex: number) => {
    if (allDailyUploaded(dotIndex)) return '#F287FB'
    if (dotIndex === selectedDailyDot) return '#B39EFF'
    return '#ffffff'
  }

  const isPartyQuestActive = !!partyQuest && partyTimeLeft > 0 && partyQuest.status !== 'completed'
  const activeDotIndex = partyQuest ? (scheduledHourToDotIndex[partyQuest.scheduledHour] ?? -1) : -1

  const getPartyUpload = (playerId: number): PartyUpload | null =>
    partyQuest?.uploads.find(u => u.playerId === playerId) ?? null

  const getPartyImage = (playerId: number): string | null =>
    getPartyUpload(playerId)?.imageUrl ?? null

  const allPartyUploaded = () =>
    !!partyQuest && players.length > 0 &&
    players.every(p => partyQuest.uploads.some(u => u.playerId === p.id))

  const getPartyDotColor = (dotIndex: number) => {
    if (dotIndex === activeDotIndex && (partyQuest?.status === 'completed' || allPartyUploaded())) return '#F287FB'
    if (dotIndex === selectedPartyDot) return '#B39EFF'
    return '#ffffff'
  }

  const isPartySlotClickable = (dotIndex: number) =>
    isPartyQuestActive && dotIndex === activeDotIndex

  // ── 핸들러: 일일 업로드 팝업 열기 ────────────────────────
  const handleOpenDailyUpload = () => {
    if (getDailySlot(myPlayerId, selectedDailyDot)) return
    if (!myPlayer?.routines[selectedDailyDot]) return  // 해당 dot에 루틴 없음
    setUploadMode('daily')
    setSelectedRoutineIndex(selectedDailyDot)
    setPreviewImage(null)
    setSelectedFile(null)
    setValidationState('idle')
    setShowUploadPopup(true)
  }

  // ── 핸들러: 파티 업로드 팝업 열기 ────────────────────────
  const handleOpenPartyUpload = (playerId: number) => {
    if (playerId !== myPlayerId) return
    if (!isPartySlotClickable(selectedPartyDot)) return
    if (getPartyImage(myPlayerId)) return
    if (partyQuest?.status === 'completed') return
    setUploadMode('party')
    setPreviewImage(null)
    setSelectedFile(null)
    setValidationState('idle')
    setShowUploadPopup(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setValidationState('idle')
    setRejectionReason('')
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setPreviewImage(reader.result) }
    reader.readAsDataURL(file)
  }

  // ── 핸들러: 업로드 확정 ───────────────────────────────────
  const handleUpload = async () => {
    if (!previewImage || !selectedFile || isUploading) return
    setIsUploading(true)

    // 파티퀘스트는 AI 판별 중 상태 표시
    if (uploadMode === 'party') setValidationState('checking')

    try {
      if (uploadMode === 'daily') {
        const routineId = getRoutineId(myPlayerId, selectedRoutineIndex ?? selectedDailyDot)
        if (!routineId) { alert('루틴 정보를 찾을 수 없습니다.'); return }

        const formData = new FormData()
        formData.append('image', selectedFile)
        formData.append('playerId', String(myPlayerId))
        formData.append('routineId', String(routineId))

        // 업로드 전 현재 완료 수 (3이 되면 일일 퀘스트 완료)
        const prevCount = (dailyMap[myPlayerId] ?? []).filter(s => s?.imageUrl !== null).length

        const res = await fetch(`${API_BASE}/players/${myPlayerId}/daily-uploads`, {
          method: 'POST',
          body: formData,
        })
        const json = await res.json()
        if (!json.success) { alert(json.error ?? '업로드 실패'); return }

        if (prevCount === 2) triggerSuccess('daily')  // 3번째 업로드 → 일일 퀘스트 완료

        fetchDailyStatus()
        setShowUploadPopup(false)
        setPreviewImage(null)
        setSelectedFile(null)
        setSelectedRoutineIndex(null)
      } else {
        if (!partyQuestRef.current) { alert('활성화된 파티 퀘스트가 없습니다.'); return }

        const formData = new FormData()
        formData.append('image', selectedFile)
        formData.append('playerId', String(myPlayerId))

        const res = await fetch(`${API_BASE}/party-quests/${partyQuestRef.current.partyQuestId}/upload`, {
          method: 'POST',
          body: formData,
        })
        const json = await res.json()

        if (!json.success) {
          // AI 판별 실패
          setValidationState('rejected')
          setRejectionReason(json.error ?? '퀘스트 조건에 맞지 않는 사진입니다.')
          return
        }

        // AI 판별 성공
        setValidationState('approved')
        if (json.data?.status === 'completed') triggerSuccess('party')
        fetchPartyQuest()
        setTimeout(() => {
          setShowUploadPopup(false)
          setPreviewImage(null)
          setSelectedFile(null)
          setValidationState('idle')
        }, 1500)
      }
    } catch (err) {
      console.error('업로드 에러:', err)
      setValidationState('idle')
      alert('업로드 중 오류가 발생했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCloseUploadPopup = () => {
    setShowUploadPopup(false)
    setPreviewImage(null)
    setSelectedRoutineIndex(null)
  }

  // ── 핸들러: 삭제 팝업 열기 ───────────────────────────────
  const handleOpenDeletePopup = (
    e: React.MouseEvent<HTMLButtonElement>,
    playerId: number,
    mode: 'daily' | 'party'
  ) => {
    e.stopPropagation()
    if (playerId !== myPlayerId) return
    if (mode === 'daily') {
      const slot = getDailySlot(playerId, selectedDailyDot)
      if (!slot) return
      setDeleteTarget({ mode: 'daily', routineId: slot.routineId })
    } else {
      if (!getPartyImage(playerId)) return
      if (allPartyUploaded()) return
      setDeleteTarget({ mode: 'party' })
    }
  }

  // ── 핸들러: 삭제 확정 ────────────────────────────────────
  const handleDeleteImage = async () => {
    if (!deleteTarget) return

    try {
      if (deleteTarget.mode === 'daily' && deleteTarget.routineId) {
        const res = await fetch(
          `${API_BASE}/players/${myPlayerId}/daily-uploads/${deleteTarget.routineId}`,
          { method: 'DELETE' }
        )
        const json = await res.json()
        if (!json.success) { alert(json.error ?? '삭제 실패'); return }
        fetchDailyStatus()
      } else if (deleteTarget.mode === 'party' && partyQuestRef.current) {
        const res = await fetch(
          `${API_BASE}/party-quests/${partyQuestRef.current.partyQuestId}/uploads/${myPlayerId}`,
          { method: 'DELETE' }
        )
        const json = await res.json()
        if (!json.success) { alert(json.error ?? '삭제 실패'); return }
        fetchPartyQuest()
      }
    } catch (err) {
      console.error('삭제 에러:', err)
    } finally {
      setDeleteTarget(null)
    }
  }

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
            <img src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'} alt="home" />
          </button>
        </header>

        {/* 상단 버튼 */}
        <div className="uploadscreen-top-buttons">
          <button className="uploadscreen-create-btn" onClick={() => navigate(`/room/${roomCode}/log-create`)}>
            <img src="/assets/button/createlog1.png" alt="create log" />
          </button>
          <button className="uploadscreen-daily-btn" onClick={() => setShowDailyPopup(true)}>
            <img src="/assets/button/daily.png" alt="daily" />
          </button>
          <button
            className={`uploadscreen-party-btn ${isPartyQuestActive ? 'uploadscreen-party-active' : 'uploadscreen-party-disabled'}`}
            onClick={() => isPartyQuestActive && setShowPartyInfoPopup(true)}
            disabled={!isPartyQuestActive}
          >
            <img src={isPartyQuestActive ? '/assets/button/party_2.png' : '/assets/button/party_1.png'} alt="party" />
          </button>
        </div>

        {/* Dot 행 */}
        <div className="uploadscreen-dots-row">
          <span></span>
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
            const dailySlot = getDailySlot(player.id, selectedDailyDot)
            const partyImageUrl = getPartyImage(player.id)
            const isMyPlayer = player.id === myPlayerId
            const partyAllDone = allPartyUploaded()
            const partySlotClickable = isPartySlotClickable(selectedPartyDot)

            return (
              <div className="uploadscreen-player-row" key={player.id}>
                {/* 플레이어 정보 */}
                <div className="uploadscreen-player-info">
                  <img className="uploadscreen-player-img" src={player.character} alt={player.nickname} />
                  <div className="uploadscreen-speech-wrap">
                    <img className="uploadscreen-speech-img" src="/assets/frame/말풍선.png" alt="speech bubble" />
                    <span>{dailySlot ? player.routines[selectedDailyDot]?.emoji ?? 'Zzz' : 'Zzz'}</span>
                  </div>
                  <span className={`uploadscreen-player-name ${player.colorClass}`}>{player.nickname}</span>
                </div>

                {/* Daily 슬롯 */}
                {(() => {
                  const hasRoutine = !!player.routines[selectedDailyDot]
                  const slotClickable = isMyPlayer && hasRoutine
                  return (
                    <div
                      className={`uploadscreen-upload-slot ${player.colorClass}`}
                      onClick={slotClickable ? handleOpenDailyUpload : undefined}
                      style={{ cursor: slotClickable ? 'pointer' : 'default' }}
                    >
                      {dailySlot ? (
                        <>
                          <img className="uploadscreen-uploaded-img" src={toAbsoluteUrl(dailySlot.imageUrl)!} alt="uploaded" />
                          {dailySlot.uploadTime && (
                            <span className="uploadscreen-upload-time">{dailySlot.uploadTime}</span>
                          )}
                          {isMyPlayer && (
                            <button type="button" className="uploadscreen-star-btn"
                              onClick={(e) => handleOpenDeletePopup(e, player.id, 'daily')}>
                              <img src="/assets/button/star.png" alt="delete" />
                            </button>
                          )}
                        </>
                      ) : (
                        isMyPlayer && hasRoutine && (
                          <img className="uploadscreen-add-icon" src="/assets/button/add.png" alt="add" />
                        )
                      )}
                    </div>
                  )
                })()}

                {/* Party 슬롯 */}
                <div
                  className={`uploadscreen-party-slot ${player.colorClass}`}
                  onClick={() => handleOpenPartyUpload(player.id)}
                  style={{ cursor: isMyPlayer && partySlotClickable && !partyImageUrl ? 'pointer' : 'default' }}
                >
                  {selectedPartyDot === activeDotIndex ? (
                    partyImageUrl ? (
                      <>
                        <img className="uploadscreen-uploaded-img" src={toAbsoluteUrl(partyImageUrl)!} alt="uploaded" />
                        {getPartyUpload(player.id)?.uploadTime && (
                          <span className="uploadscreen-upload-time">{getPartyUpload(player.id)!.uploadTime}</span>
                        )}
                        {isMyPlayer && !partyAllDone && (
                          <button type="button" className="uploadscreen-star-btn"
                            onClick={(e) => handleOpenDeletePopup(e, player.id, 'party')}>
                            <img src="/assets/button/star.png" alt="delete" />
                          </button>
                        )}
                      </>
                    ) : (
                      isMyPlayer && partySlotClickable && partyQuest?.status !== 'completed' && (
                        <img className="uploadscreen-add-icon" src="/assets/button/add.png" alt="add" />
                      )
                    )
                  ) : null}
                </div>
              </div>
            )
          })}
        </section>

        {/* ── DAILY 팝업 ─────────────────────────────────────── */}
        {showDailyPopup && (
          <div className="uploadscreen-popup-backdrop" onClick={() => setShowDailyPopup(false)}>
            <div className="uploadscreen-daily-popup" onClick={(e) => e.stopPropagation()}>
              <h2>Players' Daily Routine</h2>
              <div className="uploadscreen-daily-list">
                {players.map((player) => (
                  <div className="uploadscreen-daily-row" key={player.id}>
                    <span className={`uploadscreen-daily-name ${player.colorClass}`}>{player.nickname}</span>
                    <div className="uploadscreen-daily-routines">
                      {player.routines.map((routine, index) => (
                        <div className="uploadscreen-daily-routine-item" key={index}>
                          <span className="uploadscreen-daily-emoji">{routine.emoji}</span>
                          <span>{index + 1}. {routine.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button className="uploadscreen-popup-yes-btn" onClick={() => setShowDailyPopup(false)}>
                <img src="/assets/button/yes.png" alt="yes" />
              </button>
            </div>
          </div>
        )}

        {/* ── PARTY INFO 팝업 ────────────────────────────────── */}
        {showPartyInfoPopup && partyQuest && (
          <div className="uploadscreen-popup-backdrop" onClick={() => setShowPartyInfoPopup(false)}>
            <div className="uploadscreen-party-info-popup" onClick={(e) => e.stopPropagation()}>
              <h2>Party Quest</h2>
              <p className="uploadscreen-party-quest-text">{partyQuest.content}</p>
              <div className={`uploadscreen-party-timelimit${partyTimeLeft <= 600 ? ' time-critical' : partyTimeLeft <= 1800 ? ' time-warn' : ''}`}>
                time limit {formatTime(partyTimeLeft)}
              </div>
              <button className="uploadscreen-popup-yes-btn" onClick={() => setShowPartyInfoPopup(false)}>
                <img src="/assets/button/yes.png" alt="yes" />
              </button>
            </div>
          </div>
        )}

        {/* ── 업로드 팝업 ────────────────────────────────────── */}
        {showUploadPopup && (
          <div className="uploadscreen-popup-backdrop">
            <div className="uploadscreen-upload-popup">
              <h2>{uploadMode === 'party' ? '파티 퀘스트 사진 업로드' : '사진을 업로드 하시겠습니까?'}</h2>

              {/* AI 판별 상태 오버레이 (파티퀘스트 전용) */}
              {uploadMode === 'party' && validationState === 'checking' && (
                <div className="uploadscreen-validation-overlay">
                  <div className="uploadscreen-validation-checking">
                    <div className="uploadscreen-pixel-spinner">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="uploadscreen-pixel-spinner-dot" style={{ animationDelay: `${i * 0.11}s` }} />
                      ))}
                    </div>
                    <p>루틴몬이 열심히<br />사진을 판별 중입니다...</p>
                  </div>
                </div>
              )}
              {uploadMode === 'party' && validationState === 'approved' && (
                <div className="uploadscreen-validation-overlay">
                  <div className="uploadscreen-validation-approved">
                    <p>인증 성공!</p>
                  </div>
                </div>
              )}
              {uploadMode === 'party' && validationState === 'rejected' && (
                <div className="uploadscreen-validation-overlay">
                  <div className="uploadscreen-validation-rejected">
                    <p>{rejectionReason}</p>
                    <button className="uploadscreen-retry-btn" onClick={() => {
                      setValidationState('idle')
                      setPreviewImage(null)
                      setSelectedFile(null)
                    }}>다른 사진 선택</button>
                  </div>
                </div>
              )}

              {uploadMode === 'daily' && myPlayer && (
                <div className="uploadscreen-routine-select-list">
                  {myPlayer.routines.map((routine, index) => {
                    const alreadyUploaded = !!getDailySlot(myPlayerId, index)
                    return (
                      <button
                        key={index}
                        className={`uploadscreen-routine-select-btn
                          ${selectedRoutineIndex === index ? 'uploadscreen-routine-selected' : ''}
                          ${alreadyUploaded ? 'uploadscreen-routine-done' : ''}`}
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

              {uploadMode === 'party' && partyQuest && (
                <p className="uploadscreen-party-quest-hint">{partyQuest.content}</p>
              )}

              <label className="uploadscreen-file-label">
                Choose File
                <input type="file" accept="image/*" onChange={handleFileChange} />
              </label>

              <div className="uploadscreen-preview-box">
                {previewImage ? <img src={previewImage} alt="preview" /> : <span>선택된 파일 없음</span>}
              </div>

              <div className="uploadscreen-popup-actions">
                <button onClick={handleUpload} disabled={!previewImage || isUploading}
                  className={!previewImage || isUploading ? 'uploadscreen-btn-disabled' : ''}>
                  <img src="/assets/button/yes.png" alt="yes" />
                </button>
                <button onClick={handleCloseUploadPopup}>
                  <img src="/assets/button/no.png" alt="no" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 도움말 팝업 ────────────────────────────────────── */}
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
                className="uploadscreen-help-ok-btn"
                onClick={() => setShowHelpPopup(false)}
                onMouseEnter={() => setHelpOkHovered(true)}
                onMouseLeave={() => setHelpOkHovered(false)}
              >
                <img src={helpOkHovered ? '/assets/button/ok2.png' : '/assets/button/ok1.png'} alt="OK" />
              </button>
            </div>
          </div>
        )}

        {/* ── 성공 연출 오버레이 ─────────────────────────────── */}
        {showSuccess && (
          <div className="uploadscreen-success-overlay">
            {/* 파티클 별 8개 */}
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`uploadscreen-sparkle uploadscreen-sparkle-${i}`} />
            ))}
            <img
              className="uploadscreen-success-img"
              src="/assets/letter/success.png"
              alt="success"
            />
          </div>
        )}

        {/* ── 삭제 팝업 ──────────────────────────────────────── */}
        {deleteTarget !== null && (
          <div className="uploadscreen-popup-backdrop">
            <div className="uploadscreen-delete-popup">
              <h2>사진을 삭제 하시겠습니까?</h2>
              <div className="uploadscreen-popup-actions">
                <button onClick={handleDeleteImage}><img src="/assets/button/yes.png" alt="yes" /></button>
                <button onClick={() => setDeleteTarget(null)}><img src="/assets/button/no.png" alt="no" /></button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
