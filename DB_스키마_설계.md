# 루틴몬 (RoutineMon) DB 스키마 설계

## 테이블 목록

| # | 테이블명 | 설명 |
|---|----------|------|
| 1 | `rooms` | 플레이어 방 |
| 2 | `players` | 방 안의 플레이어 슬롯 |
| 3 | `routines` | 플레이어별 일일 루틴 (최대 4개) |
| 4 | `daily_uploads` | 일일 루틴 사진 업로드 |
| 5 | `party_quest_definitions` | 파티 퀘스트 내용 풀(pool) |
| 6 | `party_quests` | 파티 퀘스트 인스턴스 (방별/날짜별) |
| 7 | `party_quest_uploads` | 파티 퀘스트 사진 업로드 |
| 8 | `mon_catalog` | Mon 도감 (전체 종류 정의) |
| 9 | `mons` | 방별 Mon 현황 (성장 상태) |
| 10 | `skins` | 캐릭터 스킨 목록 |
| 11 | `player_skins` | 플레이어가 보유한 스킨 |
| 12 | `exp_logs` | EXP 획득 이력 |

---

## ERD 관계 요약

```
rooms ──< players ──< routines ──< daily_uploads
  │          │
  │          └──< player_skins >── skins
  │
  ├──< party_quests >── party_quest_definitions
  │         └──< party_quest_uploads
  │
  └──── mons >── mon_catalog
         └──< exp_logs
```

---

## 테이블 상세 설계

### 1. rooms — 플레이어 방

