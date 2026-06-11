import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BgmProvider } from './context/BgmContext'
import LandingPage from './pages/LandingPage'
import JoinPage from './pages/JoinPage'
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
import RoutineSetupPage from './pages/RoutineSetupPage'

function App() {
  return (
    <BgmProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* 방 신설 흐름 */}
          <Route path="/create/select" element={<CharacterSelectPage />} />
          <Route path="/create/setup/:slotNumber" element={<NicknameSetupPage />} />
          <Route path="/create/routines" element={<RoutineSetupPage />} />

          {/* 방 참가 흐름 */}
          <Route path="/join/:roomCode" element={<JoinPage />} />
          <Route path="/join/:roomCode/select" element={<CharacterSelectPage />} />
          <Route path="/join/:roomCode/setup/:slotNumber" element={<NicknameSetupPage />} />
          <Route path="/join/:roomCode/verify/:slotNumber" element={<PinVerifyPage />} />
          <Route path="/join/:roomCode/routines" element={<RoutineSetupPage />} />

          {/* 플레이어 룸 */}
          <Route path="/room/:roomCode" element={<RoomPage />} />
          <Route path="/room/:roomCode/upload" element={<UploadPage />} />
          <Route path="/room/:roomCode/party-quest" element={<PartyQuestPage />} />
          <Route path="/room/:roomCode/mon" element={<MonPage />} />
          <Route path="/room/:roomCode/ranking" element={<RankingPage />} />
          <Route path="/room/:roomCode/custom/:playerId" element={<CharacterCustomPage />} />
          <Route path="/room/:roomCode/dex" element={<RoutinemonDexPage />} />
          <Route path="/room/:roomCode/log-create" element={<LogCreatePage />} />
        </Routes>
      </BrowserRouter>
    </BgmProvider>
  )
}

export default App
