import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './CharacterCustomPage.css'

const colorOptions = [
  {
    key: 'white',
    colorImage: '/assets/color/1.png',
    playerImage: '/assets/player/player_white.png',
  },
  {
    key: 'blue',
    colorImage: '/assets/color/2.png',
    playerImage: '/assets/player/player_blue.png',
  },
  {
    key: 'green',
    colorImage: '/assets/color/3.png',
    playerImage: '/assets/player/player_green.png',
  },
  {
    key: 'red',
    colorImage: '/assets/color/4.png',
    playerImage: '/assets/player/player_red.png',
  },
  {
    key: 'yellow',
    colorImage: '/assets/color/5.png',
    playerImage: '/assets/player/player_yellow.png',
  },
]

const emojiOptions = ['🏃', '📚', '💧', '🧹', '🍎', '💪', '🎮', '🧘', '📝', '🌱']

export default function CharacterCustomPage() {
  const navigate = useNavigate()

  const [selectedColor, setSelectedColor] = useState('white')
  const [nickname, setNickname] = useState('닉네임7글자다')
  const [isNicknameEditing, setIsNicknameEditing] = useState(false)

  const [saveHover, setSaveHover] = useState(false)
  const [homeHover, setHomeHover] = useState(false)

  const [routines, setRoutines] = useState([
    '설정해주세요.',
    '설정해주세요.',
    '설정해주세요.',
    '설정해주세요.',
  ])

  const [routineEmojis, setRoutineEmojis] = useState(['', '', '', ''])
  const [emojiPopupIndex, setEmojiPopupIndex] = useState<number | null>(null)

  const [editingRoutineIndex, setEditingRoutineIndex] = useState<number | null>(null)

  const selectedPlayer =
    colorOptions.find((color) => color.key === selectedColor)?.playerImage ??
    '/assets/player/player_white.png'

  const handleRoutineChange = (index: number, value: string) => {
    const next = [...routines]
    next[index] = value
    setRoutines(next)
  }

  const handleNicknameEdit = () => {
    setIsNicknameEditing((prev) => !prev)
  }

  const handleRoutineEdit = (index: number) => {
    setEditingRoutineIndex((prev) => (prev === index ? null : index))
  }

  const handleSelectEmoji = (index: number, emoji: string) => {
    const next = [...routineEmojis]
    next[index] = emoji
    setRoutineEmojis(next)
    setEmojiPopupIndex(null)
  }

  const handleSave = () => {
    alert('저장되었습니다.')
    navigate(-1)
  }

  return (
    <div className="customscreen-page">
      <div className="customscreen-phone">
        {/* 상단 */}
        {/* 홈 버튼 */}
        <button
          className="customscreen-home-btn"
          onMouseEnter={() => setHomeHover(true)}
          onMouseLeave={() => setHomeHover(false)}
          onClick={() => navigate('/')}
        >
          <img
            src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'}
            alt="home"
          />
        </button>

        <header className="customscreen-header">
          <button className="customscreen-back-btn" onClick={() => navigate(-1)}>
            <img src="/assets/button/previous.png" alt="back" />
          </button>

          <div className="customscreen-logo-area">
            <img className="customscreen-logo" src="/assets/logo/6.png" alt="RoutineMon" />
            <img className="customscreen-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
          </div>

          <div />
        </header>

        {/* 메인 박스 */}
        <main className="customscreen-panel">
          {/* 캐릭터 */}
          <section className="customscreen-character-section">
            <img className="customscreen-character" src={selectedPlayer} alt="character" />

            <div className="customscreen-nickname-row">
              <input
                className={`customscreen-nickname ${
                  isNicknameEditing ? 'customscreen-input-editing' : ''
                }`}
                value={nickname}
                maxLength={7}
                onChange={(e) => setNickname(e.target.value)}
                disabled={!isNicknameEditing}
              />
              <button className="customscreen-edit-btn" onClick={handleNicknameEdit}>
                {isNicknameEditing ? '완료' : '수정'}
              </button>
            </div>
          </section>

          {/* 컬러 */}
          <section className="customscreen-color-section">
            <p className="customscreen-section-title">Color</p>

            <div className="customscreen-color-row">
              {colorOptions.map((color) => (
                <button
                  key={color.key}
                  className={`customscreen-color-btn ${
                    selectedColor === color.key ? 'customscreen-color-active' : ''
                  }`}
                  onClick={() => setSelectedColor(color.key)}
                >
                  <img src={color.colorImage} alt={color.key} />
                </button>
              ))}

              <button className="customscreen-more-btn">
                <img src="/assets/color/add.png" alt="more" />
              </button>
            </div>
          </section>

          {/* 루틴 */}
          <section className="customscreen-routine-section">
            <p className="customscreen-section-title">Routine</p>

            <div className="customscreen-routine-list">
              {routines.map((routine, index) => {
                const isEditing = editingRoutineIndex === index

                return (
                  <div className="customscreen-routine-row" key={index}>
                    <span className="customscreen-routine-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <div className="customscreen-routine-icon-wrap">
                      <button
                        className="customscreen-routine-icon"
                        onClick={() => setEmojiPopupIndex(index)}
                        type="button"
                      >
                        <img src="/assets/color/1.png" alt="routine icon" />
                        <span>{routineEmojis[index] || '+'}</span>
                      </button>

                      {emojiPopupIndex === index && (
                        <div className="customscreen-emoji-popup">
                          {emojiOptions.map((emoji) => (
                            <button
                              key={emoji}
                              className="customscreen-emoji-btn"
                              onClick={() => handleSelectEmoji(index, emoji)}
                              type="button"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      className={`customscreen-routine-input ${
                        isEditing ? 'customscreen-input-editing' : ''
                      }`}
                      value={routine}
                      onChange={(e) => handleRoutineChange(index, e.target.value)}
                      disabled={!isEditing}
                    />

                    <button
                      className="customscreen-routine-edit"
                      onClick={() => handleRoutineEdit(index)}
                    >
                      {isEditing ? '완료' : '수정'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 저장 */}
          <button
            className="customscreen-save-btn"
            onMouseEnter={() => setSaveHover(true)}
            onMouseLeave={() => setSaveHover(false)}
            onClick={handleSave}
          >
            <img
              src={saveHover ? '/assets/button/save2.png' : '/assets/button/save1.png'}
              alt="save"
            />
          </button>
        </main>
      </div>
    </div>
  )
}