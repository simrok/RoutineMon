import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import { getSocket, joinRoom, leaveRoom } from '../socket'
import { useBgm } from '../context/BgmContext'
import { API_BASE } from '../config'
import './RoomPage.css'

type PartyState = 'none' | 'pending' | 'active'

// ── 플레이어 슬롯 ─────────────────────────────────────────────
interface PlayerSlot {
  id: number
  slotNumber: number
  nickname: string
  image: string
  characterType: string
  isMine: boolean
  active: boolean
}

const SLOT_DEFAULT_IMAGE: Record<number, string> = {
  1: '/assets/player/player_white.png',
  2: '/assets/player/player_green.png',
  3: '/assets/player/player_blue.png',
  4: '/assets/player/player_yellow.png',
  5: '/assets/player/player_red.png',
}

const CHARACTER_TYPE_COLOR: Record<string, string> = {
  white:  '#ffffff',
  green:  '#00e78c',
  blue:   '#14e8ff',
  yellow: '#fff700',
  red:    '#ff1b14',
}

const TOTAL_SLOTS = 5

const getCharacterImage = (characterType: string | null, slotNumber: number): string => {
  if (characterType) return `/assets/player/player_${characterType}.png`
  return SLOT_DEFAULT_IMAGE[slotNumber] ?? '/assets/player/player_white.png'
}

const getRankImage = (rank: number): string => {
  if (rank === 1) return '/assets/button/ranking/1st.png'
  if (rank === 2) return '/assets/button/ranking/2nd.png'
  if (rank === 3) return '/assets/button/ranking/3rd.png'
  return ''
}

interface MonData {
  monId: number
  catalogId: number | null
  catalogName: string | null
  stage: string        // 'egg' | 'baby' | 'child' | 'adult'
  level: number
  expPercentage: number
}

// ── 파티 퀘스트 상수 ──────────────────────────────────────────
const HOUR_TO_DOT: Record<number, number> = { 1: 0, 7: 1, 13: 2, 19: 3 }

interface PendingQuestInfo {
  partyQuestId: number
  content: string
  scheduledHour: number
}

interface ActiveQuestInfo {
  partyQuestId: number
  content: string
  scheduledHour: number
  expiresAt: string  // ISO
  dotIndex: number
}

const getSecondsUntil = (isoString: string) =>
  Math.max(0, Math.floor((new Date(isoString).getTime() - Date.now()) / 1000))

// ─────────────────────────────────────────────────────────────

// ── 루틴몬 헬퍼 함수 ─────────────────────────────────────────
const CATALOG_FOLDER: Record<number, string> = { 1: 'cat', 2: 'dino', 3: 'panda' }

const getMonName = (stage: string, catalogName: string | null): string => {
  const s = stage.toLowerCase()
  if (s === 'egg' || !catalogName) return '???의 알'
  if (s === 'baby') return `아기 ${catalogName}`
  if (s === 'child') return `어린이 ${catalogName}`
  return `어른이 ${catalogName}` // adult
}

const getMonImage = (stage: string, catalogId: number | null): string => {
  const s = stage.toLowerCase()
  if (s === 'egg' || !catalogId) return '/assets/routinemon/egg.png'
  const folder = CATALOG_FOLDER[catalogId]
  if (!folder) return '/assets/routinemon/egg.png'
  const num = s === 'baby' ? 1 : s === 'child' ? 2 : 3
  return `/assets/routinemon/${folder}/${folder}${num}.png`
}

const getExpImage = (exp: number): string => {
  const idx = Math.min(10, Math.floor(exp / 10))
  return `/assets/expBar/exp${idx}.png`
}

