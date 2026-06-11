const pool = require('../db/db');

// [GET] /api/skins - 전체 스킨 목록 조회 (보유 여부 포함)
exports.getAllSkins = async (req, res) => {
  try {
    const { playerId } = req.query;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: "요청 파라미터 오류: playerId가 필요합니다."
      });
    }

    const query = `
      SELECT 
        s.id AS skinId,
        s.name,
        s.image_url AS imageUrl,
        s.description,
        IF(ps.id IS NOT NULL, 1, 0) AS owned
      FROM skins s
      LEFT JOIN player_skins ps ON s.id = ps.skin_id AND ps.player_id = ?
    `;

    const [rows] = await pool.query(query, [playerId]);

    const responseData = rows.map(row => ({
      skinId: row.skinId,
      name: row.name,
      imageUrl: row.imageUrl,
      description: row.description || null,
      owned: row.owned === 1
    }));

    return res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error("Error in getAllSkins Controller:", error);
    return res.status(500).json({
      success: false,
      error: "서버 내부 오류가 발생했습니다."
    });
  }
};

// [GET] /api/players/:playerId/skins - 플레이어 보유 스킨 조회
exports.getPlayerSkins = async (req, res) => {
  try {
    const { playerId } = req.params;

    const query = `
      SELECT 
        s.id AS skinId,
        s.name,
        s.image_url AS imageUrl,
        ps.obtained_at AS obtainedAt
      FROM skins s
      INNER JOIN player_skins ps ON s.id = ps.skin_id
      WHERE ps.player_id = ?
      ORDER BY ps.obtained_at DESC
    `;

    const [rows] = await pool.query(query, [playerId]);

    return res.status(200).json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error("Error in getPlayerSkins Controller:", error);
    return res.status(500).json({
      success: false,
      error: "서버 내부 오류가 발생했습니다."
    });
  }
};