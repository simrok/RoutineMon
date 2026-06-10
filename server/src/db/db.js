const mysql = require('mysql2/promise');
require('dotenv').config();

// 커넥션 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 테이블 생성 SQL 쿼리 실행 함수
const createTables = async () => {
  try {
    const connection = await pool.getConnection();
    
    console.log('⏳ 데이터베이스 테이블 생성 중...');

    // 1. rooms 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_code VARCHAR(6) NOT NULL UNIQUE,
        max_players TINYINT NOT NULL DEFAULT 4,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. skins 테이블 (players보다 먼저 생성해야 FK 연결 가능)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS skins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(30) NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        description VARCHAR(100) DEFAULT NULL
      );
    `);

    // 3. players 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        slot_number TINYINT NOT NULL,
        nickname VARCHAR(20) DEFAULT 'Unknown',
        pin_hash VARCHAR(255) DEFAULT NULL,
        current_skin_id INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (current_skin_id) REFERENCES skins(id),
        UNIQUE KEY uq_room_slot (room_id, slot_number)
      );
    `);

    // 4. routines 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS routines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        slot_number TINYINT NOT NULL,
        title VARCHAR(50) NOT NULL,
        emoji VARCHAR(10) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        UNIQUE KEY uq_player_slot (player_id, slot_number)
      );
    `);

    // 5. daily_uploads 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS daily_uploads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        routine_id INT NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        upload_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
      );
    `);

    // 6. party_quest_definitions 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS party_quest_definitions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE
      );
    `);

    // 7. party_quests 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS party_quests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        definition_id INT NOT NULL,
        quest_date DATE NOT NULL,
        scheduled_hour TINYINT NOT NULL,
        status ENUM('pending', 'active', 'completed', 'failed') DEFAULT 'pending',
        accepted_by_player_id INT DEFAULT NULL,
        accepted_at DATETIME DEFAULT NULL,
        expires_at DATETIME DEFAULT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (definition_id) REFERENCES party_quest_definitions(id),
        FOREIGN KEY (accepted_by_player_id) REFERENCES players(id),
        UNIQUE KEY uq_room_date_hour (room_id, quest_date, scheduled_hour)
      );
    `);

    // 8. party_quest_uploads 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS party_quest_uploads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        party_quest_id INT NOT NULL,
        player_id INT NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        validation_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (party_quest_id) REFERENCES party_quests(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        UNIQUE KEY uq_quest_player (party_quest_id, player_id)
      );
    `);

    // 9. mon_catalog 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS mon_catalog (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(30) NOT NULL,
        category ENUM('land', 'ocean', 'rare') NOT NULL,
        rarity ENUM('common', 'uncommon', 'rare') NOT NULL DEFAULT 'common',
        egg_image_url VARCHAR(500) DEFAULT NULL,
        baby_image_url VARCHAR(500) DEFAULT NULL,
        child_image_url VARCHAR(500) DEFAULT NULL,
        adult_image_url VARCHAR(500) DEFAULT NULL
      );
    `);

    // 10. mons 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS mons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL UNIQUE,
        catalog_id INT DEFAULT NULL,
        stage ENUM('EGG', 'BABY', 'CHILD', 'ADULT') NOT NULL,
        level TINYINT DEFAULT 1,
        exp_percentage DECIMAL(5,2) DEFAULT 0.00,
        last_quest_completed_date DATE DEFAULT NULL,
        last_party_quest_completed_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (catalog_id) REFERENCES mon_catalog(id)
      );
    `);

    // 11. player_skins 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS player_skins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        skin_id INT NOT NULL,
        obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (skin_id) REFERENCES skins(id),
        UNIQUE KEY uq_player_skin (player_id, skin_id)
      );
    `);

    // 12. exp_logs 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS exp_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mon_id INT NOT NULL,
        source ENUM('daily_quest', 'party_quest') NOT NULL,
        exp_gained DECIMAL(5,2) NOT NULL,
        gained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mon_id) REFERENCES mons(id) ON DELETE CASCADE
      );
    `);

    console.log('✅ 모든 데이터베이스 테이블 생성 완료!');
    connection.release();
  } catch (err) {
    console.error('❌ 테이블 생성 실패:', err.message);
  }
};

// 연결 테스트 및 테이블 생성 시작부
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL 데이터베이스 연결 성공! (routinemon)');
    connection.release();
    
    // 연결이 확인되면 안전하게 테이블 생성을 시작합니다.
    await createTables();
  } catch (err) {
    console.error('❌ DB 연결 실패:', err.message);
  }
};

// 실행
testConnection();

module.exports = pool;
