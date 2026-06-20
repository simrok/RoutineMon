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

let _io = null; // 소켓 인스턴스 (startPartyQuestCron에서 주입)

// ── 유틸 ──────────────────────────────────────────────────────
const KST_OFFSET = 9 * 60 * 60 * 1000;

/** KST 기준 현재 Date 객체 */
function nowKst() {
  return new Date(Date.now() + KST_OFFSET);
}

/** KST 기준 오늘 날짜 문자열 'YYYY-MM-DD' */
function todayKst() {
  return nowKst().toISOString().slice(0, 10);
}

/** KST 기준 hour:minute까지 남은 밀리초 */
function msUntilTime(hour, minute = 0) {
  const kstNow = nowKst();
  const target = new Date(kstNow);
  target.setUTCHours(hour, minute, 0, 0);
  if (target <= kstNow) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - kstNow.getTime();
}

/** hour:minute에 fn 실행, 이후 24시간마다 반복 */
function scheduleDaily(hour, fn, minute = 0) {
  const delay = msUntilTime(hour, minute);
  const minutesLeft = Math.round(delay / 60000);
  console.log(`[Cron] ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} 스케줄 등록 — ${minutesLeft}분 후 첫 실행`);

  setTimeout(() => {
    fn();
    setInterval(fn, 24 * 60 * 60 * 1000);
  }, delay);
}

// ── 작업 1: 파티 퀘스트 생성 ──────────────────────────────────
async function createPartyQuestsForHour(scheduledHour) {
  const connection = await pool.getConnection();
  try {
    // 활성 방 전체 조회 (room_code 포함)
    const [rooms] = await connection.query('SELECT id, room_code FROM rooms');
    if (rooms.length === 0) {
      console.log(`[Cron] ${scheduledHour}시 — 활성 방 없음, 퀘스트 생성 건너뜀`);
      return;
    }

    // 랜덤 퀘스트 정의 1개 선택
    const [defs] = await connection.query(
      'SELECT id, content FROM party_quest_definitions WHERE is_active = TRUE ORDER BY RAND() LIMIT 1'
    );
    if (defs.length === 0) {
      console.warn(`[Cron] ${scheduledHour}시 — party_quest_definitions 데이터 없음`);
      return;
    }
    const definitionId = defs[0].id;
    const questContent = defs[0].content;
    const today = todayKst();

    // 방마다 INSERT (UNIQUE KEY 위반 시 무시 — 이미 생성된 방은 스킵)
    let created = 0;
    for (const room of rooms) {
      const [result] = await connection.query(
        `INSERT IGNORE INTO party_quests
           (room_id, definition_id, quest_date, scheduled_hour, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [room.id, definitionId, today, scheduledHour]
      );
      if (result.affectedRows > 0) {
        created++;
        // 소켓 방송: 새 파티 퀘스트 발생
        if (_io) {
          const [newQuestRows] = await connection.query(
            'SELECT id FROM party_quests WHERE room_id = ? AND quest_date = ? AND scheduled_hour = ?',
            [room.id, today, scheduledHour]
          );
          if (newQuestRows.length > 0) {
            _io.to(room.room_code).emit('party-quest:new', {
              partyQuestId: newQuestRows[0].id,
              content: questContent,
              scheduledHour,
            });
          }
        }
      }
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
    const today = todayKst();
    // 만료 전 방 목록 조회 (소켓 방송용)
    const [pendingRows] = await connection.query(
      `SELECT pq.id, r.room_code FROM party_quests pq
       JOIN rooms r ON pq.room_id = r.id
       WHERE pq.scheduled_hour = ? AND pq.quest_date = ? AND pq.status = 'pending'`,
      [scheduledHour, today]
    );

    const [result] = await connection.query(
      `UPDATE party_quests
       SET status = 'failed'
       WHERE scheduled_hour = ? AND quest_date = ? AND status = 'pending'`,
      [scheduledHour, today]
    );
    if (result.affectedRows > 0) {
      console.log(`[Cron] ${scheduledHour}시 미수락 퀘스트 만료 — ${result.affectedRows}건`);
      // 소켓 방송: 수락 마감 만료
      if (_io) {
        for (const row of pendingRows) {
          _io.to(row.room_code).emit('party-quest:failed', { partyQuestId: row.id, reason: 'expired' });
        }
      }
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

// ── 서버 시작 시 놓친 퀘스트 즉시 생성 ──────────────────────
/**
 * 서버가 퀘스트 발생 후 재시작됐을 때를 대비해,
 * 현재 시각이 수락 윈도우(scheduledHour:00 ~ scheduledHour+2:30) 안이면
 * 즉시 해당 시간대 퀘스트 생성을 시도한다.
 * INSERT IGNORE 덕분에 이미 생성된 방은 중복 생성되지 않는다.
 */
async function catchUpMissedQuests() {
  const kst = nowKst();
  const curH = kst.getUTCHours();
  const curM = kst.getUTCMinutes();

  for (const hour of PARTY_HOURS) {
    const expireH = hour + 2;
    const expireM = 30;

    // 윈도우 시작: hour:00 / 윈도우 끝: (hour+2):30
    const afterStart = curH > hour || (curH === hour && curM >= 0);
    const beforeEnd  = curH < expireH || (curH === expireH && curM < expireM);

    if (afterStart && beforeEnd) {
      console.log(`[Cron] 서버 시작 — ${hour}시 퀘스트 윈도우 내 (현재 ${curH}:${String(curM).padStart(2,'0')}), 즉시 생성 시도`);
      await createPartyQuestsForHour(hour);
    }
  }
}

// ── 스케줄러 시작 ────────────────────────────────────────────
function startPartyQuestCron(io) {
  _io = io || null;
  console.log('[Cron] 파티 퀘스트 스케줄러 시작');

  // 서버 재시작으로 놓친 퀘스트 즉시 생성
  catchUpMissedQuests();

  // 퀘스트 생성: 01, 07, 13, 19시
  for (const hour of PARTY_HOURS) {
    scheduleDaily(hour, () => createPartyQuestsForHour(hour));
  }

  // 수락 마감 만료: 03:30, 09:30, 15:30, 21:30 (발생 후 2시간 30분)
  for (const hour of PARTY_HOURS) {
    scheduleDaily(hour + 2, () => expirePendingQuests(hour), 30);
  }

  // active 만료 체크: 5분마다 + 서버 시작 시 즉시 1회
  expireActiveQuests();
  setInterval(expireActiveQuests, 5 * 60 * 1000);
}

module.exports = { startPartyQuestCron, createPartyQuestsForHour };
