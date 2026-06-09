import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './UploadPage.css'

type Player = {
  id: number
  nickname: string
  character: string
  colorClass: string
  routines: string[]
}

type UploadedImage = {
  imageUrl: string
  uploadedAt: string
  routineIndex: number
}

const players: Player[] = [
  {
    id: 1,
    nickname: '닉넴',
    character: '/assets/player/player_white.png',
    colorClass: 'uploadscreen-white',
    routines: ['학교에서 줄넘기', '다육이한테 물주기', '헬스장에서 운동', '설정해주세요.'],
  },
  {
    id: 2,
    nickname: '닉넴',
    character: '/assets/player/player_blue.png',
    colorClass: 'uploadscreen-blue',
    routines: ['루틴1', '루틴2', '루틴3', '루틴4'],
  },
  {
    id: 3,
    nickname: '닉넴',
    character: '/assets/player/player_green.png',
    colorClass: 'uploadscreen-green',
    routines: ['루틴1', '루틴2', '루틴3', '루틴4'],
  },
  {
    id: 4,
    nickname: '닉넴',
    character: '/assets/player/player_yellow.png',
    colorClass: 'uploadscreen-yellow',
    routines: ['루틴1', '루틴2', '루틴3', '루틴4'],
  },
  {
    id: 5,
    nickname: '닉넴',
    character: '/assets/player/player_red.png',
    colorClass: 'uploadscreen-red',
    routines: ['루틴1', '루틴2', '루틴3', '루틴4'],
  },
]

