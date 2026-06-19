import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import html2canvas from 'html2canvas'
import './LogCreatePage.css'

const API_BASE = 'http://localhost:4000/api'
const SERVER_BASE = 'http://localhost:4000'

const toAbsoluteUrl = (url: string | null | undefined): string | null => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${SERVER_BASE}${url}`
}

const CHARACTER_COLOR_CLASS: Record<string, string> = {
  white:  'logcreate-white',
  green:  'logcreate-green',
  blue:   'logcreate-blue',
  yellow: 'logcreate-yellow',
  red:    'logcreate-pink',
}

const SLOT_COLOR_CLASS: Record<number, string> = {
  1: 'logcreate-white',
  2: 'logcreate-green',
  3: 'logcreate-blue',
  4: 'logcreate-yellow',
  5: 'logcreate-pink',
}

const SLOT_DEFAULT_IMAGE: Record<number, string> = {
  1: '/assets/player/player_white.png',
  2: '/assets/player/player_green.png',
  3: '/assets/player/player_blue.png',
  4: '/assets/player/player_yellow.png',
  5: '/assets/player/player_red.png',
}

type Member = {
  id: number
  nickname: string
  character: string
  colorClass: string
}

export default function LogCreatePage() {
  const navigate = useNavigate()
  const { roomCode } = useParams<{ roomCode: string }>()
  const [homeHover, setHomeHover] = useState(false)
  const [downloadHover, setDownloadHover] = useState(false)
  const cardRef = useRef<HTMLElement>(null)

  const [members, setMembers] = useState<Member[]>([])
  // playerId → imageUrl[] (routineIndex 순서, 최대 4개)
  const [dailyMap, setDailyMap] = useState<Record<number, (string | null)[]>>({})
  // playerId → imageUrl (파티퀘스트)
  const [partyMap, setPartyMap] = useState<Record<number, string>>({})

  const dateText = useMemo(() => {
    const today = new Date()
    const weekList = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const date = String(today.getDate()).padStart(2, '0')
    const day = weekList[today.getDay()]
    return `${year}. ${month}. ${date}. ${day}`
  }, [])

  // 플레이어 목록 fetch
  useEffect(() => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/players-with-routines`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.players) {
          setMembers(json.data.players.map((p: {
            playerId: number
            slotNumber: number
            nickname: string
            skinImageUrl: string | null
            characterType: string | null
          }) => ({
            id: p.playerId,
            nickname: p.nickname,
            character: p.skinImageUrl
              ? (toAbsoluteUrl(p.skinImageUrl) ?? SLOT_DEFAULT_IMAGE[p.slotNumber])
              : (p.characterType
                ? `/assets/player/player_${p.characterType}.png`
                : SLOT_DEFAULT_IMAGE[p.slotNumber]),
            colorClass:
              (p.characterType ? CHARACTER_COLOR_CLASS[p.characterType] : null)
              ?? SLOT_COLOR_CLASS[p.slotNumber]
              ?? 'logcreate-white',
          })))
        }
      })
      .catch(err => console.error('플레이어 조회 실패:', err))
  }, [roomCode])

  // 일일 업로드 fetch
  useEffect(() => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/daily-uploads/today`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.players) {
          const map: Record<number, (string | null)[]> = {}
          for (const p of json.data.players) {
            map[p.playerId] = (p.uploads ?? []).map(
              (u: { imageUrl: string | null }) => toAbsoluteUrl(u.imageUrl)
            )
          }
          setDailyMap(map)
        }
      })
      .catch(err => console.error('일일 업로드 조회 실패:', err))
  }, [roomCode])

  // 당일 마지막 수락 파티퀘스트 fetch
  useEffect(() => {
    if (!roomCode) return
    fetch(`${API_BASE}/rooms/${roomCode}/party-quests/today-last`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.uploads) {
          const map: Record<number, string> = {}
          for (const u of json.data.uploads as { playerId: number; imageUrl: string }[]) {
            const abs = toAbsoluteUrl(u.imageUrl)
            if (abs) map[u.playerId] = abs
          }
          setPartyMap(map)
        }
      })
      .catch(err => console.error('파티 퀘스트 조회 실패:', err))
  }, [roomCode])

  const handleDownload = async () => {
    if (!cardRef.current) return
    const canvas = await html2canvas(cardRef.current, {
      useCORS: true,
      scale: 2,
      backgroundColor: null,
    })
    const link = document.createElement('a')
    link.download = `routinemon-log-${dateText.replace(/\./g, '').replace(/\s/g, '')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="logcreate-page">
      <div className="logcreate-board">
        <header className="logcreate-header">
          <div className="logcreate-logo-area">
            <img className="logcreate-logo" src="/assets/logo/6.png" alt="RoutineMon" />
            <img className="logcreate-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
          </div>
          <button className="logcreate-question-btn">
            <img src="/assets/button/question.png" alt="question" />
          </button>
          <button className="logcreate-back-btn" onClick={() => navigate(-1)}>
            <img src="/assets/button/previous.png" alt="back" />
          </button>
          <button
            className="logcreate-home-btn"
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

        <main className="logcreate-content">
          <section className="logcreate-card" ref={cardRef}>
            <div className="logcreate-card-logo-area">
              <img className="logcreate-card-logo" src="/assets/logo/6.png" alt="RoutineMon" />
              <img className="logcreate-card-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
            </div>

            {/* 멤버 행 */}
            <section className="logcreate-member-row">
              {Array.from({ length: 5 }).map((_, colIndex) => {
                const member = members[colIndex]
                if (!member) return <div className="logcreate-member" key={colIndex} />
                return (
                  <div className="logcreate-member" key={member.id}>
                    <img src={member.character} alt={member.nickname} />
                    <span className="logcreate-member-nickname">{member.nickname}</span>
                  </div>
                )
              })}
            </section>

            {/* 사진 그리드 (5열 × 5행, 마지막 행 = 파티퀘스트) */}
            <section className="logcreate-grid">
              {Array.from({ length: 25 }).map((_, index) => {
                const rowIndex = Math.floor(index / 5)
                const colIndex = index % 5
                const member = members[colIndex]

                if (!member) {
                  return <div className="logcreate-cell" key={index}><div className="logcreate-empty-cell" /></div>
                }

                const isPartyRow = rowIndex === 4
                const image = isPartyRow
                  ? (partyMap[member.id] ?? null)
                  : (dailyMap[member.id]?.[rowIndex] ?? null)

                return (
                  <div className={`logcreate-cell ${member.colorClass}`} key={index}>
                    {image ? (
                      <img className="logcreate-uploaded-img" src={image} alt="routine log" />
                    ) : (
                      <div className={isPartyRow ? 'logcreate-empty-cell logcreate-black-cell' : 'logcreate-empty-cell'} />
                    )}
                  </div>
                )
              })}
            </section>

            <p className="logcreate-date">{dateText}</p>
          </section>

          <button
            className="logcreate-download-btn"
            onMouseEnter={() => setDownloadHover(true)}
            onMouseLeave={() => setDownloadHover(false)}
            onClick={handleDownload}
          >
            <img
              src={downloadHover ? '/assets/button/download_2.png' : '/assets/button/download1.png'}
              alt="download"
            />
          </button>
        </main>
      </div>
    </div>
  )
}
