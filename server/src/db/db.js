const mysql = require('mysql2/promise');
require('dotenv').config();

// 커넥션 풀 생성
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST,
  user: process.env.MYSQLUSER || process.env.DB_USER,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
  database: process.env.MYSQLDATABASE || process.env.DB_NAME,
  port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306'),
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

    // 3-1. players 테이블 character_type 컬럼 추가 (없을 경우)
    try {
      await connection.query(`ALTER TABLE players ADD COLUMN character_type VARCHAR(50) DEFAULT NULL;`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

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

    // 6-1. party_quest_definitions 시드 데이터 (내용 변경 시 업데이트)
    await connection.query(`
      INSERT INTO party_quest_definitions (id, content, is_active) VALUES
        (1, '지금 먹고 있는 음식을 찍어라!', TRUE),
        (2, '식물이나 꽃과 함께 찍어라!', TRUE),
        (3, '웃는 표정으로 셀카를 찍어라!', TRUE),
        (4, '음료를 손에 들고 찍어라!', TRUE),
        (5, '책을 들고 있는 사진을 찍어라!', TRUE),
        (6, '신발 신은 발을 찍어라!', TRUE),
        (7, '손바닥을 카메라에 보여줘라!', TRUE),
        (8, '과일이나 채소를 찍어라!', TRUE),
        (9, '거울에 비친 자신을 찍어라!', TRUE),
        (10, '엄지척 포즈로 셀카를 찍어라!', TRUE)
      ON DUPLICATE KEY UPDATE content = VALUES(content), is_active = VALUES(is_active);
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
        accepted_player_count INT DEFAULT 1,
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

    // 9-1. mon_catalog 시드 데이터
    await connection.query(`
      INSERT INTO mon_catalog (id, name, category, rarity, egg_image_url, baby_image_url, child_image_url, adult_image_url) VALUES
        (1, '고양이', 'land', 'common',   '/assets/routinemon/egg.png', '/assets/routinemon/cat/cat1.png',   '/assets/routinemon/cat/cat2.png',   '/assets/routinemon/cat/cat3.png'),
        (2, '공룡',   'land', 'rare',     '/assets/routinemon/egg.png', '/assets/routinemon/dino/dino1.png', '/assets/routinemon/dino/dino2.png', '/assets/routinemon/dino/dino3.png'),
        (3, '판다',   'land', 'uncommon', '/assets/routinemon/egg.png', '/assets/routinemon/panda/panda1.png', '/assets/routinemon/panda/panda2.png', '/assets/routinemon/panda/panda3.png')
      ON DUPLICATE KEY UPDATE
        name = VALUES(name), egg_image_url = VALUES(egg_image_url),
        baby_image_url = VALUES(baby_image_url), child_image_url = VALUES(child_image_url),
        adult_image_url = VALUES(adult_image_url);
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