export default function UploadPage() {
  const navigate = useNavigate()
  const { roomCode } = useParams<{ roomCode: string }>()

  const myPlayerId = 1
  const myPlayer = players.find((player) => player.id === myPlayerId) ?? players[0]

  const [homeHover, setHomeHover] = useState(false)
  const [showDailyPopup, setShowDailyPopup] = useState(false)
  const [showUploadPopup, setShowUploadPopup] = useState(false)
  const [selectedRoutineIndex, setSelectedRoutineIndex] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [uploadedImages, setUploadedImages] = useState<Record<number, UploadedImage>>({})
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  const handleOpenUploadPopup = (playerId: number) => {
    if (playerId !== myPlayerId) {
      alert('본인의 칸에만 사진 업로드가 가능합니다.')
      return
    }

    setSelectedRoutineIndex(null)
    setPreviewImage(null)
    setShowUploadPopup(true)
  }

  const isPartyQuestTime = useMemo(() => {
    const now = new Date()
    const hour = now.getHours()

    return [1, 7, 13, 19].includes(hour)
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPreviewImage(reader.result)
      }
    }

    reader.readAsDataURL(file)
  }

  const handleUpload = () => {
    if (selectedRoutineIndex === null) {
      alert('업로드할 루틴을 선택해주세요.')
      return
    }

    if (!previewImage) {
      alert('사진을 선택해주세요.')
      return
    }

    const now = new Date()
    const uploadedAt = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`

    const newImage: UploadedImage = {
      imageUrl: previewImage,
      uploadedAt,
      routineIndex: selectedRoutineIndex,
    }

    setUploadedImages((prev) => ({
      ...prev,
      [myPlayerId]: newImage,
    }))

    const savedDailyLogs = JSON.parse(localStorage.getItem('routineDailyLogs') ?? '[]')

    const filteredLogs = savedDailyLogs.filter(
      (log: any) =>
        !(log.memberId === myPlayerId && log.routineIndex === selectedRoutineIndex),
    )

    localStorage.setItem(
      'routineDailyLogs',
      JSON.stringify([
        ...filteredLogs,
        {
          memberId: myPlayerId,
          routineIndex: selectedRoutineIndex,
          imageUrl: previewImage,
          uploadedAt,
        },
      ]),
    )

    setShowUploadPopup(false)
  }

  const handleCloseUploadPopup = () => {
    setShowUploadPopup(false)
    setSelectedRoutineIndex(null)
    setPreviewImage(null)
  }

  const handleOpenDeletePopup = (
  event: React.MouseEvent<HTMLButtonElement>,
  playerId: number,
) => {
  event.stopPropagation()

  if (playerId !== myPlayerId) return
  if (!uploadedImages[playerId]) return

  setDeleteTargetId(playerId)
}

const handleDeleteImage = () => {
  if (deleteTargetId === null) return

  setUploadedImages((prev) => {
    const next = { ...prev }
    delete next[deleteTargetId]
    return next
  })

  setDeleteTargetId(null)
}

const handleCancelDelete = () => {
  setDeleteTargetId(null)
}

  return (
    <div className="uploadscreen-page">
      <div className="uploadscreen-board">
        {/* 상단 로고 / 물음표 / 뒤로가기 / 홈 */}
        <header className="uploadscreen-header">
          <div className="uploadscreen-logo-area">
            <img className="uploadscreen-logo" src="/assets/logo/6.png" alt="RoutineMon" />
            <img className="uploadscreen-logo-sub" src="/assets/logo/low.png" alt="subtitle" />
          </div>

          <button className="uploadscreen-question-btn">
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
            <img
              src={homeHover ? '/assets/button/home2.png' : '/assets/button/home1.png'}
              alt="home"
            />
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
            className={`uploadscreen-party-btn ${
              isPartyQuestTime ? 'uploadscreen-party-active' : 'uploadscreen-party-disabled'
            }`}
            disabled={!isPartyQuestTime}
          >
            <img
              src={isPartyQuestTime ? '/assets/button/party_2.png' : '/assets/button/party_1.png'}
              alt="party"
            />
          </button>
        </div>

        {/* 점 */}
        <div className="uploadscreen-dots-row">
          <span></span>
          <div className="uploadscreen-dots">
            <i className="active"></i>
            <i></i>
            <i></i>
            <i></i>
          </div>
          <div className="uploadscreen-dots">
            <i className="active"></i>
            <i></i>
            <i></i>
            <i></i>
          </div>
        </div>

        {/* 플레이어 업로드 영역 */}
        <section className="uploadscreen-player-list">
          {players.map((player) => {
            const uploaded = uploadedImages[player.id]
            const isMyPlayer = player.id === myPlayerId

            return (
              <div className="uploadscreen-player-row" key={player.id}>
                <div className="uploadscreen-player-info">
                  <img
                    className="uploadscreen-player-img"
                    src={player.character}
                    alt={player.nickname}
                  />

                  <div className="uploadscreen-speech-wrap">
                    <img
                      className="uploadscreen-speech-img"
                      src="/assets/frame/말풍선.png"
                      alt="speech bubble"
                    />
                    <span>Zzz</span>
                  </div>

                  <span className={`uploadscreen-player-name ${player.colorClass}`}>
                    {player.nickname}
                  </span>
                </div>

                <button
                  className={`uploadscreen-upload-slot ${player.colorClass}`}
                  onClick={() => handleOpenUploadPopup(player.id)}
                >
                  {uploaded ? (
                    <>
                      <img
                        className="uploadscreen-uploaded-img"
                        src={uploaded.imageUrl}
                        alt="uploaded"
                      />

                      <span className="uploadscreen-upload-time">{uploaded.uploadedAt}</span>

                      {isMyPlayer && (
                        <button
                          type="button"
                          className="uploadscreen-star-btn"
                          onClick={(event) => handleOpenDeletePopup(event, player.id)}
                        >
                          ★
                        </button>
                      )}
                    </>
                  ) : (
                    isMyPlayer && (
                      <img
                        className="uploadscreen-add-icon"
                        src="/assets/button/add.png"
                        alt="add"
                      />
                    )
                  )}
                </button>

                <div className={`uploadscreen-party-slot ${player.colorClass}`}>
                  {isMyPlayer && isPartyQuestTime && (
                    <img
                      className="uploadscreen-add-icon"
                      src="/assets/button/add.png"
                      alt="add"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </section>

        {/* DAILY 팝업 */}
        {showDailyPopup && (
          <div
            className="uploadscreen-popup-backdrop"
            onClick={() => setShowDailyPopup(false)}
          >
            <div className="uploadscreen-daily-popup" onClick={(e) => e.stopPropagation()}>
              <h2>Players’ Daily Routine</h2>

              <div className="uploadscreen-daily-list">
                {players.map((player) => (
                  <div className="uploadscreen-daily-row" key={player.id}>
                    <span className="uploadscreen-daily-name">{player.nickname}</span>

                    <div className="uploadscreen-daily-routines">
                      {player.routines.map((routine, index) => (
                        <span key={`${player.id}-${index}`}>
                          {index + 1}. {routine}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="uploadscreen-popup-yes-btn"
                onClick={() => setShowDailyPopup(false)}
              >
                YES
              </button>
            </div>
          </div>
        )}

        {/* 이미지 업로드 팝업 */}
        {showUploadPopup && (
          <div className="uploadscreen-popup-backdrop">
            <div className="uploadscreen-upload-popup">
              <h2>사진을 업로드 하시겠습니까?</h2>

              <div className="uploadscreen-routine-select-list">
                {myPlayer.routines.map((routine, index) => (
                  <button
                    key={index}
                    className={`uploadscreen-routine-select-btn ${
                      selectedRoutineIndex === index ? 'uploadscreen-routine-selected' : ''
                    }`}
                    onClick={() => setSelectedRoutineIndex(index)}
                  >
                    <span>#{index + 1}</span>
                    <p>{routine}</p>
                  </button>
                ))}
              </div>

              <label className="uploadscreen-file-label">
                Choose File
                <input type="file" accept="image/*" onChange={handleFileChange} />
              </label>

              <div className="uploadscreen-preview-box">
                {previewImage ? <img src={previewImage} alt="preview" /> : <span>선택된 파일 없음</span>}
              </div>

              <button className="uploadscreen-upload-btn" onClick={handleUpload}>
                <img src="/assets/button/upload.png" alt="upload" />
              </button>

              <div className="uploadscreen-popup-actions">
                <button onClick={handleUpload}>
                  <img src="/assets/button/yes.png" alt="yes" />
                </button>
                <button onClick={handleCloseUploadPopup}>
                  <img src="/assets/button/no.png" alt="no" />
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteTargetId !== null && (
          <div className="uploadscreen-popup-backdrop">
            <div className="uploadscreen-delete-popup">
              <h2>사진을 삭제 하시겠습니까?</h2>

              <div className="uploadscreen-popup-actions">
                <button onClick={handleDeleteImage}>
                  <img src="/assets/button/yes.png" alt="yes" />
                </button>

                <button onClick={handleCancelDelete}>
                  <img src="/assets/button/no.png" alt="no" />
                </button>
              </div>
            </div>
          </div>
)}
      </div>
    </div>
  )
}