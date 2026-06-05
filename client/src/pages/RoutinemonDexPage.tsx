import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './RoutinemonDexPage.css'

type CategoryKey = 'land' | 'sea' | 'rare'

type Routinemon = {
  id: number
  name: string
  category: CategoryKey
  no: string
  stages: {
    label: string
    image: string
  }[]
}

const routinemons: Routinemon[] = [
  {
    id: 1,
    name: '고녕',
    category: 'land',
    no: 'No.001',
    stages: [
      { label: '알', image: '/assets/routinemon/egg.png' },
      { label: '아기', image: '/assets/routinemon/cat/cat1.png' },
      { label: '어린이', image: '/assets/routinemon/cat/cat2.png' },
      { label: '어른이', image: '/assets/routinemon/cat/cat3.png' },
    ],
  },
  {
    id: 2,
    name: '공룡',
    category: 'land',
    no: 'No.002',
    stages: [
      { label: '알', image: '/assets/routinemon/egg.png' },
      { label: '아기', image: '/assets/routinemon/dino/dino1.png' },
      { label: '어린이', image: '/assets/routinemon/dino/dino2.png' },
      { label: '어른이', image: '/assets/routinemon/dino/dino3.png' },
    ],
  },
  {
    id: 3,
    name: '판다',
    category: 'land',
    no: 'No.003',
    stages: [
      { label: '알', image: '/assets/routinemon/egg.png' },
      { label: '아기', image: '/assets/routinemon/panda/panda1.png' },
      { label: '어린이', image: '/assets/routinemon/panda/panda2.png' },
      { label: '어른이', image: '/assets/routinemon/panda/panda3.png' },
    ],
  },
]

const categories: {
  key: CategoryKey
  label: string
}[] = [
  { key: 'land', label: '육지 동물' },
  { key: 'sea', label: '해양 동물' },
  { key: 'rare', label: '희귀 동물' },
]

export default function RoutinemonDexPage() {
  const navigate = useNavigate()
  const [homeHover, setHomeHover] = useState(false)
  const [selectedMon, setSelectedMon] = useState<Routinemon | null>(null)

  const getMonsByCategory = (category: CategoryKey) => {
    return routinemons.filter((mon) => mon.category === category)
  }

  return (
    <div className="dexscreen-page">
      <div className="dexscreen-phone">
        {/* 상단 */}
        <header className="dexscreen-header">
          <button className="dexscreen-back-btn" onClick={() => navigate(-1)}>
            <img src="/assets/button/previous.png" alt="back" />
          </button>

          <div className="dexscreen-logo-area">
            <img className="dexscreen-logo" src="/assets/logo/6.png" alt="RoutineMon" />
            <img className="dexscreen-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
          </div>

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
        </header>

        {/* 도감 패널 */}
        <main className="dexscreen-panel">
          <h1 className="dexscreen-title">루틴몬 도감</h1>

          <div className="dexscreen-category-list">
            {categories.map((category) => {
              const mons = getMonsByCategory(category.key)
              const slots = Array.from({ length: 5 })

              return (
                <section className="dexscreen-category" key={category.key}>
                  <div className="dexscreen-category-label">
                    {category.label}
                  </div>

                  <div className="dexscreen-slot-row">
                    {slots.map((_, index) => {
                      const mon = mons[index]

                      if (!mon) {
                        return (
                          <div className="dexscreen-slot dexscreen-slot-empty" key={index}>
                            ★
                          </div>
                        )
                      }

                      return (
                        <button
                          className="dexscreen-slot dexscreen-slot-active"
                          key={mon.id}
                          onClick={() => setSelectedMon(mon)}
                        >
                          <img src={mon.stages[1].image} alt={mon.name} />
                          <span>{mon.no}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </main>

        {/* 선택 팝업 */}
        {selectedMon && (
          <div className="dexscreen-popup-backdrop" onClick={() => setSelectedMon(null)}>
            <div className="dexscreen-popup" onClick={(e) => e.stopPropagation()}>
              <button
                className="dexscreen-popup-close"
                onClick={() => setSelectedMon(null)}
             >
                ×
              </button>

              <p className="dexscreen-popup-no">{selectedMon.no}</p>
              <h2 className="dexscreen-popup-name">{selectedMon.name}</h2>

              <div className="dexscreen-popup-stage-list">
                {selectedMon.stages.map((stage) => (
                  <div className="dexscreen-popup-stage" key={stage.label}>
                    <div className="dexscreen-popup-stage-img-box">
                      <img
                        className="dexscreen-popup-stage-img"
                        src={stage.image}
                        alt={`${selectedMon.name}-${stage.label}`}
                      />
                    </div>
                    <span>{stage.label}</span>
                  </div>
                ))}
              </div>

              <p className="dexscreen-popup-desc">
                루틴몬의 성장 단계를 확인할 수 있습니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}