/**
 * Re-export room.controller.js để đảm bảo tương thích ngược
 */
const roomController = require("./room.controller");

module.exports = {
  ...roomController,
  getRoomById: roomController.getRoomByCode,
};
