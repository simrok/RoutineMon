import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import CharacterSelectPage from './pages/CharacterSelectPage'
import NicknameSetupPage from './pages/NicknameSetupPage'
import PinVerifyPage from './pages/PinVerifyPage'
import RoomPage from './pages/RoomPage'
import UploadPage from './pages/UploadPage'
import PartyQuestPage from './pages/PartyQuestPage'
import MonPage from './pages/MonPage'
import RankingPage from './pages/RankingPage'
import CharacterCustomPage from "./pages/CharacterCustomPage";
import RoutinemonDexPage from "./pages/RoutinemonDexPage";
import LogCreatePage from './pages/LogCreatePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* 방 신설 흐름 (roomCode 없음 — 닉네임/PIN 완료 시 방 생성) */}
        <Route path="/create/select" element={<CharacterSelectPage />} />
        <Route path="/create/setup/:slotNumber" element={<NicknameSetupPage />} />

        {/* 방 참가 흐름 (roomCode 있음) */}
        <Route path="/join/:roomCode/select" element={<CharacterSelectPage />} />
        <Route path="/join/:roomCode/setup/:slotNumber" element={<NicknameSetupPage />} />
        <Route path="/join/:roomCode/verify/:slotNumber" element={<PinVerifyPage />} />

        {/* 플레이어 룸 */}
        <Route path="/room/:roomCode" element={<RoomPage />} />
        <Route path="/room/:roomCode/upload" element={<UploadPage />} />
        <Route path="/room/:roomCode/party-quest" element={<PartyQuestPage />} />
        <Route path="/room/:roomCode/mon" element={<MonPage />} />
        <Route path="/room/:roomCode/ranking" element={<RankingPage />} />


        <Route path="/room/:roomCode/custom/:playerId" element={<CharacterCustomPage />} />
        <Route path="/room/:roomCode/dex" element={<RoutinemonDexPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/log-create" element={<LogCreatePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
