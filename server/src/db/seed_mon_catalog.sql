-- mon_catalog 시드 데이터 (3종)
-- 실행: MySQL에서 직접 실행하거나 서버 초기화 시 사용

INSERT INTO mon_catalog (id, name, category, rarity, baby_image_url, child_image_url, adult_image_url)
VALUES
  (1, '고녕이', 'land', 'common',
   '/assets/routinemon/cat/cat1.png',
   '/assets/routinemon/cat/cat2.png',
   '/assets/routinemon/cat/cat3.png'),
  (2, '룡룡이', 'land', 'uncommon',
   '/assets/routinemon/dino/dino1.png',
   '/assets/routinemon/dino/dino2.png',
   '/assets/routinemon/dino/dino3.png'),
  (3, '팬더', 'land', 'common',
   '/assets/routinemon/panda/panda1.png',
   '/assets/routinemon/panda/panda2.png',
   '/assets/routinemon/panda/panda3.png')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  baby_image_url = VALUES(baby_image_url),
  child_image_url = VALUES(child_image_url),
  adult_image_url = VALUES(adult_image_url);
