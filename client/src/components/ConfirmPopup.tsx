import './ConfirmPopup.css'

interface ConfirmPopupProps {
  message: string
  onYes: () => void
  onNo: () => void
}

export default function ConfirmPopup({ message, onYes, onNo }: ConfirmPopupProps) {
  return (
    <div className="popup-overlay">
      <div className="popup-box">
        <p className="popup-message">{message}</p>
        <div className="popup-buttons">
          <button className="popup-btn" onClick={onYes}>
            <img src="/assets/button/yes.png" alt="YES" />
          </button>
          <button className="popup-btn" onClick={onNo}>
            <img src="/assets/button/no.png" alt="NO" />
          </button>
        </div>
      </div>
    </div>
  )
}
