const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const {
  getMyCards,
  drawCard,
  exchangeVip,
} = require("../controllers/card.controller");

const router = express.Router();

router.use(protect);

router.get("/my-cards", protect, getMyCards);
router.get("/inventory", protect, getMyCards);
router.post("/draw", protect, drawCard);
router.post("/exchange-vip", protect, exchangeVip);

module.exports = router;