```sql
CREATE TABLE rooms (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  room_code   VARCHAR(6)    NOT NULL UNIQUE,       -- 6자리 숫자 코드 (ex. 123456)
  max_players TINYINT       NOT NULL DEFAULT 4,    -- 1~5
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK |
| room_code | VARCHAR(6) | 숫자+알파벳 6자리, 입장 코드 |
| max_players | TINYINT | 방 개설 시 설정한 최대 인원 (1~5) |
| created_at | DATETIME | 방 생성 시각 |

---

### 2. players — 플레이어 슬롯

```sql
CREATE TABLE players (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  room_id         INT           NOT NULL,
  slot_number     TINYINT       NOT NULL,             -- 1~5 (플레이어 슬롯 번호)
  nickname        VARCHAR(7)    DEFAULT 'Unknown',
  pin_hash        VARCHAR(255)  DEFAULT NULL,         -- bcrypt 해시, 닉네임 설정 시 함께 등록
  is_host         BOOLEAN       DEFAULT FALSE,        -- 방을 신설한 플레이어 여부
  current_skin_id INT           DEFAULT NULL,         -- 현재 적용 스킨 (NULL = 기본)
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (current_skin_id) REFERENCES skins(id),
  UNIQUE KEY uq_room_slot (room_id, slot_number)      -- 방 안에서 슬롯 번호 중복 불가
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK |
| room_id | INT | FK → rooms |
| slot_number | TINYINT | 방 안의 플레이어 슬롯 번호 (1~5) |
| nickname | VARCHAR(7) | 기본값 'Unknown', 입장 시 설정 (한글/영문/숫자, 최대 7자) |
| pin_hash | VARCHAR(255) | bcrypt 해시, 닉네임 설정 시 함께 등록. 이후 재입장 시 PIN 검증에 사용 |
| is_host | BOOLEAN | 방을 신설한 플레이어이면 TRUE. 홈 버튼 클릭 시 팝업 여부 분기에 사용 |
| current_skin_id | INT | FK → skins, 현재 적용 중인 스킨 |

> **Note:** 방이 삭제되면 players도 CASCADE 삭제됨

---

### 3. routines — 플레이어별 일일 루틴

```sql
CREATE TABLE routines (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  player_id   INT           NOT NULL,
  slot_number TINYINT       NOT NULL,    -- 1~4 (루틴 슬롯 번호)
  title       VARCHAR(50)   NOT NULL,    -- 루틴 이름 (ex. "아침 스트레칭")
  emoji       VARCHAR(10)   DEFAULT NULL,-- 루틴 이모지 (ex. "🧘")
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY uq_player_slot (player_id, slot_number)
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK |
| player_id | INT | FK → players |
| slot_number | TINYINT | 루틴 슬롯 번호 (1~4) |
| title | VARCHAR(50) | 루틴 이름 |
| emoji | VARCHAR(10) | 루틴 대표 이모지 |

---

### 4. daily_uploads — 일일 루틴 사진 업로드

```sql
CREATE TABLE daily_uploads (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  player_id   INT           NOT NULL,
  routine_id  INT           NOT NULL,
  image_url   VARCHAR(500)  NOT NULL,    -- Cloudinary URL
  upload_date DATE          NOT NULL,    -- 업로드 날짜 (자정 초기화 기준)
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK |
| player_id | INT | FK → players |
| routine_id | INT | FK → routines (어떤 루틴의 사진인지) |
| image_url | VARCHAR(500) | Cloudinary 이미지 URL |
| upload_date | DATE | 업로드 날짜 (자정 초기화 및 3일 보존 기준) |

> **일일 퀘스트 진행도 계산 방식**
> - `upload_date = 오늘` 조건으로 플레이어별 업로드 수 집계
> - 3개 이상 업로드한 플레이어 수 = 일일 퀘스트 진행도
> - 별도 테이블 없이 쿼리로 계산 가능

---

### 5. party_quest_definitions — 파티 퀘스트 내용 풀

```sql
CREATE TABLE party_quest_definitions (
  id        INT           AUTO_INCREMENT PRIMARY KEY,
  content   VARCHAR(100)  NOT NULL,       -- 퀘스트 내용 (ex. "빨간 지붕을 찍어라!")
  is_active BOOLEAN       DEFAULT TRUE    -- 비활성화 시 랜덤 선택에서 제외
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK |
| content | VARCHAR(100) | 퀘스트 내용 텍스트 |
| is_active | BOOLEAN | 활성화 여부 (관리용) |

> **초기 데이터 예시**
> - "빨간 지붕을 찍어라!"
> - "바깥의 노란 간판을 찍어라!"
> - "긴급 물마시기! 물컵을 찍으세요!"
> - "브이를 하고 셀카를 찍으세요!"

---

### 6. party_quests — 파티 퀘스트 인스턴스

```sql
CREATE TABLE party_quests (
  id                    INT       AUTO_INCREMENT PRIMARY KEY,
  room_id               INT       NOT NULL,
  definition_id         INT       NOT NULL,
  quest_date            DATE      NOT NULL,
  scheduled_hour        TINYINT   NOT NULL,    -- 1, 7, 13, 19 (발생 시각)
  status                ENUM('pending', 'active', 'completed', 'failed') DEFAULT 'pending',
  accepted_by_player_id INT       DEFAULT NULL, -- 수락한 플레이어
  accepted_at           DATETIME  DEFAULT NULL,
  expires_at            DATETIME  DEFAULT NULL, -- accepted_at + 2시간

  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (definition_id) REFERENCES party_quest_definitions(id),
  FOREIGN KEY (accepted_by_player_id) REFERENCES players(id),
  UNIQUE KEY uq_room_date_hour (room_id, quest_date, scheduled_hour)
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK |
| room_id | INT | FK → rooms |
| definition_id | INT | FK → party_quest_definitions |
| quest_date | DATE | 퀘스트 발생 날짜 |
| scheduled_hour | TINYINT | 발생 시각 (1 / 7 / 13 / 19) |
| status | ENUM | pending(대기) / active(진행중) / completed(완료) / failed(실패) |
| accepted_by_player_id | INT | YES 버튼 누른 플레이어 |
| accepted_at | DATETIME | 수락 시각 |
| expires_at | DATETIME | 제한 시간 만료 시각 (수락 후 +2시간) |

---

### 7. party_quest_uploads — 파티 퀘스트 사진

```sql
CREATE TABLE party_quest_uploads (
  id                INT           AUTO_INCREMENT PRIMARY KEY,
  party_quest_id    INT           NOT NULL,
  player_id         INT           NOT NULL,
  image_url         VARCHAR(500)  NOT NULL,
  validation_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',  -- AI 이미지 판별 결과
  created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (party_quest_id) REFERENCES party_quests(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY uq_quest_player (party_quest_id, player_id)  -- 플레이어당 1장
);
```

> **파티 퀘스트 완료 조건**: 해당 room의 모든 players가 업로드 완료 시 `party_quests.status = 'completed'`

---

### 8. mon_catalog — Mon 도감

```sql
CREATE TABLE mon_catalog (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(30)   NOT NULL,
  category        ENUM('land', 'ocean', 'rare') NOT NULL,
  rarity          ENUM('common', 'uncommon', 'rare') NOT NULL DEFAULT 'common',
  egg_image_url   VARCHAR(500)  DEFAULT NULL,   -- 알 단계 이미지 (공통 알 이미지 사용 가능)
  baby_image_url  VARCHAR(500)  DEFAULT NULL,
  child_image_url VARCHAR(500)  DEFAULT NULL,
  adult_image_url VARCHAR(500)  DEFAULT NULL
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| category | ENUM | land(육지) / ocean(해양) / rare(희귀) |
| rarity | ENUM | 성장 완료 후 다음 알 확률에 영향 |

> **도감 구성**: 육지 5종 + 해양 5종 + 희귀 3종 = 총 15종 (기획 기준)

---

### 9. mons — 방별 Mon 현황

```sql
CREATE TABLE mons (
  id                              INT             AUTO_INCREMENT PRIMARY KEY,
  room_id                         INT             NOT NULL UNIQUE,   -- 방당 Mon 1마리
  catalog_id                      INT             DEFAULT NULL,      -- NULL = 알 단계 (종류 미공개)
  stage                           ENUM('egg', 'baby', 'child', 'adult') DEFAULT 'egg',
  level                           TINYINT         DEFAULT 1,         -- 각 단계 내 레벨 (1 or 2)
  exp_percentage                  DECIMAL(5,2)    DEFAULT 0.00,      -- 0.00 ~ 100.00
  last_quest_completed_date       DATE            DEFAULT NULL,      -- 마지막 일일 퀘스트 완료 날짜 (패널티/상태 계산용)
  last_party_quest_completed_at   DATETIME        DEFAULT NULL,      -- 마지막 파티 퀘스트 완료 시각 (완료 후 30분 흥분 상태용)
  created_at                      DATETIME        DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_id) REFERENCES mon_catalog(id)
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| catalog_id | INT | 알 단계에서는 NULL, 아기 단계 전환 시 확률로 배정 |
| stage | ENUM | egg → baby → child → adult |
| level | TINYINT | 단계 내 레벨 1 or 2 |
| exp_percentage | DECIMAL | 현재 레벨 내 EXP %, 패널티로 0.00 아래로 내려가지 않음 |
| last_quest_completed_date | DATE | 방 전체 기준 마지막 일일 퀘스트 완료 날짜. 오늘 날짜와 차이로 미진행 일수 계산 |
| last_party_quest_completed_at | DATETIME | 마지막 파티 퀘스트 완료 시각. 현재 시각과 비교해 30분 이내면 흥분 상태 표시 |

> **성장 로직**
> - EXP 100% 도달 → level +1 (or 다음 stage로 전환)
> - adult lv2 EXP 100% → 새로운 egg 생성 (catalog_id 확률 재배정)
> - EXP 획득: 일일 퀘스트 완료 +20% / 파티 퀘스트 완료 +5%

---

### 10. skins — 캐릭터 스킨 목록

```sql
CREATE TABLE skins (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(30)   NOT NULL,       -- ex. "핑크 땡땡이 스킨"
  image_url   VARCHAR(500)  NOT NULL,
  description VARCHAR(100)  DEFAULT NULL
);
```

---

### 11. player_skins — 플레이어 보유 스킨

```sql
CREATE TABLE player_skins (
  id          INT       AUTO_INCREMENT PRIMARY KEY,
  player_id   INT       NOT NULL,
  skin_id     INT       NOT NULL,
  obtained_at DATETIME  DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (skin_id) REFERENCES skins(id),
  UNIQUE KEY uq_player_skin (player_id, skin_id)  -- 중복 보유 불가
);
```

> 파티 퀘스트 완료 보상으로 랜덤 스킨 1개 획득 가능 (낮은 확률)

---

### 12. exp_logs — EXP 획득 이력

```sql
CREATE TABLE exp_logs (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  mon_id      INT           NOT NULL,
  source      ENUM('daily_quest', 'party_quest') NOT NULL,
  exp_gained  DECIMAL(5,2)  NOT NULL,
  gained_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (mon_id) REFERENCES mons(id) ON DELETE CASCADE
);
```

> 선택 구현 테이블. Mon의 성장 이력 추적 및 디버깅용.

---

## 스케줄러 작업 목록 (node-cron)

| 작업 | 실행 주기 | 내용 |
|------|----------|------|
| 일일 퀘스트 초기화 | 매일 00:00 | 당일 진행도는 daily_uploads 쿼리로 계산하므로 별도 초기화 불필요 |
| 파티 퀘스트 생성 | 매일 01:00 / 07:00 / 13:00 / 19:00 | 모든 active 방에 party_quests 레코드 생성 |
| 파티 퀘스트 만료 처리 | 매 5분 | expires_at 지난 active 퀘스트 → status = 'failed' |
| 오래된 데이터 삭제 | 매일 00:00 | upload_date < 오늘-3일인 daily_uploads 삭제 |
| 비활성 방 자동 삭제 | 매 10분 | 생성 후 10분 이상 플레이어가 0명인 방 삭제 |

---

## 핵심 쿼리 예시

### 일일 퀘스트 진행도 조회
```sql
-- 방 ID 기준, 오늘 3개 이상 업로드한 플레이어 수
SELECT COUNT(DISTINCT p.id) AS progress
FROM players p
JOIN daily_uploads du ON du.player_id = p.id
WHERE p.room_id = :roomId
  AND du.upload_date = CURDATE()
GROUP BY p.id
HAVING COUNT(du.id) >= 3;
```

### 기여도 TOP 3 조회 (플레이어 방 슬롯 표시용)

> **기여도 기준**: (일일 퀘스트 완료 일수 × 3) + (파티 퀘스트 기여 횟수 × 1)
>
> | 활동 | 가중치 | 이유 |
> |------|--------|------|
> | 일일 퀘스트 완료 (1일) | **×3** | 하루 3개 이상 꾸준히 올려야 하는 핵심 습관 활동 |
> | 파티 퀘스트 기여 (1회) | **×1** | 하루 최대 4회, 순간 참여하는 보너스 활동 |
>
> → 파티 퀘스트 3회 참여 = 일일 퀘스트 1일 완료 (균형 유지)

```sql
SELECT
  p.id,
  p.nickname,
  p.slot_number,
  -- 가중치 적용: 일일 퀘스트 완료 일수 × 3 + 파티 퀘스트 기여 횟수 × 1
  (COALESCE(daily.completed_days, 0) * 3) + (COALESCE(party.party_count, 0) * 1) AS contribution_score
FROM players p

-- 일일 퀘스트 완료 일수: 하루 3개 이상 업로드한 날의 수 (누적)
LEFT JOIN (
  SELECT player_id, COUNT(*) AS completed_days
  FROM (
    SELECT player_id, upload_date
    FROM daily_uploads
    GROUP BY player_id, upload_date
    HAVING COUNT(id) >= 3
  ) AS daily_completions
  GROUP BY player_id
) daily ON daily.player_id = p.id

-- 파티 퀘스트 기여 횟수: 완료된 파티 퀘스트에 사진 올린 횟수 (누적)
LEFT JOIN (
  SELECT pqu.player_id, COUNT(*) AS party_count
  FROM party_quest_uploads pqu
  JOIN party_quests pq ON pq.id = pqu.party_quest_id
  WHERE pq.status = 'completed'
    AND pq.room_id = :roomId
  GROUP BY pqu.player_id
) party ON party.player_id = p.id

WHERE p.room_id = :roomId
ORDER BY contribution_score DESC
LIMIT 3;
```
