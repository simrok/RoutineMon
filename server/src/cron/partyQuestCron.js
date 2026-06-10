/**
 * partyQuestCron.js
 *
 * node-cron 없이 순수 Node.js setTimeout/setInterval로 구현한 파티 퀘스트 스케줄러.
 *
 * 역할
 *  1. 매일 01 / 07 / 13 / 19시 → 모든 방에 파티 퀘스트 생성 (status: 'pending')
 *  2. 매일 02 / 08 / 14 / 20시 → 수락 안 한 퀘스트 만료 (status: 'failed')
 *  3. 5분마다               → expires_at 지난 active 퀘스트 만료 (status: 'failed')
 */

const pool = require('../db/db');

const PARTY_HOURS = [1, 7, 13, 19]; // 파티 퀘스트 발생 시각

// ── 유틸 ──────────────────────────────────────────────────────
/** 오늘(또는 내일) hour:00:00까지 남은 밀리초 */
function msUntilHour(hour) {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // 이미 지났으면 내일
  return target.getTime() - now.getTime();
}

/** hour:00:00에 fn 실행, 이후 24시간마다 반복 */
function scheduleDaily(hour, fn) {
  const delay = msUntilHour(hour);
  const minutesLeft = Math.round(delay / 60000);
  console.log(`[Cron] ${String(hour).padStart(2, '0')}:00 스케줄 등록 — ${minutesLeft}분 후 첫 실행`);

  setTimeout(() => {
    fn();
    setInterval(fn, 24 * 60 * 60 * 1000);
  }, delay);
}

// ── 작업 1: 파티 퀘스트 생성 ──────────────────────────────────
async function createPartyQuestsForHour(scheduledHour) {
  const connection = await pool.getConnection();
  try {
    // 활성 방 전체 조회
    const [rooms] = await connection.query('SELECT id FROM rooms');
    if (rooms.length === 0) {
      console.log(`[Cron] ${scheduledHour}시 — 활성 방 없음, 퀘스트 생성 건너뜀`);
      return;
    }

    // 랜덤 퀘스트 정의 1개 선택
    const [defs] = await connection.query(
      'SELECT id FROM party_quest_definitions WHERE is_active = TRUE ORDER BY RAND() LIMIT 1'
    );
    if (defs.length === 0) {
      console.warn(`[Cron] ${scheduledHour}시 — party_quest_definitions 데이터 없음`);
      return;
    }
    const definitionId = defs[0].id;
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // 방마다 INSERT (UNIQUE KEY 위반 시 무시 — 이미 생성된 방은 스킵)
    let created = 0;
    for (const room of rooms) {
      const [result] = await connection.query(
        `INSERT IGNORE INTO party_quests
           (room_id, definition_id, quest_date, scheduled_hour, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [room.id, definitionId, today, scheduledHour]
      );
      if (result.affectedRows > 0) created++;
    }

    console.log(`[Cron] ${scheduledHour}시 퀘스트 생성 완료 — ${created}개 방`);
  } catch (err) {
    console.error(`[Cron] ${scheduledHour}시 퀘스트 생성 오류:`, err.message);
  } finally {
    connection.release();
  }
}

// ── 작업 2: 수락 마감 만료 처리 ───────────────────────────────
async function expirePendingQuests(scheduledHour) {
  const connection = await pool.getConnection();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [result] = await connection.query(
      `UPDATE party_quests
       SET status = 'failed'
       WHERE scheduled_hour = ? AND quest_date = ? AND status = 'pending'`,
      [scheduledHour, today]
    );
    if (result.affectedRows > 0) {
      console.log(`[Cron] ${scheduledHour}시 미수락 퀘스트 만료 — ${result.affectedRows}건`);
    }
  } catch (err) {
    console.error(`[Cron] ${scheduledHour}시 만료 처리 오류:`, err.message);
  } finally {
    connection.release();
  }
}

// ── 작업 3: expires_at 지난 active 퀘스트 만료 ────────────────
async function expireActiveQuests() {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      `UPDATE party_quests
       SET status = 'failed'
       WHERE status = 'active' AND expires_at < NOW()`
    );
    if (result.affectedRows > 0) {
      console.log(`[Cron] 시간 초과 active 퀘스트 만료 — ${result.affectedRows}건`);
    }
  } catch (err) {
    console.error('[Cron] active 만료 처리 오류:', err.message);
  } finally {
    connection.release();
  }
}

// ── 스케줄러 시작 ────────────────────────────────────────────
function startPartyQuestCron() {
  console.log('[Cron] 파티 퀘스트 스케줄러 시작');

  // 퀘스트 생성: 01, 07, 13, 19시
  for (const hour of PARTY_HOURS) {
    scheduleDaily(hour, () => createPartyQuestsForHour(hour));
  }

  // 수락 마감 만료: 02, 08, 14, 20시
  for (const hour of PARTY_HOURS) {
    scheduleDaily(hour + 1, () => expirePendingQuests(hour));
  }

  // active 만료 체크: 5분마다 + 서버 시작 시 즉시 1회
  expireActiveQuests();
  setInterval(expireActiveQuests, 5 * 60 * 1000);
}

module.exports = { startPartyQuestCron };
