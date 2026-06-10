import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './RoomPage.css'

type PartyState = 'none' | 'pending' | 'active'

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
  const [partyState, setPartyState] = useState<PartyState>('pending')
  const [showPartyPopup, setShowPartyPopup] = useState(false)
  const [timeLeft, setTimeLeft] = useState(7200)

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
    setPartyState('active')
    setShowPartyPopup(false)
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
  useEffect(() => {
    let timer: number;
    if (partyState === 'active' && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [partyState, timeLeft])

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

            <button className="roompage-side-btn-setting">
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
            <span>PLAYER</span>
            <button>
              <img src="/assets/button/question.png" alt="question" />
            </button>
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
              현재 파티 퀘스트가 활성화 되지 않았습니다.
            </p>
          )}

          {partyState === 'pending' && (
            <>
              <p className="roompage-party-alert">
                파티 퀘스트가 발생했습니다! 수락하시겠습니까?
              </p>

              <div className="roompage-party-actions">
                <button onClick={() => setShowPartyPopup(true)}>
                  <img src="/assets/button/yes.png" alt="yes" />
                </button>

                <button onClick={() => setPartyState('none')}>
                  <img src="/assets/button/no.png" alt="no" />
                </button>
              </div>
            </>
          )}

          {partyState === 'active' && (
            <>
              <p className="roompage-party-active">
                주변에 있는 빨간 지붕을 찍어라!
              </p>

              <img
                className="roompage-party-stars"
                src={getQuestProgressImage(activePlayerCount, partyCompletedCount)}
                alt="party progress"
              />

              <div className="roompage-time-limit">
                time limit {formatTime(timeLeft)}
              </div>
            </>
          )}
        </section>

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
                  <p>주변에 있는 빨간 지붕을 찍어라!</p>
                  <div className="roompage-modal-timer-box">
                    time limit 2:00:00
                  </div>
                </div>
              </div>

              <button className="roompage-modal-yes" onClick={handleAcceptPartyQuest}>
                YES
              </button>
              
            </div>
          </div>
        )}
      </div>
    </div>
  )
}