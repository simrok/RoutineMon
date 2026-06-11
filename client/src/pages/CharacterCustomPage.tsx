import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomStore } from '../store/useRoomStore'
import './CharacterCustomPage.css'

const API_BASE = 'http://localhost:4000/api'

const colorOptions = [
  { key: 'white',  colorImage: '/assets/color/1.png', playerImage: '/assets/player/player_white.png'  },
  { key: 'green',  colorImage: '/assets/color/3.png', playerImage: '/assets/player/player_green.png'  },
  { key: 'blue',   colorImage: '/assets/color/2.png', playerImage: '/assets/player/player_blue.png'   },
  { key: 'yellow', colorImage: '/assets/color/5.png', playerImage: '/assets/player/player_yellow.png' },
  { key: 'red',    colorImage: '/assets/color/4.png', playerImage: '/assets/player/player_red.png'    },
]

const SLOT_COLOR_KEY: Record<number, string> = {
  1: 'white', 2: 'green', 3: 'blue', 4: 'yellow', 5: 'red',
}

const EMOJI_OPTIONS = [
  '🏃', '💪', '🧘', '🚴', '🏋️', '🤸', '🚶', '🏊',
  '🍎', '💧', '🥗', '☕', '🥤', '🍳',
  '📚', '📝', '💻', '📖', '🎯', '✏️',
  '🛁', '🧹', '🪥', '🛏️', '🧴', '👕',
  '🧸', '🎵', '🌱', '📷', '🎮', '😴',
]

const MAX_TITLE_LEN = 15
const SLOT_COUNT = 4
const MIN_REQUIRED = 3

// 서버와 동일한 규칙: 완성된 한글 음절/영문/숫자, 1~7자
const VALID_NICKNAME_RE = /^[가-힣a-zA-Z0-9]{1,7}$/

interface RoutineSlot {
  emoji: string
  title: string
}

