import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRoom } from '../api/rooms'
import { useRoomStore } from '../store/useRoomStore'
import { useBgm } from '../context/BgmContext'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const { setRoom, setPendingMaxPlayers, reset } = useRoomStore()
  const { muted, setMuted } = useBgm()

  const [selectedPlayers, setSelectedPlayers] = useState<number | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [hoveredNum, setHoveredNum] = useState<number | null>(null)
  const [createHover, setCreateHover] = useState(false)
  const [startHover, setStartHover] = useState(false)
  const [homeHover, setHomeHover] = useState(false)
  const [loading, setLoading] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [cardIndex, setCardIndex] = useState(0)
  const TOTAL_CARDS = 4

  const mainRef = useRef<HTMLDivElement>(null)
  const howtoRef = useRef<HTMLDivElement>(null)

  const scrollToMain  = () => mainRef.current?.scrollIntoView({ behavior: 'smooth' })
  const scrollToHowto = () => howtoRef.current?.scrollIntoView({ behavior: 'smooth' })

  const handleCreateRoom = () => {
    if (!selectedPlayers) return
    reset()
    setPendingMaxPlayers(selectedPlayers)
    navigate('/create/select')
  }

  const handleJoinRoom = async () => {
    if (roomCode.length !== 6) return
    setLoading(true)
    setJoinError('')
    try {
      const room = await getRoom(roomCode)
      setRoom(room)
      navigate(`/join/${roomCode}/select`)
    } catch (e) {
      setJoinError('존재하지 않는 방 코드입니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-page">
    <div className="landing-outer">
      {/* 섹션 이동 버튼 */}
      <button className="landing-nav-btn landing-nav-up"   onClick={scrollToMain}  aria-label="위로" />
      <button className="landing-nav-btn landing-nav-down" onClick={scrollToHowto} aria-label="아래로" />

      <div className="landing-snap-container">

        {/* ────── 섹션 1: 메인 ────── */}
        <section ref={mainRef} className="landing-section">
          <div className="landing-section-inner">

            {/* 스피커 버튼 */}
            <button className="speaker-btn" onClick={() => setMuted(!muted)}>
              <img src={muted ? '/assets/button/speaker2.png' : '/assets/button/speaker1.png'} alt="speaker" />
            </button>

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
                  disabled={!selectedPlayers}
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
              <div className="join-section-row">
                <div className="roomcode-frame">
                  <img src="/assets/frame/roomcode.png" alt="roomcode frame" />
                  <input
                    id="roomcode-input"
                    name="roomCode"
                    className="roomcode-input"
                    placeholder="방 코드 입력"
                    value={roomCode}
                    maxLength={6}
                    onChange={(e) => {
                      setRoomCode(e.target.value.replace(/\D/g, ''))
                      setJoinError('')
                    }}
                  />
                </div>
                <button
                  className="start-btn"
                  onMouseEnter={() => setStartHover(true)}
                  onMouseLeave={() => setStartHover(false)}
                  onClick={handleJoinRoom}
                  disabled={loading || roomCode.length !== 6}
                >
                  <img
                    src={startHover ? '/assets/button/start2.png' : '/assets/button/start1.png'}
                    alt="START"
                  />
                </button>
              </div>
              {joinError && <p className="join-error">{joinError}</p>}
            </div>

            {/* 캐릭터 퍼레이드 */}
            <div className="landing-characters">
              {[
                { src: '/assets/player/player_red.png',    alt: 'red',    delay: '0s'     },
                { src: '/assets/player/player_white.png',  alt: 'white',  delay: '-3.2s'  },
                { src: '/assets/player/player_blue.png',   alt: 'blue',   delay: '-6.4s'  },
                { src: '/assets/player/player_yellow.png', alt: 'yellow', delay: '-9.6s'  },
                { src: '/assets/player/player_green.png',  alt: 'green',  delay: '-12.8s' },
              ].map(({ src, alt, delay }) => (
                <div key={alt} className="landing-char-walker" style={{ animationDelay: delay }}>
                  <img className="landing-char" src={src} alt={alt} />
                  <div className="landing-char-shadow" />
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ────── 섹션 2: HOW TO PLAY ────── */}
        <section ref={howtoRef} className="landing-section">
          <div className="landing-section-inner landing-section2-inner">

            {/* 스피커 버튼 */}
            <button className="speaker-btn" onClick={() => setMuted(!muted)}>
              <img src={muted ? '/assets/button/speaker2.png' : '/assets/button/speaker1.png'} alt="speaker" />
            </button>

            {/* 홈 버튼 */}
            <button
              className="home-btn"
              onMouseEnter={() => setHomeHover(true)}
              onMouseLeave={() => setHomeHover(false)}
            >
              <img src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'} alt="home" />
            </button>

            {/* HOW TO PLAY 타이틀 */}
            <img className="howtoplay-title" src="/assets/letter/howtoplay.png" alt="HOW TO PLAY" />

            {/* 캐러셀 */}
            <div className="landing-carousel">
              <div className="landing-carousel-viewport">
              <div
                className="landing-carousel-track"
                style={{ transform: `translateX(-${cardIndex * (100 / TOTAL_CARDS)}%)` }}
              >

                {/* 카드 1 */}
                <div className="landing-carousel-slide">
                  <div className="landing-banner-card banner-card-roompage">
                    <p className="banner-card-title">같이 루틴을 <br /> 루틴몬을 키워봐요!</p>
                    <p className="banner-card-desc">친구들과 매일 루틴을 실천하고<br />나만의 루틴몬을 성장시켜요.</p>
                    <img className="brp-screenshot" src="/assets/card/roompage.png" alt="roompage preview" />
                    <img className="brp-screenshot" src="/assets/card/player.png" alt="player" />
                  </div>
                </div>

                {/* 카드 2 */}
                <div className="landing-carousel-slide">
                  <div className="landing-banner-card">
                    <p className="banner-card-title">루틴을 설정하고<br />친구들과 공유해요</p>
                    <p className="banner-card-desc">나만의 루틴을 등록하고, 서로의 루틴을 확인해요.</p>

                    <div className="banner-routine-section">
                      <span className="banner-section-label">✏️ 루틴 설정</span>
                      <div className="banner-routine-list">
                        {([
                          ['01', '💪', '근력 운동 30분하기'],
                          ['02', '📚', '독서하기'],
                          ['03', '🌱', '식물에 물 주기'],
                          ['04', '🍳', '직접 요리해서 밥 먹기'],
                        ] as [string, string, string][]).map(([num, icon, label]) => (
                          <div key={num} className="banner-routine-item">
                            <span className="banner-routine-num">{num}</span>
                            <span className="banner-routine-icon">{icon}</span>
                            <span className="banner-routine-label">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="banner-section-divider" />

                    <div className="banner-daily-popup">
                      <h3 className="banner-daily-popup-title">Players' Daily Routine</h3>
                      <div className="banner-daily-popup-list">
                        <div className="banner-daily-popup-row">
                          <span className="banner-daily-popup-name" style={{ color: '#ffffff' }}>나는1번</span>
                          <div className="banner-daily-popup-routines">
                            {([['💪','근력 운동 30분하기'],['📚','독서하기'],['🌱','식물에 물 주기']] as [string,string][]).map(([emoji, content], i) => (
                              <div key={i} className="banner-daily-popup-item">
                                <span className="banner-daily-popup-emoji">{emoji}</span>
                                <span>{i + 1}. {content}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="banner-daily-popup-sep" />
                        <div className="banner-daily-popup-row">
                          <span className="banner-daily-popup-name" style={{ color: '#00e78c' }}>2번생은처음이라</span>
                          <div className="banner-daily-popup-routines">
                            {([['☕','커피 대신 보리차'],['🧹','퇴근 후 집 청소'],['🥗','저녁은 샐러드']] as [string,string][]).map(([emoji, content], i) => (
                              <div key={i} className="banner-daily-popup-item">
                                <span className="banner-daily-popup-emoji">{emoji}</span>
                                <span>{i + 1}. {content}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 카드 3 */}
                <div className="landing-carousel-slide">
                  <div className="landing-banner-card">
                    <p className="banner-card-title">매일 인증하면<br />루틴몬이 자라요</p>
                    <p className="banner-card-desc">루틴을 완료할 때마다 경험치 획득!<br />알에서 어른으로 진화해요.</p>
                    <img className="banner-card-upload-img" src="/assets/card/uploadpage.png" alt="uploadpage" />
                    <div className="banner-card-growth">
                      <div className="banner-growth-step"><img src="/assets/routinemon/egg.png" alt="egg" /><span>알</span></div>
                      <span className="banner-growth-arr">▶</span>
                      <div className="banner-growth-step"><img src="/assets/routinemon/cat/cat1.png" alt="baby" /><span>아기</span></div>
                      <span className="banner-growth-arr">▶</span>
                      <div className="banner-growth-step"><img src="/assets/routinemon/cat/cat2.png" alt="child" /><span>어린이</span></div>
                      <span className="banner-growth-arr">▶</span>
                      <div className="banner-growth-step"><img src="/assets/routinemon/cat/cat3.png" alt="adult" /><span>어른이</span></div>
                    </div>
                    <div className="banner-card3-exp">
                      <span className="banner-card3-exp-text">EXP</span>
                      <span className="banner-card3-exp-val">55 / 100 %</span>
                      <div className="banner-card3-exp-bar">
                        <img className="brp-exp-frame" src="/assets/expBar/exp_frame.png" alt="exp frame" />
                        <img className="brp-exp-fill"  src="/assets/expBar/exp5.png"      alt="exp fill" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 카드 4 */}
                <div className="landing-carousel-slide">
                  <div className="landing-banner-card">
                    <p className="banner-card-title">파티 퀘스트로<br />함께 도전해요</p>
                    <p className="banner-card-desc">랜덤 미션이 주어지면 사진으로 인증!<br />AI가 자동으로 판별해드려요.</p>
                    <div className="banner-quest-box">
                      <span className="banner-quest-badge">PARTY QUEST</span>
                      <span className="banner-quest-text">과일이나 채소를 찍어라!</span>
                    </div>
                    <img className="banner-card4-img" src="/assets/card/quest.png" alt="quest" />
                    <img className="banner-card4-img" src="/assets/card/upload_party.png" alt="upload party" />
                  </div>
                </div>

              </div>
              </div>

              {/* 이전/다음 버튼 */}
              <button
                className="carousel-btn carousel-prev"
                onClick={() => setCardIndex(i => Math.max(0, i - 1))}
                disabled={cardIndex === 0}
                aria-label="이전"
              />
              <button
                className="carousel-btn carousel-next"
                onClick={() => setCardIndex(i => Math.min(TOTAL_CARDS - 1, i + 1))}
                disabled={cardIndex === TOTAL_CARDS - 1}
                aria-label="다음"
              />

              {/* 인디케이터 도트 */}
              <div className="carousel-dots">
                {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
                  <button
                    key={i}
                    className={`carousel-dot${i === cardIndex ? ' active' : ''}`}
                    onClick={() => setCardIndex(i)}
                  />
                ))}
              </div>

            </div>
          </div>
        </section>

      </div>
    </div>
    </div>
  )
}
