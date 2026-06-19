/**
 * cleanupCron.js
 *
 * 매일 자정(00:00)에 실행되는 데이터 정리 스케줄러.
 *
 * 역할
 *  - 업로드된 지 3일이 지난 이미지 파일을 로컬에서 삭제하고 image_url을 NULL로 초기화
 *  - DB 레코드(행) 자체는 유지 → 기여도 랭킹/누적 집계 정확도 보존
 *
 * 대상 테이블
 *  - daily_uploads         (upload_date 기준)
 *  - party_quest_uploads   (party_quests.quest_date 기준)
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db/db');

const UPLOAD_BASE = path.join(__dirname, '../../../uploads');

/** 로컬 이미지 파일 삭제 (없으면 무시) */
function deleteFileIfExists(imageUrl) {
  if (!imageUrl) return;
  const relativePath = imageUrl.replace(/^\/uploads\//, '');
  const fullPath = path.join(UPLOAD_BASE, relativePath);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(`[Cleanup] 파일 삭제 실패: ${fullPath} —`, err.message);
  }
}

/** 오늘(또는 내일) 00:00:00까지 남은 밀리초 */
function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

// ── 메인 정리 작업 ────────────────────────────────────────────
async function runCleanup() {
  console.log('[Cleanup] 자정 데이터 정리 작업 시작');
  const connection = await pool.getConnection();

  try {
    // 1. daily_uploads — 3일 이상 지난 이미지 파일 삭제 후 image_url NULL 처리
    const [oldDailyUploads] = await connection.query(
      `SELECT id, image_url FROM daily_uploads
       WHERE upload_date < CURDATE() - INTERVAL 3 DAY
         AND image_url IS NOT NULL`
    );

    if (oldDailyUploads.length > 0) {
      oldDailyUploads.forEach(row => deleteFileIfExists(row.image_url));

      await connection.query(
        `UPDATE daily_uploads
         SET image_url = NULL
         WHERE upload_date < CURDATE() - INTERVAL 3 DAY
           AND image_url IS NOT NULL`
      );
      console.log(`[Cleanup] daily_uploads 이미지 ${oldDailyUploads.length}건 정리 완료 (레코드 유지)`);
    } else {
      console.log('[Cleanup] daily_uploads — 정리 대상 없음');
    }

    // 2. party_quest_uploads — 3일 이상 지난 이미지 파일 삭제 후 image_url NULL 처리
    const [oldPartyUploads] = await connection.query(
      `SELECT pqu.id, pqu.image_url
       FROM party_quest_uploads pqu
       JOIN party_quests pq ON pqu.party_quest_id = pq.id
       WHERE pq.quest_date < CURDATE() - INTERVAL 3 DAY
         AND pqu.image_url IS NOT NULL`
    );

    if (oldPartyUploads.length > 0) {
      oldPartyUploads.forEach(row => deleteFileIfExists(row.image_url));

      const ids = oldPartyUploads.map(r => r.id);
      await connection.query(
        `UPDATE party_quest_uploads
         SET image_url = NULL
         WHERE id IN (?)`,
        [ids]
      );
      console.log(`[Cleanup] party_quest_uploads 이미지 ${oldPartyUploads.length}건 정리 완료 (레코드 유지)`);
    } else {
      console.log('[Cleanup] party_quest_uploads — 정리 대상 없음');
    }

    console.log('[Cleanup] 자정 데이터 정리 작업 완료');
  } catch (err) {
    console.error('[Cleanup] 데이터 정리 오류:', err.message);
  } finally {
    connection.release();
  }
}

// ── 스케줄러 시작 ─────────────────────────────────────────────
function startCleanupCron() {
  const delay = msUntilMidnight();
  const minutesLeft = Math.round(delay / 60000);
  console.log(`[Cleanup] 자정 정리 스케줄 등록 — ${minutesLeft}분 후 첫 실행`);

  setTimeout(() => {
    runCleanup();
    setInterval(runCleanup, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { startCleanupCron, runCleanup };