export default function CharacterCustomPage() {
  const navigate = useNavigate()
  const { roomCode } = useParams<{ roomCode: string }>()
  const myPlayer    = useRoomStore((s) => s.myPlayer)
  const myPin       = useRoomStore((s) => s.myPin)
  const setMyPlayer = useRoomStore((s) => s.setMyPlayer)

  const defaultColor = SLOT_COLOR_KEY[myPlayer?.slotNumber ?? 1] ?? 'white'

  const [selectedColor, setSelectedColor] = useState(defaultColor)
  const [initialColor, setInitialColor]   = useState(defaultColor)
  const [nickname, setNickname]           = useState(myPlayer?.nickname ?? '')
  const [isNicknameEditing, setIsNicknameEditing] = useState(false)
  const [slots, setSlots] = useState<RoutineSlot[]>(
    Array.from({ length: SLOT_COUNT }, () => ({ emoji: '', title: '' }))
  )
  const [editingIndex, setEditingIndex]     = useState<number | null>(null)
  const [emojiPopupIndex, setEmojiPopupIndex] = useState<number | null>(null)

  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loadError, setLoadError] = useState('')

  const [saveHover, setSaveHover] = useState(false)
  const [homeHover, setHomeHover] = useState(false)

  const selectedPlayer = colorOptions.find(c => c.key === selectedColor)?.playerImage
    ?? '/assets/player/player_white.png'

  // ── 닉네임 유효성 (서버 규칙과 동일) ──────────────────────
  const nicknameValid   = VALID_NICKNAME_RE.test(nickname.trim())
  const nicknameInvalid = nickname.trim().length > 0 && !VALID_NICKNAME_RE.test(nickname.trim())

  // ── 초기 데이터 로드 ──────────────────────────────────────
  useEffect(() => {
    if (!myPlayer) return

    // 닉네임은 store에서 즉시
    setNickname(myPlayer.nickname)

    // 색상 로드
    fetch(`http://localhost:4000/api/rooms/${roomCode}/players-with-routines`)
      .then(r => r.json())
      .then(json => {
        const me = (json.data?.players ?? []).find(
          (p: { playerId: number; characterType?: string }) => Number(p.playerId) === Number(myPlayer.playerId)
        )
        if (me?.characterType) {
          setSelectedColor(me.characterType)
          setInitialColor(me.characterType)
        }
      })
      .catch(() => {})

    // 루틴 로드
    fetch(`${API_BASE}/players/${myPlayer.playerId}/routines`)
      .then(r => r.json())
      .then(json => {
        if (!json.success) {
          setLoadError('루틴 로드 실패: ' + (json.error ?? '서버 오류'))
          return
        }
        const data = json.data ?? []
        if (data.length === 0) return
        const loaded: RoutineSlot[] = Array.from({ length: SLOT_COUNT }, () => ({ emoji: '', title: '' }))
        for (const r of data) {
          const idx = Number(r.slotNumber ?? r.slot_number ?? 1) - 1
          if (idx >= 0 && idx < SLOT_COUNT) {
            loaded[idx] = { emoji: r.emoji ?? '', title: r.title ?? r.content ?? '' }
          }
        }
        setSlots(loaded)
      })
      .catch(err => {
        setLoadError('루틴 로드 오류: ' + err.message)
      })
  }, [myPlayer, roomCode])

  // ── 루틴 핸들러 ───────────────────────────────────────────
  const handleTitleChange = (index: number, value: string) => {
    setSlots(prev => {
      const next = [...prev]
      next[index] = { ...next[index], title: value.slice(0, MAX_TITLE_LEN) }
      return next
    })
  }

  const handleSelectEmoji = (index: number, emoji: string) => {
    setSlots(prev => {
      const next = [...prev]
      next[index] = { ...next[index], emoji }
      return next
    })
    setEmojiPopupIndex(null)
  }

  const toggleRoutineEdit = (index: number) => {
    setEditingIndex(prev => prev === index ? null : index)
    setEmojiPopupIndex(null)
  }

  const closeAll = () => { setEmojiPopupIndex(null); setEditingIndex(null) }

  // ── 저장 ──────────────────────────────────────────────────
  const routineCount = slots.filter(s => s.emoji && s.title.trim()).length
  const canSave = routineCount >= MIN_REQUIRED && nicknameValid

  const handleSave = async () => {
    if (!canSave || saving || !myPlayer) return
    setSaving(true)
    setSaveError('')

    try {
      const trimmedNickname = nickname.trim()
      const nicknameChanged = trimmedNickname !== myPlayer.nickname
      const colorChanged    = selectedColor !== initialColor

      // 닉네임/색상 변경이 있을 때만 PATCH
      if (nicknameChanged || colorChanged) {
        if (!myPin) {
          setSaveError('닉네임/색상 변경은 재로그인 후 가능합니다. (루틴은 저장됩니다)')
          // PIN 없어도 루틴은 저장 가능 → fall through
        } else {
          const body: Record<string, string> = {}
          if (nicknameChanged) body.nickname = trimmedNickname
          if (colorChanged)    body.characterType = selectedColor

          const res  = await fetch(`${API_BASE}/players/${myPlayer.playerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Player-Pin': myPin },
            body: JSON.stringify(body),
          })
          const json = await res.json()
          if (!json.success) {
            setSaveError(json.error ?? '프로필 수정 실패')
            setSaving(false)
            return
          }
          if (nicknameChanged) setMyPlayer({ ...myPlayer, nickname: trimmedNickname })
          if (colorChanged)    setInitialColor(selectedColor)
        }
      }

      // 루틴 저장 (PIN 불필요)
      const routines = slots
        .map((s, i) => ({ slotNumber: i + 1, emoji: s.emoji, title: s.title.trim() }))
        .filter(r => r.emoji && r.title)

      const rRes  = await fetch(`${API_BASE}/players/${myPlayer.playerId}/routines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routines }),
      })
      const rJson = await rRes.json()
      if (!rJson.success) {
        setSaveError(rJson.error ?? '루틴 저장 실패')
        setSaving(false)
        return
      }

      navigate(`/room/${roomCode}`)
    } catch {
      setSaveError('서버 연결 오류')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="customscreen-page" onClick={closeAll}>
      <div className="customscreen-phone" onClick={e => e.stopPropagation()}>

        <button
          className="customscreen-home-btn"
          onMouseEnter={() => setHomeHover(true)}
          onMouseLeave={() => setHomeHover(false)}
          onClick={() => navigate('/')}
        >
          <img src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'} alt="home" />
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

        <main className="customscreen-panel" onClick={e => e.stopPropagation()}>

          {/* 캐릭터 + 닉네임 */}
          <section className="customscreen-character-section">
            <img className="customscreen-character" src={selectedPlayer} alt="character" />

            {/* 닉네임 행: 스페이서 | [input] | [✓/✗ + 버튼] — input이 진짜 가운데 정렬 */}
            <div className="customscreen-nickname-row">
              <div className="customscreen-nickname-spacer" />
              <input
                className={`customscreen-nickname ${isNicknameEditing ? 'customscreen-input-editing' : ''}`}
                value={nickname}
                maxLength={7}
                onChange={e => setNickname(e.target.value)}
                disabled={!isNicknameEditing}
              />
              <div className="customscreen-nickname-controls">
                {isNicknameEditing && (
                  <span className={`customscreen-nickname-status ${nicknameValid ? 'valid' : 'invalid'}`}>
                    {nicknameValid ? '✓' : '✗'}
                  </span>
                )}
                {isNicknameEditing ? (
                  <button
                    className="customscreen-edit-btn"
                    disabled={!nicknameValid}
                    onClick={() => setIsNicknameEditing(false)}
                  >
                    완료
                  </button>
                ) : (
                  <button
                    className="customscreen-edit-btn"
                    onClick={() => setIsNicknameEditing(true)}
                  >
                    수정
                  </button>
                )}
              </div>
            </div>

            {/* 글자수 + 에러 (편집 중만) */}
            {isNicknameEditing && (
              <div className="customscreen-nickname-meta">
                <span
                  className="customscreen-nickname-count"
                  style={{ color: nickname.length >= 7 ? '#FF4444' : '#888' }}
                >
                  {nickname.length}/7
                </span>
                {nicknameInvalid && (
                  <span className="customscreen-nickname-error">한글/영문/숫자만 사용 가능</span>
                )}
              </div>
            )}
          </section>

          {/* 컬러 */}
          <section className="customscreen-color-section">
            <p className="customscreen-section-title">Color</p>
            <div className="customscreen-color-row">
              {colorOptions.map(color => (
                <button
                  key={color.key}
                  className={`customscreen-color-btn ${selectedColor === color.key ? 'customscreen-color-active' : ''}`}
                  onClick={() => setSelectedColor(color.key)}
                >
                  <img src={color.colorImage} alt={color.key} />
                </button>
              ))}
            </div>
          </section>

          {/* 루틴 */}
          <section className="customscreen-routine-section">
            <p className="customscreen-section-title">
              Routine
              <span className="customscreen-routine-progress">
                {routineCount}/{SLOT_COUNT}
              </span>
            </p>

            {loadError && <p className="customscreen-save-error">{loadError}</p>}

            <div className="customscreen-routine-list">
              {slots.map((slot, index) => {
                const isEditing  = editingIndex === index
                const isRequired = index < MIN_REQUIRED
                const titleLen   = slot.title.length

                return (
                  <div
                    className={`customscreen-routine-row ${isEditing ? 'customscreen-routine-row-active' : ''}`}
                    key={index}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* 번호 + 뱃지 */}
                    <div className="customscreen-routine-meta">
                      <span className="customscreen-routine-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className={`customscreen-routine-badge ${isRequired ? 'badge-required' : 'badge-optional'}`}>
                        {isRequired ? '필수' : '선택'}
                      </span>
                    </div>

                    {/* 이모지 버튼 */}
                    <div className="customscreen-routine-icon-wrap">
                      <button
                        className={`customscreen-emoji-trigger ${slot.emoji ? 'has-emoji' : 'no-emoji'}`}
                        onClick={e => { e.stopPropagation(); setEmojiPopupIndex(prev => prev === index ? null : index) }}
                        type="button"
                      >
                        {slot.emoji || '+'}
                      </button>

                      {emojiPopupIndex === index && (
                        <div className="customscreen-emoji-popup" onClick={e => e.stopPropagation()}>
                          {EMOJI_OPTIONS.map(emoji => (
                            <button
                              key={emoji}
                              className={`customscreen-emoji-btn ${slot.emoji === emoji ? 'customscreen-emoji-selected' : ''}`}
                              onClick={() => handleSelectEmoji(index, emoji)}
                              type="button"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 루틴 입력 */}
                    <div className="customscreen-routine-input-wrap">
                      <input
                        className={`customscreen-routine-input ${isEditing ? 'customscreen-input-editing' : ''}`}
                        value={slot.title}
                        placeholder="루틴 이름"
                        onChange={e => handleTitleChange(index, e.target.value)}
                        disabled={!isEditing}
                        maxLength={MAX_TITLE_LEN}
                      />
                      {isEditing && (
                        <span
                          className="customscreen-char-count"
                          style={{ color: titleLen >= MAX_TITLE_LEN ? '#FF4444' : '#888' }}
                        >
                          {titleLen}/{MAX_TITLE_LEN}
                        </span>
                      )}
                    </div>

                    <button className="customscreen-routine-edit" onClick={() => toggleRoutineEdit(index)}>
                      {isEditing ? '완료' : '수정'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 에러 메시지 */}
          {saveError && <p className="customscreen-save-error">{saveError}</p>}

          {/* 저장 버튼 */}
          <button
            className={`customscreen-save-btn ${!canSave || saving ? 'customscreen-save-disabled' : ''}`}
            onMouseEnter={() => setSaveHover(true)}
            onMouseLeave={() => setSaveHover(false)}
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            <img
              src={canSave && !saving && saveHover ? '/assets/button/save2.png' : '/assets/button/save1.png'}
              alt="save"
            />
          </button>
        </main>
      </div>
    </div>
  )
}
