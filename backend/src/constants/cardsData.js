/**
 * SINGLE SOURCE OF TRUTH (Nguồn dữ liệu chuẩn hóa duy nhất) cho Hệ thống Thẻ bài Học giả (Tarot Cards)
 * Thông tin được quét và đồng bộ chính xác theo 7 ảnh Tarot trong frontend/public/image/card/ (1.png -> 7.png)
 */

const SCHOLAR_CARDS = [
  {
    id: 1,
    image: "/image/card/1.png",
    tarotNumber: "XI",
    tarotName: "Justice",
    name: "Bậc Thầy Công Lý (Justice)",
    titleEn: "Justice",
    rarity: "Cơ bản",
    quote: "“Sự thật và công lý là nền móng bất biến của mọi công trình tri thức.”",
    description: "Biểu trưng cho tinh thần công bằng, liêm chính học thuật và sự thật tuyệt đối trong hành trình tìm kiếm tri thức.",
    color: "from-amber-400 to-amber-600",
    chromaColor: "rgba(245, 158, 11, 0.8)",
  },
  {
    id: 2,
    image: "/image/card/2.png",
    tarotNumber: "XIV",
    tarotName: "Temperance",
    name: "Kỷ Luật Tiết Độ (Temperance)",
    titleEn: "Temperance",
    rarity: "Hiếm",
    quote: "“Tiết độ và kiên nhẫn dung hòa ý chí cùng nhịp sống kỷ luật.”",
    description: "Biểu trưng cho sự điều độ, kiên định và khả năng cân bằng giữa đam mê học tập cùng năng lượng nội tại.",
    color: "from-blue-400 to-indigo-600",
    chromaColor: "rgba(59, 130, 246, 0.85)",
  },
  {
    id: 3,
    image: "/image/card/3.png",
    tarotNumber: "XII",
    tarotName: "The Hanged Man",
    name: "Kẻ Chiêm Nghiệm (The Hanged Man)",
    titleEn: "The Hanged Man",
    rarity: "Hiếm",
    quote: "“Đổi góc nhìn để thấu suốt bản chất của vạn vật giữa muôn trùng sóng gió.”",
    description: "Biểu trưng cho sự chiêm nghiệm sâu sắc, dám từ bỏ định kiến cũ để khai mở tư duy phản biện đột phá.",
    color: "from-emerald-400 to-teal-600",
    chromaColor: "rgba(16, 185, 129, 0.85)",
  },
  {
    id: 4,
    image: "/image/card/4.png",
    tarotNumber: "XIX",
    tarotName: "The Sun",
    name: "Thái Dương Rực Rỡ (The Sun)",
    titleEn: "The Sun",
    rarity: "Sử thi",
    quote: "“Ánh sáng trí tuệ xua tan bóng tối của sự u muội và nghi ngờ.”",
    description: "Biểu trưng cho năng lượng tràn đầy, sự khai sáng rực rỡ và thành quả học tập chói lọi sau muôn vàn gian khổ.",
    color: "from-amber-300 via-yellow-400 to-amber-600",
    chromaColor: "rgba(234, 179, 8, 0.85)",
  },
  {
    id: 5,
    image: "/image/card/5.png",
    tarotNumber: "III",
    tarotName: "The Empress",
    name: "Nữ Hoàng Tri Thức (The Empress)",
    titleEn: "The Empress",
    rarity: "Sử thi",
    quote: "“Tâm hồn nuôi dưỡng ý tưởng và biến tri thức thành sự màu nhiệm.”",
    description: "Biểu trưng cho sự sáng tạo trù phú, sự màu nhiệm của trí tưởng tượng và khả năng nuôi dưỡng những công trình vĩ đại.",
    color: "from-purple-400 to-pink-600",
    chromaColor: "rgba(168, 85, 247, 0.85)",
  },
  {
    id: 6,
    image: "/image/card/6.png",
    tarotNumber: "VI",
    tarotName: "The Lovers",
    name: "Nhà Giả Kim Thời Gian (The Lovers)",
    titleEn: "The Lovers",
    rarity: "Huyền thoại",
    quote: "“Sự đồng điệu giữa đam mê và thời gian kiến tạo nên kiệt tác bất hủ.”",
    description: "Biểu trưng cho sự gắn kết sâu sắc giữa học giả và tri thức, thấu hiểu giá trị của từng tích tắc để làm chủ vận mệnh.",
    color: "from-rose-400 to-amber-600",
    chromaColor: "rgba(244, 63, 94, 0.9)",
  },
  {
    id: 7,
    image: "/image/card/7.png",
    tarotNumber: "0",
    tarotName: "The Fool",
    name: "Kẻ Khờ (The Fool)",
    titleEn: "The Fool",
    rarity: "Thần thoại",
    quote: "“Khởi đầu với tâm thế một kẻ khờ để vươn tới trí tuệ vô biên và tự do tuyệt đối.”",
    description: "Biểu trưng cho tiềm năng vô hạn, dũng cảm bước vào chân trời học thuật mới với trái tim thuần khiết và niềm tin son sắt.",
    color: "from-amber-200 via-rose-300 to-amber-400",
    chromaColor: "rgba(245, 158, 11, 0.95)",
  },
];

/**
 * Bản đồ tra cứu theo Card ID (1 -> 7)
 */
const SCHOLAR_CARDS_MAP = SCHOLAR_CARDS.reduce((acc, card) => {
  acc[card.id] = card;
  return acc;
}, {});

const SCHOLAR_CARDS_META = SCHOLAR_CARDS_MAP;

function getCardById(id) {
  const numId = Number(id);
  return (
    SCHOLAR_CARDS_MAP[numId] || {
      id: numId || 1,
      image: `/image/card/${numId || 1}.png`,
      tarotNumber: "I",
      tarotName: "Scholar",
      name: `Thẻ Bài Học Giả #${numId || 1}`,
      titleEn: "Scholar Card",
      rarity: "Cơ bản",
      quote: "Hành trình vạn dặm khởi đầu từ một bước chân.",
      description: "Lá bài học giả độc bản trong học viện.",
      color: "from-amber-400 to-amber-600",
      chromaColor: "rgba(245, 158, 11, 0.8)",
    }
  );
}

module.exports = {
  SCHOLAR_CARDS,
  SCHOLAR_CARDS_MAP,
  SCHOLAR_CARDS_META,
  getCardById,
};
