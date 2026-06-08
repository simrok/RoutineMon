const pool = require('../config/db');

/**
 * @ROUTE GET /api/mon-catalog
 * @DESC 전체 Mon 도감 조회 (방 기준 현재 획득 여부 및 블라인드 처리)
 */
const getMonCatalog = async (req, res) => {
  try {
    const { roomId } = req.query;

    // 1. 전체 도감 목록 조회
    const catalogQuery = `
      SELECT 
        id AS catalogId, 
        name, 
        category, 
        rarity, 
        baby_image_url AS babyImageUrl, 
        child_image_url AS childImageUrl, 
        adult_image_url AS adultImageUrl
      FROM mon_catalog
    `;
    const [catalogRows] = await pool.query(catalogQuery);

    // 2. 현재 방에서 키우고 있는 몬스터의 catalog_id 추출
    const obtainedCatalogIds = [];

    if (roomId) {
      const monQuery = `
        SELECT catalog_id 
        FROM mons 
        WHERE room_id = ? AND catalog_id IS NOT NULL
      `;
      const [monRows] = await pool.query(monQuery, [roomId]);
      
      // 방에 존재하는 몬스터가 있고 알(NULL) 상태가 아니라면 ID 저장
      if (monRows.length > 0) {
        obtainedCatalogIds.push(monRows[0].catalog_id);
      }
    }

    // 3. API 명세서 규격에 맞춘 데이터 가공 및 미획득 블라인드 처리
    const data = catalogRows.map(mon => {
      const isObtained = obtainedCatalogIds.includes(mon.catalogId);

      return {
        catalogId: mon.catalogId,
        name: isObtained ? mon.name : '???',
        category: mon.category,
        rarity: mon.rarity,
        babyImageUrl: isObtained ? mon.babyImageUrl : null,
        childImageUrl: isObtained ? mon.childImageUrl : null,
        adultImageUrl: isObtained ? mon.adultImageUrl : null,
        obtained: isObtained
      };
    });

    // 4. 명세서 공통 응답 규격 반환
    return res.status(200).json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('도감 조회 API 에러:', error);
    return res.status(500).json({
      success: false,
      error: '서버 내부 오류'
    });
  }
};

module.exports = {
  getMonCatalog
};