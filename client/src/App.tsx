import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import RoomPage from './pages/RoomPage'
import UploadPage from './pages/UploadPage'
import PartyQuestPage from './pages/PartyQuestPage'
import MonPage from './pages/MonPage'
import RankingPage from './pages/RankingPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/room/:roomCode" element={<RoomPage />} />
        <Route path="/room/:roomCode/upload" element={<UploadPage />} />
        <Route path="/room/:roomCode/party-quest" element={<PartyQuestPage />} />
        <Route path="/room/:roomCode/mon" element={<MonPage />} />
        <Route path="/room/:roomCode/ranking" element={<RankingPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App