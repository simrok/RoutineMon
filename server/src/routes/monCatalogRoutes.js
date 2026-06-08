const express = require('express');
const router = express.Router();
const { getMonCatalog } = require('../controllers/monCatalogController');

/**
 * @ROUTE  GET /api/mon-catalog
 * @DESC   전체 Mon 도감 조회 API
 */
router.get('/', getMonCatalog);

module.exports = router;