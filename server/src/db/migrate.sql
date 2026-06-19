-- RoutineMon 마이그레이션 파일
-- 기존 DB가 있는 경우, 누락된 컬럼을 추가합니다.
-- 실행: MySQL Workbench에서 한 번만 실행하면 됩니다.

USE routinemon;

-- party_quests에 accepted_player_count 컬럼 추가 (없는 경우에만)
ALTER TABLE party_quests
  ADD COLUMN IF NOT EXISTS accepted_player_count INT DEFAULT 1 AFTER expires_at;
