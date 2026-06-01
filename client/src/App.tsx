import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import CharacterSelectPage from './pages/CharacterSelectPage'
import NicknameSetupPage from './pages/NicknameSetupPage'
import RoomPage from './pages/RoomPage'
import UploadPage from './pages/UploadPage'
import PartyQuestPage from './pages/PartyQuestPage'
import MonPage from './pages/MonPage'
import RankingPage from './pages/RankingPage'
import CharacterCustomPage from "./pages/CharacterCustomPage";
import RoutinemonDexPage from "./pages/RoutinemonDexPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/room/:roomCode/select" element={<CharacterSelectPage />} />
        <Route path="/room/:roomCode/setup/:slotNumber" element={<NicknameSetupPage />} />
        <Route path="/room/:roomCode" element={<RoomPage />} />
        <Route path="/room/:roomCode/upload" element={<UploadPage />} />
        <Route path="/room/:roomCode/party-quest" element={<PartyQuestPage />} />
        <Route path="/room/:roomCode/mon" element={<MonPage />} />
        <Route path="/room/:roomCode/ranking" element={<RankingPage />} />
        <Route path="/custom" element={<CharacterCustomPage />} />
        <Route path="/dex" element={<RoutinemonDexPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App