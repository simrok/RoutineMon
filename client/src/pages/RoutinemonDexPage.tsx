import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import { getSocket } from '../socket'
import { API_BASE } from '../config'
import './RoutinemonDexPage.css'

type MonEntry = {
  catalogId: number
  name: string
  category: string
  rarity: string
  babyImageUrl: string | null
  childImageUrl: string | null
  adultImageUrl: string | null
  obtained: boolean
}

const NO_LABEL = (id: number) => `No.${String(id).padStart(3, '0')}`

const RARITY_LABEL: Record<string, string> = {
  common: '보통',
  uncommon: '희귀',
  rare: '전설',
}

const RARITY_COLOR: Record<string, string> = {
  common: '#6ee86e',
  uncommon: '#4db6ff',
  rare: '#ffb800',
}

export default function RoutinemonDexPage() {
  const navigate = useNavigate()
  const room = useRoomStore((s) => s.room)
  const [homeHover, setHomeHover] = useState(false)
  const [mons, setMons] = useState<MonEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMon, setSelectedMon] = useState<MonEntry | null>(null)
  const [showDexInfo, setShowDexInfo] = useState(false)
  const [dexInfoOkHover, setDexInfoOkHover] = useState(false)

  const fetchCatalog = useCallback((roomId: number) => {
    fetch(`${API_BASE}/mon-catalog?roomId=${roomId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setMons(json.data ?? [])
      })
      .catch(() => {})
  }, [])

  // 최초 도감 로드
  useEffect(() => {
    const roomId = room?.roomId
    if (!roomId) {
      setLoading(false)
      return
    }
    fetchCatalog(roomId)
    setLoading(false)
  }, [room?.roomId, fetchCatalog])

  // 진화 발생 시 도감 자동 갱신
  useEffect(() => {
    const roomId = room?.roomId
    if (!roomId) return

    const socket = getSocket()
    const handleEvolved = () => {
      fetchCatalog(roomId)
    }
    socket.on('mon:evolved', handleEvolved)

    return () => {
      socket.off('mon:evolved', handleEvolved)
    }
  }, [room?.roomId, fetchCatalog])

  const landMons = mons.filter((m) => m.category === 'land')
  const obtainedCount = mons.filter((m) => m.obtained).length

  const popupStages = selectedMon
    ? [
        { label: '알', image: '/assets/routinemon/egg.png', available: true },
        {
          label: '아기',
          image: selectedMon.babyImageUrl,
          available: selectedMon.obtained && !!selectedMon.babyImageUrl,
        },
        {
          label: '어린이',
          image: selectedMon.childImageUrl,
          available: selectedMon.obtained && !!selectedMon.childImageUrl,
        },
        {
          label: '어른이',
          image: selectedMon.adultImageUrl,
          available: selectedMon.obtained && !!selectedMon.adultImageUrl,
        },
      ]
    : []

  return (
    <div className="dexscreen-page">
      <div className="dexscreen-phone">
        <button
          className="dexscreen-home-btn"
          onMouseEnter={() => setHomeHover(true)}
          onMouseLeave={() => setHomeHover(false)}
          onClick={() => navigate('/')}
        >
          <img
            src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'}
            alt="home"
          />
        </button>

        <header className="dexscreen-header">
          <button className="dexscreen-back-btn" onClick={() => navigate(-1)}>
            <img src="/assets/button/previous.png" alt="back" />
          </button>
          <div className="dexscreen-logo-area">
            <img className="dexscreen-logo" src="/assets/logo/6.png" alt="RoutineMon" />
            <img className="dexscreen-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
          </div>
          <div />
        </header>

        <main className="dexscreen-panel">
          {/* 패널 헤더 */}
          <div className="dexscreen-panel-header">
            <span className="dexscreen-panel-title">루틴몬 도감</span>
            <div className="dexscreen-panel-header-right">
              {!loading && (
                <span className="dexscreen-panel-count">
                  획득 {obtainedCount} / {mons.length}
                </span>
              )}
              <button className="dexscreen-info-btn" onClick={() => setShowDexInfo(true)}>
                <img src="/assets/button/question.png" alt="도감 설명" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="dexscreen-loading">불러오는 중...</div>
          ) : (
            <>
              {/* 육지 동물 */}
              <section className="dexscreen-category-section">
                <div className="dexscreen-category-header">
                  <span className="dexscreen-category-dot" style={{ background: '#6ee86e' }} />
                  <span className="dexscreen-category-name">육지 동물</span>
                  <span className="dexscreen-category-count">
                    {landMons.filter((m) => m.obtained).length}/{landMons.length}
                  </span>
                </div>

                <div className="dexscreen-mon-grid">
                  {landMons.map((mon) => (
                    <button
                      key={mon.catalogId}
                      className={`dexscreen-mon-card ${mon.obtained ? 'dexscreen-mon-obtained' : 'dexscreen-mon-locked'}`}
                      onClick={() => setSelectedMon(mon)}
                    >
                      <div className="dexscreen-mon-img-wrap">
                        {mon.obtained && mon.babyImageUrl ? (
                          <img
                            className="dexscreen-mon-img"
                            src={mon.babyImageUrl}
                            alt={mon.name}
                          />
                        ) : (
                          <img
                            className="dexscreen-mon-img dexscreen-mon-img-locked"
                            src="/assets/routinemon/egg.png"
                            alt="???"
                          />
                        )}
                      </div>
                      <span className="dexscreen-mon-no">{NO_LABEL(mon.catalogId)}</span>
                      <span className="dexscreen-mon-name">{mon.obtained ? mon.name : '???'}</span>
                      {mon.obtained && (
                        <span
                          className="dexscreen-mon-rarity"
                          style={{ color: RARITY_COLOR[mon.rarity] ?? '#aaa' }}
                        >
                          {RARITY_LABEL[mon.rarity] ?? mon.rarity}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* 해양/희귀: 준비 중 */}
              {[
                { label: '해양 동물', color: '#4db6ff' },
                { label: '희귀 동물', color: '#ffb800' },
              ].map(({ label, color }) => (
                <section className="dexscreen-category-section" key={label}>
                  <div className="dexscreen-category-header">
                    <span className="dexscreen-category-dot" style={{ background: color, opacity: 0.35 }} />
                    <span className="dexscreen-category-name dexscreen-category-name-dim">{label}</span>
                    <span className="dexscreen-coming-soon">준비 중</span>
                  </div>
                  <div className="dexscreen-coming-soon-bar">
                    <span>Coming Soon</span>
                  </div>
                </section>
              ))}
            </>
          )}
        </main>

        {/* 도감 설명 팝업 */}
        {showDexInfo && (
          <div className="mon-info-backdrop" onClick={() => setShowDexInfo(false)}>
            <div className="mon-info-popup" onClick={(e) => e.stopPropagation()}>
              <h2 className="mon-info-title">📖 루틴몬 도감이란?</h2>

              <div className="mon-info-section">
                <p className="mon-info-section-title">🥚 루틴몬이란?</p>
                <p className="mon-info-desc">
                  루틴몬은 방의 마스코트예요.<br />
                  처음엔 알 상태로 시작해서,<br />
                  멤버들이 루틴을 꾸준히 완료할수록<br />
                  <span className="mon-info-accent">아기 → 어린이 → 어른이</span>로 성장해요.
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">⭐ 획득과 블라인드</p>
                <p className="mon-info-desc">
                  한 번이라도 알에서 깨어난 루틴몬은<br />
                  도감에 이름과 모습이 공개돼요.<br />
                  아직 만나지 못한 루틴몬은{' '}
                  <span className="mon-info-accent">???</span>로 표시됩니다.
                </p>
              </div>

              <div className="mon-info-divider" />

              <div className="mon-info-section">
                <p className="mon-info-section-title">🌟 희귀도</p>
                <p className="mon-info-desc">
                  <span className="mon-info-accent" style={{ color: '#6ee86e' }}>보통</span>{'  '}
                  <span className="mon-info-accent" style={{ color: '#4db6ff' }}>희귀</span>{'  '}
                  <span className="mon-info-accent" style={{ color: '#ffb800' }}>전설</span><br />
                  희귀도가 높을수록 만나기 어려운 루틴몬이에요.
                </p>
              </div>

              <button
                className="mon-info-ok-btn"
                onClick={() => setShowDexInfo(false)}
                onMouseEnter={() => setDexInfoOkHover(true)}
                onMouseLeave={() => setDexInfoOkHover(false)}
              >
                <img src={dexInfoOkHover ? '/assets/button/ok2.png' : '/assets/button/ok1.png'} alt="확인" />
              </button>
            </div>
          </div>
        )}

        {/* 몬 상세 팝업 */}
        {selectedMon && (
          <div className="dexscreen-popup-backdrop" onClick={() => setSelectedMon(null)}>
            <div className="dexscreen-popup" onClick={(e) => e.stopPropagation()}>
              <button className="dexscreen-popup-close" onClick={() => setSelectedMon(null)}>
                ×
              </button>

              <div className="dexscreen-popup-top">
                <span className="dexscreen-popup-no">{NO_LABEL(selectedMon.catalogId)}</span>
                {selectedMon.obtained && (
                  <span
                    className="dexscreen-popup-rarity"
                    style={{ color: RARITY_COLOR[selectedMon.rarity] ?? '#aaa' }}
                  >
                    {RARITY_LABEL[selectedMon.rarity] ?? selectedMon.rarity}
                  </span>
                )}
              </div>

              <h2 className="dexscreen-popup-name">
                {selectedMon.obtained ? selectedMon.name : '???'}
              </h2>

              <div className="dexscreen-popup-stages">
                {popupStages.map((stage) => (
                  <div key={stage.label} className="dexscreen-popup-stage">
                    <div className={`dexscreen-stage-box ${stage.available ? 'dexscreen-stage-unlocked' : 'dexscreen-stage-locked'}`}>
                      {stage.available && stage.image ? (
                        <img
                          className="dexscreen-stage-img"
                          src={stage.image}
                          alt={stage.label}
                        />
                      ) : (
                        <span className="dexscreen-stage-question">?</span>
                      )}
                    </div>
                    <span className="dexscreen-stage-label">{stage.label}</span>
                  </div>
                ))}
              </div>

              {!selectedMon.obtained ? (
                <p className="dexscreen-popup-hint">루틴을 꾸준히 해서 루틴몬을 해금하세요!</p>
              ) : (
                <p className="dexscreen-popup-hint">알에서 태어나 꾸준한 루틴으로 성장해요.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
