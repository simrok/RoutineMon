# RoutineMon API 명세

> **Base URL** `http://localhost:4000/api`  
> **인증 방식** 없음 (로그인 없이 방 코드 + 플레이어 ID 기반)  
> **Content-Type** `application/json`  
> **실시간 통신** Socket.io (별도 섹션 참고)

---

## 목차

1. [공통 응답 형식](#공통-응답-형식)
2. [방 (Rooms)](#방-rooms)
3. [플레이어 (Players)](#플레이어-players)
4. [루틴 (Routines)](#루틴-routines)
5. [일일 업로드 (Daily Uploads)](#일일-업로드-daily-uploads)
6. [파티 퀘스트 (Party Quests)](#파티-퀘스트-party-quests)
7. [루틴몬 (Mons)](#루틴몬-mons)
8. [도감 (Mon Catalog)](#도감-mon-catalog)
9. [스킨 (Skins)](#스킨-skins)
10. [Socket.io 이벤트](#socketio-이벤트)

---

## 공통 응답 형식

### 성공

```json
{
  "success": true,
  "data": { ... }
}
```

### 실패

```json
{
  "success": false,
  "error": "에러 메시지"
}
```

### 공통 에러 코드

| HTTP 상태 | 의미 |
|-----------|------|
| 400 | 요청 파라미터 오류 |
| 401 | PIN 인증 실패 |
| 404 | 리소스 없음 |
| 409 | 중복 (슬롯 이미 사용 중 등) |
| 500 | 서버 내부 오류 |

---

## 방 (Rooms)

### `POST /rooms` — 방 생성

새 방을 생성하고 6자리 코드를 발급합니다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| maxPlayers | number | ✅ | 최대 인원 (1~5) |

```json
{
  "maxPlayers": 4
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "roomId": 1,
    "roomCode": "A3F9K2",
    "maxPlayers": 4,
    "createdAt": "2025-06-01T00:00:00Z"
  }
}
```

---

### `GET /rooms/:roomCode` — 방 정보 조회

방 코드로 방 전체 현황을 조회합니다. 입장 시 초기 데이터 로드에 사용합니다.

**Response**

```json
{
  "success": true,
  "data": {
    "roomId": 1,
    "roomCode": "A3F9K2",
    "maxPlayers": 4,
    "players": [
      {
        "playerId": 10,
        "slotNumber": 1,
        "nickname": "서영",
        "currentSkinId": null,
        "hasPin": true
      }
    ],
    "mon": {
      "monId": 5,
      "catalogId": null,
      "stage": "egg",
      "level": 1,
      "expPercentage": 30.0
    },
    "dailyQuestProgress": {
      "completedCount": 1,
      "totalCount": 4
    }
  }
}
```

---

## 플레이어 (Players)

### `POST /rooms/:roomCode/players` — 플레이어 슬롯 등록 (최초 입장)

처음 입장 시 닉네임과 PIN을 설정하고 슬롯을 점유합니다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| slotNumber | number | ✅ | 슬롯 번호 (1~5) |
| nickname | string | ✅ | 닉네임 (최대 20자) |
| pin | string | ✅ | 숫자 4자리 |

```json
{
  "slotNumber": 2,
  "nickname": "민지",
  "pin": "1234"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "playerId": 11,
    "slotNumber": 2,
    "nickname": "민지"
  }
}
```

**에러**
- `409` — 해당 슬롯이 이미 사용 중

---

### `POST /rooms/:roomCode/players/:slotNumber/verify` — PIN 인증 (재입장)

재입장 시 슬롯 + PIN으로 본인 인증합니다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| pin | string | ✅ | 숫자 4자리 |

```json
{
  "pin": "1234"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "playerId": 11,
    "slotNumber": 2,
    "nickname": "민지"
  }
}
```

**에러**
- `401` — PIN 불일치

---

### `POST /rooms/:roomCode/players/:slotNumber/reset-pin` — PIN 분실 재설정

다른 플레이어 1명의 실시간 승인 후 PIN을 재설정합니다.  
승인 흐름은 Socket.io 이벤트로 처리됩니다. 이 엔드포인트는 승인 완료 후 새 PIN을 저장하는 용도입니다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| newPin | string | ✅ | 새 PIN 4자리 |
| approverPlayerId | number | ✅ | 승인한 플레이어 ID |

```json
{
  "newPin": "5678",
  "approverPlayerId": 10
}
```

**Response**

```json
{
  "success": true
}
```

---

### `PATCH /players/:playerId` — 플레이어 정보 수정

닉네임 또는 현재 스킨을 변경합니다. PIN 인증 필요 (`X-Player-Pin` 헤더).

**Request Header**

| 헤더 | 설명 |
|------|------|
| X-Player-Pin | 현재 플레이어의 PIN (4자리) |

**Request Body** (변경할 필드만 포함)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| nickname | string | ❌ | 새 닉네임 |
| currentSkinId | number \| null | ❌ | 적용할 스킨 ID (null이면 기본 스킨) |

```json
{
  "nickname": "서영이",
  "currentSkinId": 3
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "playerId": 10,
    "nickname": "서영이",
    "currentSkinId": 3
  }
}
```

---

### `GET /players/:playerId/contribution` — 기여도 조회

해당 플레이어의 누적 기여도 점수를 반환합니다.

**Response**

```json
{
  "success": true,
  "data": {
    "playerId": 10,
    "dailyCompletedDays": 12,
    "partyContributions": 8,
    "totalScore": 44
  }
}
```

> **기여도 공식**: `(일일 퀘스트 완료 일수 × 3) + (파티 퀘스트 기여 횟수 × 1)`

---

### `GET /rooms/:roomCode/players/ranking` — 기여도 TOP 3 조회

방 기준 기여도 상위 3명을 반환합니다. 플레이어 방 슬롯 표시에 사용합니다.

**Response**

```json
{
  "success": true,
  "data": [
    { "playerId": 10, "nickname": "서영", "slotNumber": 1, "score": 44, "rank": 1 },
    { "playerId": 12, "nickname": "지훈", "slotNumber": 3, "score": 30, "rank": 2 },
    { "playerId": 11, "nickname": "민지", "slotNumber": 2, "score": 21, "rank": 3 }
  ]
}
```

---

## 루틴 (Routines)

### `GET /players/:playerId/routines` — 루틴 목록 조회

**Response**

```json
{
  "success": true,
  "data": [
    { "routineId": 1, "slotNumber": 1, "title": "아침 스트레칭", "emoji": "🧘" },
    { "routineId": 2, "slotNumber": 2, "title": "독서", "emoji": "📚" },
    { "routineId": 3, "slotNumber": 3, "title": "물 마시기", "emoji": "💧" },
    { "routineId": 4, "slotNumber": 4, "title": "운동", "emoji": "🏃" }
  ]
}
```

---

### `PUT /players/:playerId/routines` — 루틴 전체 저장 (등록/수정)

루틴 1~4개를 한 번에 저장합니다. 기존 루틴은 덮어씁니다.

**Request Body**

```json
{
  "routines": [
    { "slotNumber": 1, "title": "아침 스트레칭", "emoji": "🧘" },
    { "slotNumber": 2, "title": "독서", "emoji": "📚" },
    { "slotNumber": 3, "title": "물 마시기", "emoji": "💧" },
    { "slotNumber": 4, "title": "운동", "emoji": "🏃" }
  ]
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "saved": 4
  }
}
```

---

## 일일 업로드 (Daily Uploads)

### `POST /players/:playerId/daily-uploads` — 루틴 사진 업로드

루틴 인증 사진을 업로드합니다. `multipart/form-data` 형식을 사용합니다.  
Cloudinary 업로드 후 URL을 DB에 저장합니다.

**Request** (`multipart/form-data`)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| routineId | number | ✅ | 어떤 루틴의 사진인지 |
| image | file | ✅ | 이미지 파일 |

**Response**

```json
{
  "success": true,
  "data": {
    "uploadId": 55,
    "routineId": 2,
    "imageUrl": "https://res.cloudinary.com/.../photo.jpg",
    "uploadDate": "2025-06-01"
  }
}
```

---

### `GET /rooms/:roomCode/daily-uploads/today` — 오늘 방 전체 업로드 현황 조회

오늘 날짜 기준 방 전체 플레이어의 루틴 업로드 현황을 반환합니다.

**Response**

```json
{
  "success": true,
  "data": {
    "date": "2025-06-01",
    "players": [
      {
        "playerId": 10,
        "nickname": "서영",
        "uploads": [
          { "routineId": 1, "imageUrl": "https://res.cloudinary.com/.../1.jpg" },
          { "routineId": 2, "imageUrl": "https://res.cloudinary.com/.../2.jpg" },
          { "routineId": 3, "imageUrl": null },
          { "routineId": 4, "imageUrl": null }
        ],
        "completedCount": 2,
        "isDailyQuestDone": false
      }
    ],
    "dailyQuestProgress": {
      "completedCount": 1,
      "totalCount": 4
    }
  }
}
```

> **일일 퀘스트 완료 조건**: 루틴 4개 중 **3개 이상** 업로드

---

## 파티 퀘스트 (Party Quests)

### `GET /rooms/:roomCode/party-quests/active` — 현재 활성 파티 퀘스트 조회

현재 `active` 상태인 파티 퀘스트를 반환합니다. 없으면 `data: null`.

**Response**

```json
{
  "success": true,
  "data": {
    "partyQuestId": 7,
    "content": "빨간 지붕을 찍어라!",
    "status": "active",
    "acceptedByPlayerId": 10,
    "acceptedAt": "2025-06-01T07:05:00Z",
    "expiresAt": "2025-06-01T09:05:00Z",
    "uploads": [
      {
        "playerId": 10,
        "imageUrl": "https://res.cloudinary.com/.../pq1.jpg",
        "validationStatus": "approved"
      }
    ]
  }
}
```

---

### `POST /rooms/:roomCode/party-quests/pending` — 대기 중인 파티 퀘스트 조회

`pending` 상태(수락 전)의 파티 퀘스트를 반환합니다. 팝업 알림에 사용합니다.

**Response**

```json
{
  "success": true,
  "data": {
    "partyQuestId": 8,
    "content": "브이를 하고 셀카를 찍으세요!",
    "scheduledHour": 13,
    "status": "pending"
  }
}
```

---

### `POST /party-quests/:partyQuestId/accept` — 파티 퀘스트 수락

플레이어가 YES를 눌러 퀘스트를 수락합니다. 수락 시 `expiresAt`이 2시간 후로 설정됩니다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| playerId | number | ✅ | 수락한 플레이어 ID |

```json
{
  "playerId": 10
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "partyQuestId": 8,
    "status": "active",
    "expiresAt": "2025-06-01T15:05:00Z"
  }
}
```

---

### `POST /party-quests/:partyQuestId/uploads` — 파티 퀘스트 사진 업로드

파티 퀘스트 인증 사진을 업로드합니다. 업로드 후 Claude Vision API로 자동 검증합니다.

**Request** (`multipart/form-data`)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| playerId | number | ✅ | 업로드한 플레이어 ID |
| image | file | ✅ | 이미지 파일 |

**Response**

```json
{
  "success": true,
  "data": {
    "uploadId": 33,
    "validationStatus": "pending",
    "message": "이미지를 검증 중입니다..."
  }
}
```

> **검증 결과**는 Socket.io `party-quest:validation-result` 이벤트로 수신

---

## 루틴몬 (Mons)

### `GET /rooms/:roomCode/mon` — 루틴몬 현황 조회

방의 루틴몬 현재 상태를 반환합니다.

**Response**

```json
{
  "success": true,
  "data": {
    "monId": 5,
    "catalogId": null,
    "name": "루몬",
    "category": null,
    "stage": "egg",
    "level": 1,
    "expPercentage": 30.0,
    "status": "normal",
    "statusEmoji": "O o O",
    "lastQuestCompletedDate": "2025-06-01",
    "lastPartyQuestCompletedAt": null
  }
}
```

> **status 값**: `excited` / `streak` / `evolving` / `normal` / `warning` / `sleeping` / `dead`  
> status 우선순위는 README의 루틴몬 상태 시스템 참고

---

## 도감 (Mon Catalog)

### `GET /mon-catalog` — 전체 Mon 도감 조회

방 기준으로 획득 여부를 함께 반환합니다.

**Query Parameter**

| 파라미터 | 설명 |
|----------|------|
| roomId | 방 ID (획득 여부 판단용) |

**Response**

```json
{
  "success": true,
  "data": [
    {
      "catalogId": 1,
      "name": "고냥이",
      "category": "land",
      "rarity": "common",
      "babyImageUrl": "https://res.cloudinary.com/.../cat_baby.png",
      "childImageUrl": "https://res.cloudinary.com/.../cat_child.png",
      "adultImageUrl": "https://res.cloudinary.com/.../cat_adult.png",
      "obtained": true
    },
    {
      "catalogId": 2,
      "name": "???",
      "category": "ocean",
      "rarity": "uncommon",
      "babyImageUrl": null,
      "childImageUrl": null,
      "adultImageUrl": null,
      "obtained": false
    }
  ]
}
```

> 미획득 Mon은 이미지 URL을 `null`로 반환하여 프론트에서 실루엣 처리

---

## 스킨 (Skins)

### `GET /skins` — 전체 스킨 목록 조회

보유 여부를 함께 반환합니다.

**Query Parameter**

| 파라미터 | 설명 |
|----------|------|
| playerId | 플레이어 ID (보유 여부 판단용) |

**Response**

```json
{
  "success": true,
  "data": [
    {
      "skinId": 1,
      "name": "핑크 땡땡이 스킨",
      "imageUrl": "https://res.cloudinary.com/.../skin1.png",
      "description": "귀여운 핑크 도트 패턴",
      "owned": true
    },
    {
      "skinId": 2,
      "name": "별빛 스킨",
      "imageUrl": "https://res.cloudinary.com/.../skin2.png",
      "description": "반짝이는 별 패턴",
      "owned": false
    }
  ]
}
```

---

### `GET /players/:playerId/skins` — 플레이어 보유 스킨 조회

**Response**

```json
{
  "success": true,
  "data": [
    {
      "skinId": 1,
      "name": "핑크 땡땡이 스킨",
      "imageUrl": "https://res.cloudinary.com/.../skin1.png",
      "obtainedAt": "2025-06-01T13:20:00Z"
    }
  ]
}
```

---

## Socket.io 이벤트

> 클라이언트는 방 입장 시 `roomCode` 기준으로 소켓 룸에 join합니다.

```js
socket.emit('join-room', { roomCode: 'A3F9K2', playerId: 10 });
```

---

### 서버 → 클라이언트 (수신)

| 이벤트 | 발생 시점 | payload |
|--------|----------|---------|
| `room:player-joined` | 새 플레이어 입장 | `{ playerId, slotNumber, nickname }` |
| `room:player-left` | 플레이어 퇴장 | `{ playerId }` |
| `daily:upload-updated` | 누군가 루틴 사진 업로드 | `{ playerId, routineId, uploadedCount }` |
| `daily:quest-completed` | 방 전체 일일 퀘스트 완료 | `{ expGained: 20 }` |
| `party-quest:new` | 새 파티 퀘스트 발생 (01/07/13/19시) | `{ partyQuestId, content }` |
| `party-quest:accepted` | 누군가 파티 퀘스트 수락 | `{ partyQuestId, acceptedByPlayerId, expiresAt }` |
| `party-quest:upload-updated` | 누군가 파티 퀘스트 사진 업로드 | `{ playerId, validationStatus }` |
| `party-quest:validation-result` | AI 검증 결과 수신 | `{ partyQuestId, playerId, result: "approved" \| "rejected" }` |
| `party-quest:completed` | 파티 퀘스트 전원 완료 | `{ expGained: 5, skinReward: { skinId, name } \| null }` |
| `party-quest:failed` | 제한 시간 초과 실패 | `{ partyQuestId }` |
| `mon:exp-updated` | Mon EXP 변화 | `{ expPercentage, level, stage }` |
| `mon:evolved` | Mon 진화 | `{ newStage, catalogId, name }` |
| `mon:status-changed` | Mon 상태 변화 | `{ status, statusEmoji }` |

---

### 클라이언트 → 서버 (송신)

| 이벤트 | 설명 | payload |
|--------|------|---------|
| `join-room` | 방 소켓 룸 입장 | `{ roomCode, playerId }` |
| `leave-room` | 방 소켓 룸 퇴장 | `{ roomCode, playerId }` |
| `pin-reset:request` | PIN 분실 — 승인 요청 브로드캐스트 | `{ roomCode, requestingPlayerId, nickname }` |
| `pin-reset:approve` | 다른 플레이어의 승인 | `{ roomCode, approvingPlayerId, requestingPlayerId }` |

---

## 미구현 예정 (향후 확장)

| 기능 | 비고 |
|------|------|
| `GET /rooms/:roomCode/logs` | 로그 생성 (당일 사진 묶음 다운로드) |
| `POST /players/:playerId/pin` | PIN 변경 |
| 관리자용 `party_quest_definitions` CRUD | 퀘스트 내용 추가/비활성화 |
