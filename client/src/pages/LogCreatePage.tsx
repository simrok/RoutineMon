import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LogCreatePage.css'

type Member = {
  id: number
  nickname: string
  character: string
  colorClass: string
}

type DailyLogImage = {
  memberId: number
  routineIndex: number
  imageUrl: string
  uploadedAt: string
}

type PartyLogImage = {
  memberId: number
  imageUrl: string
  uploadedAt: string
}

const members: Member[] = [
  {
    id: 1,
    nickname: '닉넴',
    character: '/assets/player/player_white.png',
    colorClass: 'logcreate-white',
  },
  {
    id: 2,
    nickname: '닉넴',
    character: '/assets/player/player_blue.png',
    colorClass: 'logcreate-blue',
  },
  {
    id: 3,
    nickname: '닉넴',
    character: '/assets/player/player_green.png',
    colorClass: 'logcreate-green',
  },
  {
    id: 4,
    nickname: '닉넴',
    character: '/assets/player/player_yellow.png',
    colorClass: 'logcreate-yellow',
  },
  {
    id: 5,
    nickname: '닉넴',
    character: '/assets/player/player_red.png',
    colorClass: 'logcreate-pink',
  },
]

export default function LogCreatePage() {
  const navigate = useNavigate()
  const [homeHover, setHomeHover] = useState(false)
  const [downloadHover, setDownloadHover] = useState(false)

  const dailyLogs: DailyLogImage[] = useMemo(() => {
    return JSON.parse(localStorage.getItem('routineDailyLogs') ?? '[]')
  }, [])

  const partyLogs: PartyLogImage[] = useMemo(() => {
    return JSON.parse(localStorage.getItem('routinePartyLogs') ?? '[]')
  }, [])

  const dateText = useMemo(() => {
    const today = new Date()

    const weekList = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const date = String(today.getDate()).padStart(2, '0')
    const day = weekList[today.getDay()]

    return `${year}. ${month}. ${date}. ${day}`
  }, [])

  const getDailyImage = (memberId: number, routineIndex: number) => {
    return dailyLogs.find(
      (log) => log.memberId === memberId && log.routineIndex === routineIndex,
    )
  }

  const getPartyImage = (memberId: number) => {
    return partyLogs.find((log) => log.memberId === memberId)
  }

  const handleDownload = () => {
    alert('다운로드 기능은 추후 연결 예정입니다.')
  }

  return (
    <div className="logcreate-page">
      <div className="logcreate-board">
        <header className="logcreate-header">
          <div className="logcreate-logo-area">
            <img className="logcreate-logo" src="/assets/logo/6.png" alt="RoutineMon" />
            <img className="logcreate-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
          </div>

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
          <section className="logcreate-card">
            <div className="logcreate-card-logo-area">
              <img className="logcreate-card-logo" src="/assets/logo/6.png" alt="RoutineMon" />
              <img className="logcreate-card-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
            </div>

            <section className="logcreate-member-row">
              {members.map((member) => (
                <div className="logcreate-member" key={member.id}>
                  <img src={member.character} alt={member.nickname} />
                  <span>{member.nickname}</span>
                </div>
              ))}
            </section>

            <section className="logcreate-grid">
              {Array.from({ length: 25 }).map((_, index) => {
                const rowIndex = Math.floor(index / 5)
                const columnIndex = index % 5
                const member = members[columnIndex]

                const isPartyRow = rowIndex === 4

                const dailyImage = !isPartyRow
                  ? getDailyImage(member.id, rowIndex)
                  : null

                const partyImage = isPartyRow ? getPartyImage(member.id) : null

                const image = dailyImage?.imageUrl ?? partyImage?.imageUrl

                return (
                  <div
                    className={`logcreate-cell ${member.colorClass}`}
                    key={index}
                  >
                    {image ? (
                      <img
                        className="logcreate-uploaded-img"
                        src={image}
                        alt="routine log"
                      />
                    ) : (
                      <div
                        className={
                          isPartyRow
                            ? 'logcreate-empty-cell logcreate-black-cell'
                            : 'logcreate-empty-cell'
                        }
                      />
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
              src={
                downloadHover
                  ? '/assets/button/download2.png'
                  : '/assets/button/download1.png'
              }
              alt="download"
            />
          </button>
        </main>
      </div>
    </div>
  )
}