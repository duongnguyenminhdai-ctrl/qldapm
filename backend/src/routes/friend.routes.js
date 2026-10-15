const express = require("express");
const {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendsList,
} = require("../controllers/friend.controller");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/request", sendFriendRequest);
router.get("/requests", getFriendRequests);
router.post("/accept", acceptFriendRequest);
router.post("/reject", rejectFriendRequest);
router.get("/list", getFriendsList);

module.exports = router;