function MonInfoOkBtn({ onClose }: { onClose: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      className="mon-info-ok-btn"
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={hovered ? '/assets/button/ok2.png' : '/assets/button/ok1.png'} alt="OK" />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────

export default function RoomPage() {
  const navigate = useNavigate()
  const { roomCode } = useParams<{ roomCode: string }>()

  // ====================
  // STORE / BGM
  // ====================
  const myPlayer = useRoomStore((s) => s.myPlayer)
  const myPlayerId = myPlayer?.playerId ?? 0
  const { muted, volume, setMuted, setVolume } = useBgm()

  // ====================
  // STATE
  // ====================
  const [players, setPlayers] = useState<PlayerSlot[]>([])
  const [maxPlayers, setMaxPlayers] = useState(0)
  const [monData, setMonData] = useState<MonData | null>(null)
  const [monFaceData, setMonFaceData] = useState<{ consecutiveDays: number; inactiveDays: number; todayAllCompleted: boolean }>({ consecutiveDays: 0, inactiveDays: 0, todayAllCompleted: false })
  const [partyQuestCompletedAt, setPartyQuestCompletedAt] = useState<number | null>(null)
  const [dailyQuestProgress, setDailyQuestProgress] = useState<{ completedCount: number; totalCount: number }>({ completedCount: 0, totalCount: 0 })
  const [partyUploadCount, setPartyUploadCount] = useState(0)
  const [homeHover, setHomeHover] = useState(false)
  const [startHover, setStartHover] = useState(false)
  const [showPartyPopup, setShowPartyPopup] = useState(false)
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [copyDone, setCopyDone] = useState(false)
  const [showMonInfo, setShowMonInfo] = useState(false)
  const [showPlayersInfo, setShowPlayersInfo] = useState(false)
  const [showDailyInfo, setShowDailyInfo] = useState(false)
  const [showPartyInfo, setShowPartyInfo] = useState(false)
  const [showAddSlotConfirm, setShowAddSlotConfirm] = useState(false)
  const [showAddSlotResult, setShowAddSlotResult] = useState(false)
  const [settingsOkHovered, setSettingsOkHovered] = useState(false)
  const [contributionCounts, setContributionCounts] = useState<Record<number, number>>({})

  // ── 파티 퀘스트 상태 (서버 API 기반) ──────────────────────────
  const [pendingQuestInfo, setPendingQuestInfo] = useState<PendingQuestInfo | null>(null)
  const [activeQuestInfo, setActiveQuestInfo] = useState<ActiveQuestInfo | null>(null)
  const [partyState, setPartyState] = useState<PartyState>('none')
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [acceptTimeLeft, setAcceptTimeLeft] = useState<number>(0)

  // ── 자동 축소 ────────────────────────────────────────────────
  const [pageScale, setPageScale] = useState(1)

  useEffect(() => {
    const CONTENT_HEIGHT = 880
    const updateScale = () => {
      const scale = Math.min(1, window.innerHeight / CONTENT_HEIGHT)
      setPageScale(scale)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  // ====================
  // EFFECTS
  // ====================

  // 플레이어 목록 fetch
  useEffect(() => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/players-with-routines`)
      .then(res => res.json())
      .then(json => {
        if (!json.success || !json.data?.players) return

        if (json.data.maxPlayers) setMaxPlayers(json.data.maxPlayers)

        const activePlayers: PlayerSlot[] = json.data.players.map((p: {
          playerId: number
          slotNumber: number
          nickname: string
          characterType: string | null
          skinImageUrl: string | null
        }) => ({
          id: p.playerId,
          slotNumber: p.slotNumber,
          nickname: p.nickname,
          image: p.skinImageUrl ?? getCharacterImage(p.characterType, p.slotNumber),
          characterType: p.characterType ?? 'white',
          isMine: p.playerId === myPlayerId,
          active: true,
        }))

        // 나머지 빈 슬롯 (TOTAL_SLOTS까지)
        const filledSlots = new Set(activePlayers.map(p => p.slotNumber))
        const emptySlots: PlayerSlot[] = Array.from({ length: TOTAL_SLOTS }, (_, i) => i + 1)
          .filter(slotNum => !filledSlots.has(slotNum))
          .map(slotNum => ({
            id: -slotNum,
            slotNumber: slotNum,
            nickname: '',
            image: '',
            characterType: 'white',
            isMine: false,
            active: false,
          }))

        const allSlots = [...activePlayers, ...emptySlots]
          .sort((a, b) => a.slotNumber - b.slotNumber)

        setPlayers(allSlots)
      })
      .catch(err => console.error('플레이어 목록 조회 실패:', err))
  }, [roomCode, myPlayerId])

  // 몬 + 일일퀘스트 진행도 fetch
  const fetchMon = () => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}`)
      .then(res => res.json())
      .then(json => {
        if (!json.success) return
        if (json.data?.mon) setMonData(json.data.mon)
        if (json.data?.dailyQuestProgress) setDailyQuestProgress(json.data.dailyQuestProgress)
      })
      .catch(err => console.error('방 정보 조회 실패:', err))
  }

  const fetchMonFace = () => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/mon-face`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) setMonFaceData(json.data)
      })
      .catch(err => console.error('mon-face 조회 실패:', err))
  }

  // 파티 퀘스트 업로드 수 fetch
  const fetchPartyProgress = () => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/party-quest`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          const uploads = json.data?.uploads ?? []
          setPartyUploadCount(uploads.length)
        }
      })
      .catch(err => console.error('파티 퀘스트 조회 실패:', err))
  }

  // 파티 퀘스트 상태 fetch (서버에서 pending/active 조회)
  const fetchPartyQuestState = async () => {
    if (!roomCode) return
    try {
      // 1. 활성 퀘스트 확인
      const activeRes = await fetch(`${API_BASE}/rooms/${roomCode}/party-quests/active`)
      const activeJson = await activeRes.json()
      if (activeJson.success && activeJson.data) {
        const q = activeJson.data
        if (q.status === 'completed') {
          // 완료된 퀘스트가 있어도 return 하지 않고 pending 퀘스트 체크로 이어짐
          // (이전 시간대 completed가 새 시간대 pending을 가리는 버그 방지)
          setPartyState('none')
          setActiveQuestInfo(null)
        } else {
          const secs = getSecondsUntil(q.expiresAt)
          if (secs > 0) {
            setActiveQuestInfo({
              partyQuestId: q.partyQuestId,
              content: q.content,
              scheduledHour: q.scheduledHour,
              expiresAt: q.expiresAt,
              dotIndex: HOUR_TO_DOT[q.scheduledHour] ?? 0,
            })
            setTimeLeft(secs)
            setPartyState('active')
            setPartyUploadCount((q.uploads ?? []).length)
            return
          }
        }
      }
      // 2. 대기 중인 퀘스트 확인
      const pendingRes = await fetch(`${API_BASE}/rooms/${roomCode}/party-quests/pending`)
      const pendingJson = await pendingRes.json()
      if (pendingJson.success && pendingJson.data) {
        const q = pendingJson.data
        const now = new Date()
        const deadline = new Date()
        deadline.setHours(q.scheduledHour + 2, 30, 0, 0)
        if (deadline <= now) deadline.setDate(deadline.getDate() + 1)
        const secs = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000))
        setPendingQuestInfo({ partyQuestId: q.partyQuestId, content: q.content, scheduledHour: q.scheduledHour })
        setAcceptTimeLeft(secs)
        setPartyState('pending')
        return
      }
      // 3. 없음
      setPartyState('none')
      setPendingQuestInfo(null)
      setActiveQuestInfo(null)
    } catch (err) {
      console.error('파티 퀘스트 상태 조회 실패:', err)
    }
  }


  useEffect(() => {
    fetchMon()
    fetchMonFace()
    fetchPartyQuestState()
  }, [roomCode])

  // 기여도 집계 fetch
  const fetchContributionCounts = () => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/players/contribution-counts`)
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          const map: Record<number, number> = {}
          for (const item of json.data) map[item.playerId] = item.count
          setContributionCounts(map)
        }
      })
      .catch(err => console.error('기여도 조회 실패:', err))
  }

  useEffect(() => {
    fetchContributionCounts()
  }, [roomCode])

  // 소켓: 업로드/몬 이벤트 수신
  useEffect(() => {
    if (!roomCode) return
    const socket = getSocket()
    joinRoom(roomCode, myPlayerId)

    // 일일 업로드 변경 → 기여도 + 진행도 갱신
    const handleDailyUpload = () => {
      fetchContributionCounts()
      fetchMon()
    }
    socket.on('daily:upload-updated', handleDailyUpload)
    socket.on('daily:upload-deleted', handleDailyUpload)

    // 파티 업로드 변경 → 기여도 + 파티 진행도 갱신
    const handlePartyUpload = () => {
      fetchContributionCounts()
      fetchPartyProgress()
    }
    socket.on('party-quest:upload-updated', handlePartyUpload)
    socket.on('party-quest:upload-deleted', handlePartyUpload)

    // 일일 퀘스트 전원 완료 → mon + face 갱신
    const handleDailyQuestCompleted = () => {
      fetchMon()
      fetchMonFace()
    }
    socket.on('daily:quest-completed', handleDailyQuestCompleted)

    // EXP 직접 업데이트
    const handleExpUpdated = (data: { expPercentage: string; level: number; stage: string }) => {
      setMonData(prev => prev ? {
        ...prev,
        expPercentage: parseFloat(data.expPercentage),
        level: data.level,
        stage: data.stage,
      } : prev)
    }
    socket.on('mon:exp-updated', handleExpUpdated)

    // 진화
    const handleEvolved = (data: { newStage: string; catalogId: number | null }) => {
      setMonData(prev => prev ? {
        ...prev,
        stage: data.newStage,
        catalogId: data.catalogId,
        level: 1,
        expPercentage: 0,
      } : prev)
    }
    socket.on('mon:evolved', handleEvolved)

    // 파티 퀘스트 완료 → UI 즉시 비활성화 + face 갱신
    const handlePartyCompleted = () => {
      setPartyQuestCompletedAt(Date.now())
      setPartyState('none')
      setActiveQuestInfo(null)
      fetchMonFace()
    }
    socket.on('party-quest:completed', handlePartyCompleted)

    // 파티 퀘스트 수락됨 (다른 플레이어가 수락한 경우 상태 동기화)
    const handlePartyQuestAccepted = (_data: { partyQuestId: number; acceptedByPlayerId: number; expiresAt: string }) => {
      fetchPartyQuestState()
    }
    socket.on('party-quest:accepted', handlePartyQuestAccepted)

    // 새 파티 퀘스트 발생 (크론이 생성 시 방송)
    const handlePartyQuestNew = (data: { partyQuestId: number; content: string; scheduledHour: number }) => {
      const now = new Date()
      const deadline = new Date()
      deadline.setHours(data.scheduledHour + 2, 30, 0, 0)
      if (deadline <= now) deadline.setDate(deadline.getDate() + 1)
      const secs = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000))
      setPendingQuestInfo({ partyQuestId: data.partyQuestId, content: data.content, scheduledHour: data.scheduledHour })
      setAcceptTimeLeft(secs)
      setPartyState('pending')
    }
    socket.on('party-quest:new', handlePartyQuestNew)

    // 파티 퀘스트 수락 마감 만료
    const handlePartyQuestFailed = (_data: { partyQuestId: number; reason: string }) => {
      setPartyState(prev => prev === 'pending' ? 'none' : prev)
      setPendingQuestInfo(null)
    }
    socket.on('party-quest:failed', handlePartyQuestFailed)

    return () => {
      leaveRoom(roomCode, myPlayerId)
      socket.off('daily:upload-updated', handleDailyUpload)
      socket.off('daily:upload-deleted', handleDailyUpload)
      socket.off('party-quest:upload-updated', handlePartyUpload)
      socket.off('party-quest:upload-deleted', handlePartyUpload)
      socket.off('daily:quest-completed', handleDailyQuestCompleted)
      socket.off('mon:exp-updated', handleExpUpdated)
      socket.off('mon:evolved', handleEvolved)
      socket.off('party-quest:completed', handlePartyCompleted)
      socket.off('party-quest:accepted', handlePartyQuestAccepted)
      socket.off('party-quest:new', handlePartyQuestNew)
      socket.off('party-quest:failed', handlePartyQuestFailed)
    }
  }, [roomCode])

  // ====================
  // DATA VARIABLES
  // ====================
  const monStage = monData?.stage ?? 'egg'

  const computeMonFace = (): string => {
    const now = Date.now()
    // 우선순위 1: 파티 퀘스트 완료 후 30분 이내
    if (partyQuestCompletedAt && (now - partyQuestCompletedAt) < 30 * 60 * 1000) return '(OvO)/'
    // 우선순위 2: 3일 이상 연속 일일 퀘스트 완료
    if (monFaceData.consecutiveDays >= 3) return '^o^  ★'
    // 우선순위 3: EXP 80% 이상 (진화 임박)
    if ((monData?.expPercentage ?? 0) >= 80) return '>o<'
    // 우선순위 4: 오늘 전원 완료
    if (monFaceData.todayAllCompleted) return 'O o O'
    // 우선순위 5~8: 미진행 일수
    const inactive = monFaceData.inactiveDays
    if (inactive >= 6) return 'x _ x'
    if (inactive >= 2) return 'Zz'
    if (inactive >= 1) return 'o _ o'
    return 'o(^▽^)o'
  }

  const mon = {
    name: getMonName(monStage, monData?.catalogName ?? null),
    image: getMonImage(monStage, monData?.catalogId ?? null),
    face: computeMonFace(),
    level: monData?.level ?? 1,
    step: monStage.toUpperCase(),
    exp: monData?.expPercentage ?? 0,
    expImage: getExpImage(monData?.expPercentage ?? 0),
  }

  const activePlayerCount = players.filter((player) => player.active).length
  const dailyCompletedCount = dailyQuestProgress.completedCount

  // ── 기여도 랭킹 계산 (서버 API 기반) ────────────────────────
  const playersWithRanks = useMemo(() => {
    // 업로드 기록이 1건 이상인 활성 플레이어만 랭킹 대상
    const sorted = players
      .filter((p) => p.active && (contributionCounts[p.id] ?? 0) > 0)
      .map((p) => ({ id: p.id, count: contributionCounts[p.id] ?? 0 }))
      .sort((a, b) => b.count - a.count)

    // 동점 처리: 같은 횟수면 같은 등수 (dense ranking)
    const rankMap: Record<number, string> = {}
    let prevCount = -1
    let rank = 0
    sorted.forEach((p, i) => {
      if (p.count !== prevCount) { rank = i + 1; prevCount = p.count }
      rankMap[p.id] = rank <= 3 ? getRankImage(rank) : ''
    })

    return players.map((p) => ({ ...p, rankImage: rankMap[p.id] ?? '' }))
  }, [players, contributionCounts])
  const partyCompletedCount = partyState === 'active' ? partyUploadCount : 0

  const questContent = activeQuestInfo?.content ?? pendingQuestInfo?.content ?? ''

  // 수락 마감 시각 텍스트 (ex: "02:00까지 수락 가능")
  const acceptDeadlineText = useMemo(() => {
    if (!pendingQuestInfo) return ''
    const hour = pendingQuestInfo.scheduledHour
    return `${String(hour + 2).padStart(2, '0')}:30까지 수락 가능`
  }, [pendingQuestInfo])

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

  const handleAddPlayerSlot = () => {
    setShowAddSlotConfirm(true)
  }

  const handleConfirmAddSlot = async () => {
    if (!roomCode) return
    setShowAddSlotConfirm(false)
    try {
      const res = await fetch(`${API_BASE}/rooms/${roomCode}/max-players`, { method: 'PATCH' })
      const json = await res.json()
      if (json.success) {
        setMaxPlayers(json.data.maxPlayers)
        setShowAddSlotResult(true)
      } else {
        alert(json.error ?? '인원 추가 실패')
      }
    } catch {
      alert('서버 연결 오류')
    }
  }

  const handleAcceptPartyQuest = async () => {
    if (!pendingQuestInfo) return
    try {
      const res = await fetch(`${API_BASE}/party-quests/${pendingQuestInfo.partyQuestId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: myPlayerId }),
      })
      const json = await res.json()
      if (!json.success) {
        alert(json.error ?? '수락 실패')
        return
      }
      const expiresAt: string = json.data.expiresAt
      const secs = getSecondsUntil(expiresAt)
      setActiveQuestInfo({
        partyQuestId: pendingQuestInfo.partyQuestId,
        content: pendingQuestInfo.content,
        scheduledHour: pendingQuestInfo.scheduledHour,
        expiresAt,
        dotIndex: HOUR_TO_DOT[pendingQuestInfo.scheduledHour] ?? 0,
      })
      setPendingQuestInfo(null)
      setTimeLeft(secs)
      setPartyState('active')
      setShowPartyPopup(false)
    } catch {
      alert('서버 연결 오류')
    }
  }

  const handleRejectPartyQuest = () => {
    setPartyState('none')
    setPendingQuestInfo(null)
    setShowPartyPopup(false)
  }

  // ── 설정 핸들러 ───────────────────────────────────────────
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
      await fetch(`${API_BASE}/players/${myPlayer.playerId}/leave`, {
        method: 'DELETE',
      })
    } catch (e) {
      console.error('방 나가기 실패:', e)
    }
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
      setActiveQuestInfo(null)
      setPartyState('none')
      setPartyUploadCount(0)
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
      setPendingQuestInfo(null)
      return
    }
    const timer = window.setInterval(() => {
      setAcceptTimeLeft(prev => {
        if (prev <= 1) { setPartyState('none'); setPendingQuestInfo(null); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [partyState, acceptTimeLeft])

  // ====================
  // RENDER
  // ====================
  return (
    <div className="roompage-outer">
      <div
        className="roompage-container"
        style={{
          transform: `scale(${pageScale})`,
          transformOrigin: 'top center',
        }}
      >
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
            <button className="roompage-question-btn" onClick={() => setShowMonInfo(true)}>
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
            <img className="roompage-exp-fill-img" src={mon.expImage} alt="exp" />
          </div>
        </section>

        {/* PLAYERS */}
        <section className="roompage-player-area">
          <div className="roompage-player-title">
            <span>PLAYERS</span>
            <button className="roompage-players-question-btn" onClick={() => setShowPlayersInfo(true)}>
              <img src="/assets/button/question.png" alt="question" />
            </button>
          </div>

          <div className="roompage-player-list">
            {playersWithRanks
              .filter(player => player.active || player.slotNumber <= maxPlayers + 1)
              .map((player) => (
              <div className="roompage-player-item" key={player.slotNumber}>
                {player.rankImage && player.active && (
                  <img className="roompage-rank-img" src={player.rankImage} alt="rank" />
                )}

                {(() => {
                  const isOpenSlot = !player.active && player.slotNumber <= maxPlayers
                  const isExpandBtn = !player.active && player.slotNumber === maxPlayers + 1
                  return (
                    <button
                      className={`${
                        player.isMine ? 'roompage-player-card1' : 'roompage-player-card2'
                      } ${isOpenSlot ? 'roompage-player-card-open' : ''}`}
                      onClick={() => { if (isExpandBtn) handleAddPlayerSlot() }}
                      disabled={player.active || isOpenSlot}
                    >
                      <img
                        className={player.isMine ? 'roompage-player-frame1' : 'roompage-player-frame2'}
                        src={player.isMine ? '/assets/frame/캐릭터슬롯창1.png' : '/assets/frame/캐릭터슬롯창2.png'}
                        alt="player frame"
                      />
                      {player.active ? (
                        <img className={player.isMine ? 'roompage-player-mon1' : 'roompage-player-mon2'} src={player.image} alt={player.nickname} />
                      ) : isOpenSlot ? (
                        <span className="roompage-open-slot-label">OPEN</span>
                      ) : (
                        <img className="roompage-add-icon" src="/assets/button/add.png" alt="add" />
                      )}
                    </button>
                  )
                })()}

                {player.active && (
                  <div className="roompage-nickname-wrap">
                    <span style={{ color: CHARACTER_TYPE_COLOR[player.characterType] ?? '#ffffff' }}>{player.nickname || 'Unknown'}</span>
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
          <button className="roompage-box-question" onClick={() => setShowDailyInfo(true)}>
            <img src="/assets/button/question.png" alt="question" />
          </button>

          <h2>일일 퀘스트 진행도</h2>

          <img
            className="roompage-quest-stars"
            src={getQuestProgressImage(dailyQuestProgress.totalCount || activePlayerCount, dailyCompletedCount)}
            alt="daily progress"
          />
        </section>

        {/* PARTY QUEST BOX */}
        <section className="roompage-party-box">
          <button className="roompage-box-question" onClick={() => setShowPartyInfo(true)}>
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
                src={getQuestProgressImage(dailyQuestProgress.totalCount || activePlayerCount, partyCompletedCount)}
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

              {/* BGM 설정 */}
              <div className="roompage-settings-section">
                <p className="roompage-settings-label">BGM</p>
                <div className="roompage-settings-bgm-row">
                  <button
                    className="roompage-settings-bgm-btn"
                    onClick={() => setMuted(!muted)}
                  >
                    <img
                      src={muted ? '/assets/button/speaker2.png' : '/assets/button/speaker1.png'}
                      alt="speaker"
                    />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setVolume(v)
                      if (v > 0 && muted) setMuted(false)
                      if (v === 0) setMuted(true)
                    }}
                    className="roompage-settings-volume-slider"
                  />
                </div>
              </div>

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
                onMouseEnter={() => setSettingsOkHovered(true)}
                onMouseLeave={() => setSettingsOkHovered(false)}
              >
                <img src={settingsOkHovered ? '/assets/button/ok2.png' : '/assets/button/ok1.png'} alt="OK" />
              </button>
            </div>
          </div>
        )}

        {/* MON INFO POPUP */}
        {showMonInfo && (
          <div className="mon-info-backdrop" onClick={() => setShowMonInfo(false)}>
            <div className="mon-info-popup" onClick={e => e.stopPropagation()}>
              <h2 className="mon-info-title">🐣 루틴몬 성장 시스템</h2>

              <div className="mon-info-section">
                <p className="mon-info-section-title">🥚 성장 단계</p>
                <p className="mon-info-desc">
                  EGG → BABY → CHILD → ADULT 순서로 진화해요.<br />
                  각 단계는 <span className="mon-info-accent">LV1 → LV2</span>로 성장합니다.
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">⚡ EXP 획득</p>
                <p className="mon-info-desc">
                  파티 전원이 일일 퀘스트를 완료하면<br />
                  <span className="mon-info-accent">+20 EXP</span>를 획득합니다.
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">🌟 진화 조건</p>
                <p className="mon-info-desc">
                  LV2에서 EXP <span className="mon-info-accent">100%</span>를 채우면<br />
                  다음 단계로 진화합니다!
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">🎲 첫 진화</p>
                <p className="mon-info-desc">
                  알 단계에서 처음 진화할 때<br />
                  루틴몬 종류가 <span className="mon-info-accent">랜덤</span>으로 결정됩니다.
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">😶 루틴몬 상태</p>
                <p className="mon-info-desc">
                  방 전체 퀘스트 진행 상황에 따라 변화해요.<br /><br />
                  <span className="mon-info-face">(OvO)/</span> 파티 퀘스트 완료 후 30분 이내<br />
                  <span className="mon-info-face">^o^  ★</span> 3일 이상 연속 일일 퀘스트 완료<br />
                  <span className="mon-info-face">&gt;o&lt;</span> EXP 80% 이상 (진화 임박)<br />
                  <span className="mon-info-face">O o O</span> 오늘 일일 퀘스트 완료<br />
                  <span className="mon-info-face">o(^▽^)o</span> 기본 상태<br />
                  <span className="mon-info-face">o _ o</span> 1일 미진행 (경고)<br />
                  <span className="mon-info-face">Zz</span> 2~5일 미진행 (EXP -5% / 일)<br />
                  <span className="mon-info-face">x _ x</span> 6일 이상 미진행 (EXP -10% / 일)
                </p>
              </div>

              <MonInfoOkBtn onClose={() => setShowMonInfo(false)} />
            </div>
          </div>
        )}

        {/* PLAYERS INFO POPUP */}
        {showPlayersInfo && (
          <div className="mon-info-backdrop" onClick={() => setShowPlayersInfo(false)}>
            <div className="mon-info-popup" onClick={e => e.stopPropagation()}>
              <h2 className="mon-info-title">👥 플레이어 시스템</h2>

              <div className="mon-info-section">
                <p className="mon-info-section-title">➕ 인원 추가</p>
                <p className="mon-info-desc">
                  빈 슬롯의 <span className="mon-info-accent">+ 버튼</span>을 눌러<br />
                  새 플레이어를 추가할 수 있어요.<br />
                  최대 <span className="mon-info-accent">5명</span>까지 함께할 수 있습니다.
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">🏆 기여도 랭킹</p>
                <p className="mon-info-desc">
                  매일 루틴 사진을 업로드하면<br />
                  기여도가 <span className="mon-info-accent">누적</span>됩니다.<br />
                  파티 퀘스트 업로드도 기여도에 포함돼요!
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">🥇 배지 조건</p>
                <p className="mon-info-desc">
                  업로드가 <span className="mon-info-accent">1회 이상</span>인 플레이어만<br />
                  랭킹 배지를 받을 수 있어요.<br />
                  동점이면 같은 등수가 표시됩니다.
                </p>
              </div>

              <MonInfoOkBtn onClose={() => setShowPlayersInfo(false)} />
            </div>
          </div>
        )}

        {/* DAILY QUEST INFO POPUP */}
        {showDailyInfo && (
          <div className="mon-info-backdrop" onClick={() => setShowDailyInfo(false)}>
            <div className="mon-info-popup" onClick={e => e.stopPropagation()}>
              <h2 className="mon-info-title">📋 일일 퀘스트</h2>

              <div className="mon-info-section">
                <p className="mon-info-section-title">🎯 퀘스트란?</p>
                <p className="mon-info-desc">
                  각 플레이어가 설정한 <span className="mon-info-accent">루틴 4개</span> 중<br />
                  매일 <span className="mon-info-accent">3개 이상</span>을 인증 사진으로<br />
                  업로드하면 완료입니다.
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">⭐ 진행도 표시</p>
                <p className="mon-info-desc">
                  별 개수는 오늘 퀘스트를 완료한<br />
                  플레이어 수를 나타냅니다.<br />
                  <span className="mon-info-accent">전원 완료</span> 시 루틴몬 EXP +20!
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">📸 인증 방법</p>
                <p className="mon-info-desc">
                  Upload 버튼을 눌러 루틴별로<br />
                  사진을 업로드하세요.<br />
                  <span className="mon-info-accent">자정(00:00)</span>에 하루가 초기화됩니다.
                </p>
              </div>

              <MonInfoOkBtn onClose={() => setShowDailyInfo(false)} />
            </div>
          </div>
        )}

        {/* PARTY QUEST INFO POPUP */}
        {showPartyInfo && (
          <div className="mon-info-backdrop" onClick={() => setShowPartyInfo(false)}>
            <div className="mon-info-popup" onClick={e => e.stopPropagation()}>
              <h2 className="mon-info-title">🎉 파티 퀘스트</h2>

              <div className="mon-info-section">
                <p className="mon-info-section-title">⏰ 발생 시간</p>
                <p className="mon-info-desc">
                  하루 4번 (<span className="mon-info-accent">01:00 / 07:00 / 13:00 / 19:00</span>)<br />
                  랜덤 퀘스트가 발생합니다.<br />
                  진행도 도트로 발생 시간대를 확인하세요.
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">✅ 수락 & 완료</p>
                <p className="mon-info-desc">
                  퀘스트 발생 후 <span className="mon-info-accent">2시간 30분</span> 안에<br />
                  수락 여부를 결정하세요.<br />
                  수락한 인원이 <span className="mon-info-accent">전원 업로드</span>하면 완료!
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">🌟 완료 보상</p>
                <p className="mon-info-desc">
                  파티 퀘스트 완료 시<br />
                  루틴몬 EXP <span className="mon-info-accent">추가 획득</span>!<br />
                  기여도 랭킹에도 반영됩니다.
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">❌ 거절 / 만료</p>
                <p className="mon-info-desc">
                  거절하거나 시간 내 수락하지 않으면<br />
                  해당 시간대 퀘스트는 <span className="mon-info-accent">소멸</span>됩니다.
                </p>
              </div>

              <MonInfoOkBtn onClose={() => setShowPartyInfo(false)} />
            </div>
          </div>
        )}

        {/* 인원 추가 확인 팝업 */}
        {showAddSlotConfirm && (
          <div className="roompage-modal-backdrop" onClick={() => setShowAddSlotConfirm(false)}>
            <div className="roompage-add-slot-popup" onClick={e => e.stopPropagation()}>
              <p className="roompage-add-slot-title">인원 추가</p>
              <p className="roompage-add-slot-desc">
                플레이어 {maxPlayers + 1} 슬롯을 열겠습니까?<br />
                새 멤버가 방 코드로 입장할 수 있게 됩니다.
              </p>
              <div className="roompage-add-slot-btns">
                <button className="roompage-add-slot-confirm" onClick={handleConfirmAddSlot}>확인</button>
                <button className="roompage-add-slot-cancel" onClick={() => setShowAddSlotConfirm(false)}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* 인원 추가 완료 — 방 코드 공유 팝업 */}
        {showAddSlotResult && (
          <div className="roompage-modal-backdrop" onClick={() => setShowAddSlotResult(false)}>
            <div className="roompage-add-slot-popup" onClick={e => e.stopPropagation()}>
              <p className="roompage-add-slot-title">슬롯 추가 완료</p>
              <p className="roompage-add-slot-desc">
                새 멤버에게 방 코드를 공유하세요.<br />
                방 코드를 입력하면 빈 슬롯을 선택해<br />
                입장할 수 있어요.
              </p>
              <div className="roompage-add-slot-code">{roomCode}</div>
              <button
                className="roompage-add-slot-copy"
                onClick={() => {
                  navigator.clipboard.writeText(roomCode ?? '')
                  setShowAddSlotResult(false)
                }}
              >
                코드 복사 후 닫기
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
    </div>
  )
}
    