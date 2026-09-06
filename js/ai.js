/**
 * OmniWallet AI Assistant Engine
 * - Hỗ trợ cả 2 chế độ:
 *   1. Offline NLP Engine (Bóc tách câu tự nhiên siêu nhạy, hiểu 2m5, 1tr5, củ rưỡi, lít rưỡi, xị, lốp...)
 *   2. Google Gemini API (Khi có Key: suy luận tài chính chuyên sâu, cố vấn chi tiêu)
 */

const AIAssistant = (() => {
  const GEMINI_KEY_STORAGE = "omniwallet_gemini_key";

  // Từ khóa nhận diện danh mục
  const CATEGORY_RULES = [
    { id: "food", words: ["phở", "bún", "cơm", "ăn", "uống", "cà phê", "cafe", "trà", "bánh", "pizza", "lẩu", "nhậu", "tiệc", "ăn sáng", "ăn trưa", "ăn tối"] },
    { id: "market", words: ["chợ", "siêu thị", "vinmart", "coop", "thịt", "rau", "cá", "trứng", "gia vị", "dầu ăn", "thực phẩm", "đi chợ"] },
    { id: "education", words: ["học", "học phí", "trường", "sách", "vở", "tiếng anh", "gia sư", "bơi", "đàn", "vẽ", "bút", "khóa học"] },
    { id: "baby", words: ["sữa", "bỉm", "tã", "nan", "meiji", "quần áo bé", "đồ chơi", "tiêm chủng", "khám nhi", "mầm non"] },
    { id: "transport", words: ["xăng", "đổ xăng", "xe", "rửa xe", "bảo dưỡng", "grab", "taxi", "gửi xe", "vé xe", "thay nhớt"] },
    { id: "bills", words: ["điện", "nước", "internet", "wifi", "truyền hình", "chung cư", "phí dịch vụ", "thuê nhà", "hóa đơn"] },
    { id: "shopping", words: ["áo", "quần", "váy", "giày", "dép", "shopee", "tiki", "lazada", "mỹ phẩm", "son", "mua sắm"] },
    { id: "health", words: ["thuốc", "bệnh viện", "bác sĩ", "khám", "nha khoa", "răng", "vitamin", "khám bệnh"] },
    { id: "entertainment", words: ["phim", "cinema", "du lịch", "vé", "karaoke", "game", "netflix", "spotify", "chơi"] },
    { id: "salary", words: ["lương", "thưởng", "thu", "nhận tiền", "khách trả", "hoa hồng", "thu nhập"] }
  ];

  // Phân tích số tiền bằng tiếng Việt toàn diện (vd: 2m5 = 2.5tr, 1tr5, 50k, 2 củ rưỡi, 2 lít...)
  function parseAmount(text) {
    const lower = text.toLowerCase();

    // 1. Dạng kẹp số triệu: 2m5, 1tr5, 3củ2, 2 chai 5, 2triệu5
    const compoundMillion = lower.match(/([0-9]+)\s*(m|tr|triệu|củ|chai)\s*([0-9]+)/i);
    if (compoundMillion) {
      const val = parseFloat(compoundMillion[1] + "." + compoundMillion[3]) * 1000000;
      return { val, raw: compoundMillion[0] };
    }

    // 2. Dạng 'rưỡi': 2 củ rưỡi, 1tr rưỡi, 2 triệu rưỡi, 2m rưỡi, 2 chai rưỡi
    const ruoiMillion = lower.match(/([0-9]+)\s*(m|tr|triệu|củ|chai)\s*(rưỡi|rưởi)/i);
    if (ruoiMillion) {
      const val = (parseFloat(ruoiMillion[1]) + 0.5) * 1000000;
      return { val, raw: ruoiMillion[0] };
    }

    // 3. Dạng thập phân / đơn lẻ triệu: 2.5m, 2,5tr, 2 triệu, 2 củ, 2m, 2 chai
    const trMatch = lower.match(/([0-9]+(?:[.,][0-9]+)?)\s*(m|tr|triệu|củ|chai)(?![a-z0-9])/i);
    if (trMatch) {
      const cleanNum = trMatch[1].replace(",", ".");
      const val = parseFloat(cleanNum) * 1000000;
      return { val, raw: trMatch[0] };
    }

    // 4. Dạng nghìn kẹp: 1k5, 50k5
    const compoundThousand = lower.match(/([0-9]+)\s*k\s*([0-9]+)/i);
    if (compoundThousand) {
      const val = parseFloat(compoundThousand[1] + "." + compoundThousand[2]) * 1000;
      return { val, raw: compoundThousand[0] };
    }

    // 5. Dạng nghìn thông thường: 50k, 200 nghìn, 500 ngàn
    const kMatch = lower.match(/([0-9]+(?:[.,][0-9]+)?)\s*(k|nghìn|ngàn)(?![a-z0-9])/i);
    if (kMatch) {
      const cleanNum = kMatch[1].replace(",", ".");
      const val = parseFloat(cleanNum) * 1000;
      return { val, raw: kMatch[0] };
    }

    // 6. Tiếng lóng: lít, xị, lốp
    if (lower.includes("lít rưỡi") || lower.includes("lít rưởi")) return { val: 150000, raw: "lít rưỡi" };
    if (lower.includes("nửa củ") || lower.includes("nửa triệu")) return { val: 500000, raw: "nửa củ" };
    if (lower.includes("nửa lít") || lower.includes("nửa xị")) return { val: 50000, raw: "nửa lít" };

    const litMatch = lower.match(/([0-9]+)\s*(lít|xị|lốp)/i);
    if (litMatch) {
      return { val: parseInt(litMatch[1]) * 100000, raw: litMatch[0] };
    }

    // 7. Số thuần túy (vd: 50000, 200.000)
    const numMatch = lower.match(/([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})/);
    if (numMatch) {
      const clean = numMatch[1].replace(/[.,]/g, "");
      const val = parseInt(clean);
      if (!isNaN(val) && val > 1000) return { val, raw: numMatch[0] };
    }

    return null;
  }

  // Phân tích câu nói bằng Offline Engine
  function parseNaturalTextOffline(promptText) {
    const text = promptText.toLowerCase().trim();
    const parsedAmt = parseAmount(text);

    if (!parsedAmt) {
      // Câu hỏi truy vấn
      return { isCommand: false, query: promptText };
    }

    const amount = parsedAmt.val;

    // Nhận diện người chi (Chồng hay Vợ)
    const myRole = Store.state.settings.activeAuthor || "husband";
    let author = myRole;
    if (text.includes("vợ") || text.includes("mẹ nó") || text.includes("vợ chi") || text.includes("vợ mua")) {
      author = "wife";
    } else if (text.includes("chồng") || text.includes("bố nó") || text.includes("chồng chi") || text.includes("anh mua")) {
      author = "husband";
    }

    // Nhận diện con cái
    let beneficiary = "none";
    if (text.includes("cho bo") || text.includes("của bo") || text.includes("bé bo") || text.includes("con trai")) {
      beneficiary = "Bo";
    } else if (text.includes("cho bông") || text.includes("của bông") || text.includes("bé bông") || text.includes("con gái")) {
      beneficiary = "Bông";
    }

    // Nhận diện ví (Cá nhân hay Gia đình)
    let wallet = "family";
    if (text.includes("cá nhân") || text.includes("tiêu vặt") || text.includes("riêng")) {
      if ((myRole === "husband" && text.includes("vợ")) || (myRole === "wife" && text.includes("chồng"))) {
        wallet = "family";
      } else {
        wallet = "personal";
      }
    } else if (text.includes("gia đình") || text.includes("cả nhà") || text.includes("quỹ chung")) {
      wallet = "family";
    } else {
      // Tự động: Học tập, con cái, bỉm sữa, chợ búa, điện nước -> GIA ĐÌNH. Còn lại cafe, ăn sáng -> CÁ NHÂN
      if (beneficiary !== "none" || text.includes("điện") || text.includes("nước") || text.includes("chợ") || text.includes("học") || text.includes("sữa") || text.includes("bỉm") || text.includes("siêu thị")) {
        wallet = "family";
      } else {
        wallet = "personal";
      }
    }

    // Nhận diện loại giao dịch (Thu hay Chi)
    let type = "expense";
    if (text.includes("lương") || text.includes("thưởng") || text.includes("thu được") || text.includes("nhận tiền")) {
      type = "income";
    }

    // Nhận diện danh mục
    let category = "other";
    for (const rule of CATEGORY_RULES) {
      if (rule.words.some(w => text.includes(w))) {
        category = rule.id;
        break;
      }
    }
    if (beneficiary !== "none" && category === "other") {
      category = (beneficiary === "Bo") ? "education" : "baby";
    }

    // Làm sạch ghi chú
    let note = promptText.replace(new RegExp(parsedAmt.raw, "i"), "").trim();
    note = note.replace(/\b(hết|mất|khoảng|tầm|vừa|ví gia đình|ví cá nhân|tiền)\b/gi, "").trim();
    note = note.replace(/\s+/g, " ");
    if (!note) note = Store.CATEGORIES.find(c => c.id === category)?.name || "Chi tiêu";

    return {
      isCommand: true,
      data: {
        type,
        amount,
        category,
        note,
        wallet,
        author,
        beneficiary
      }
    };
  }

  // Trả lời câu hỏi tài chính với bảo mật cá nhân hóa
  function answerQueryOffline(query) {
    const q = query.toLowerCase();
    const summary = Store.getFinancialSummary();
    const txs = Store.state.transactions;
    const todayStr = new Date().toISOString().split("T")[0];
    const myRole = Store.state.settings.activeAuthor;
    const isHusband = myRole === "husband";
    const spouseTitle = isHusband ? "Vợ" : "Chồng";

    // 0. BẢO MẬT: Nếu hỏi về ví cá nhân của người kia -> TỪ CHỐI
    if ((q.includes("cá nhân") || q.includes("riêng") || q.includes("quỹ đen")) && 
        ((isHusband && (q.includes("vợ") || q.includes("cô ấy"))) || 
         (!isHusband && (q.includes("chồng") || q.includes("anh ấy"))))) {
      return `🔒 **Bảo mật riêng tư:** Ví cá nhân của ${spouseTitle} được lưu trữ cục bộ trên máy của ${spouseTitle} để đảm bảo tính riêng tư tuyệt đối. Bạn không thể xem ví riêng của ${spouseTitle}, chỉ có thể xem các khoản đóng góp chung trong **Ví Gia Đình**!`;
    }

    // 1. Hỏi hôm nay
    if (q.includes("hôm nay") || q.includes("hnay")) {
      const todayTxs = Store.getFilteredTransactions().filter(t => t.date.startsWith(todayStr) && t.type === "expense");
      const todayTotal = todayTxs.reduce((sum, t) => sum + t.amount, 0);

      if (todayTxs.length === 0) {
        return "Hôm nay bạn chưa có khoản chi tiêu nào ghi nhận!";
      }

      let res = `Hôm nay đã chi tổng cộng **${Store.formatMoney(todayTotal)}** gồm ${todayTxs.length} khoản:\n`;
      todayTxs.forEach(t => {
        const authorName = t.author === "wife" ? "Vợ" : "Chồng";
        const walletName = t.wallet === "family" ? "Gia Đình" : "Cá Nhân";
        res += `• ${t.note || t.category}: **${Store.formatMoney(t.amount)}** (${authorName} • ${walletName})\n`;
      });
      return res;
    }

    // 2. Hỏi con cái (Bo / Bông)
    if (q.includes("bo")) {
      return `Tháng này bạn đã chi cho **Bé Bo** tổng cộng **${Store.formatMoney(summary.childBo)}** (gồm học phí, sách vở, học thêm).`;
    }
    if (q.includes("bông")) {
      return `Tháng này bạn đã chi cho **Bé Bông** tổng cộng **${Store.formatMoney(summary.childBong)}** (gồm sữa, bỉm, trường mầm non).`;
    }

    // 3. Hỏi so sánh Chồng vs Vợ (trong Ví Gia Đình)
    if (q.includes("chồng") || q.includes("vợ") || q.includes("ai chi nhiều")) {
      return `Thống kê đóng góp vào **Ví Gia Đình** tháng này:\n• 👨 Chồng chi: **${Store.formatMoney(summary.husbandTotal)}** (${summary.husbandPercent}%)\n• 👩 Vợ chi: **${Store.formatMoney(summary.wifeTotal)}** (${summary.wifePercent}%)`;
    }

    // 4. Hỏi tổng chi / số dư
    if (q.includes("tổng") || q.includes("số dư") || q.includes("còn bao nhiêu")) {
      return `Tình hình tài chính tháng này:\n• Tổng Thu: **+${Store.formatMoney(summary.totalIncome)}**\n• Tổng Chi: **-${Store.formatMoney(summary.totalExpense)}**\n• Số dư ròng: **${Store.formatMoney(summary.netBalance)}**`;
    }

    return "Tôi hiểu câu hỏi của bạn! Bạn có thể hỏi tôi về chi tiêu hôm nay, số tiền chi cho bé Bo/Bông, hoặc so sánh chi tiêu giữa 2 vợ chồng.";
  }

  // Gọi Gemini API nếu người dùng có cấu hình Key
  async function callGemini(promptText) {
    const key = (typeof localStorage !== "undefined") ? localStorage.getItem(GEMINI_KEY_STORAGE) : null;
    if (!key) return null;

    try {
      const summary = Store.getFinancialSummary();
      const recentTxs = Store.getFilteredTransactions().slice(0, 15);

      const systemPrompt = `Bạn là Trợ lý Tài Chính Cá Nhân và Gia Đình thông minh trong app OmniWallet.
Quy tắc bảo mật: Không bao giờ tiết lộ ví cá nhân của vợ cho chồng hoặc ngược lại.
Dữ liệu hiện tại:
- Tổng thu tháng: ${summary.totalIncome} VNĐ
- Tổng chi tháng: ${summary.totalExpense} VNĐ
- Chi cho Bé Bo: ${summary.childBo} VNĐ
- Chi cho Bé Bông: ${summary.childBong} VNĐ
- Chồng chi gia đình: ${summary.husbandTotal} VNĐ, Vợ chi gia đình: ${summary.wifeTotal} VNĐ
- Giao dịch gần nhất: ${JSON.stringify(recentTxs)}

Hãy trả lời ngắn gọn, tình cảm, hài hước và chuẩn xác bằng tiếng Việt.`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\nCâu hỏi của người dùng: " + promptText }] }
          ]
        })
      });

      const json = await res.json();
      return json?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) {
      console.warn("Gemini call error:", e);
      return null;
    }
  }

  return {
    parseAmount,
    parseNaturalTextOffline,
    answerQueryOffline,
    callGemini
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIAssistant;
}
