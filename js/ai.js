/**
 * OmniWallet AI Assistant Engine (V2 - Ultra Smart)
 * - Đa chế độ thông minh:
 *   1. Offline NLP Engine (Bóc tách câu tự nhiên siêu nhạy, đa giao dịch trong 1 câu, nhận diện ngày tự nhiên)
 *   2. Cố vấn Tài chính Offline (Tự phân tích ngân sách, burn-rate, cảnh báo thâm hụt và lời khuyên tiết kiệm)
 *   3. Google Gemini 1.5 Flash API (Cố vấn tài chính gia đình cao cấp khi có API Key)
 */

const AIAssistant = (() => {
  const GEMINI_KEY_STORAGE = "omniwallet_gemini_key";

  // Từ điển nhận diện danh mục ngữ nghĩa phong phú
  const CATEGORY_RULES = [
    { 
      id: "food", 
      words: [
        "phở", "bún", "cơm", "ăn", "uống", "cà phê", "cafe", "trà", "bánh", "pizza", 
        "lẩu", "nhậu", "tiệc", "ăn sáng", "ăn trưa", "ăn tối", "trà sữa", "highland", 
        "starbucks", "phúc long", "gà rán", "kfc", "bún chả", "cơm tấm", "bánh mì", 
        "ăn vặt", "buffet", "trà đá", "kem", "chè", "sushi", "nước ngọt", "lotteria", "toco"
      ] 
    },
    { 
      id: "market", 
      words: [
        "chợ", "siêu thị", "vinmart", "winmart", "coop", "thịt", "rau", "cá", "trứng", 
        "gia vị", "dầu ăn", "thực phẩm", "đi chợ", "bách hóa xanh", "big c", "go!", 
        "hải sản", "gạo", "trái cây", "hoa quả", "tạp hóa"
      ] 
    },
    { 
      id: "education", 
      words: [
        "học", "học phí", "trường", "sách", "vở", "tiếng anh", "gia sư", "bơi", "đàn", 
        "vẽ", "bút", "khóa học", "toeic", "ielts", "kumon", "vus", "apollo", "đồng phục", 
        "tiền học", "bán trú", "dụng cụ học", "lớp học"
      ] 
    },
    { 
      id: "baby", 
      words: [
        "sữa", "bỉm", "tã", "nan", "meiji", "quần áo bé", "đồ chơi", "tiêm chủng", 
        "khám nhi", "mầm non", "bobby", "moony", "huggies", "aptamil", "vnvc", 
        "bình sữa", "ăn dặm", "xe đẩy", "sữa bột", "sữa tươi cho con", "bỉm tã"
      ] 
    },
    { 
      id: "transport", 
      words: [
        "xăng", "đổ xăng", "xe", "rửa xe", "bảo dưỡng", "grab", "taxi", "gửi xe", 
        "vé xe", "thay nhớt", "be", "xanh sm", "vntaxi", "vá lốp", "thu phí", 
        "bot", "vé tàu", "vé máy bay", "vietjet", "vietnam airlines", "phí cầu đường"
      ] 
    },
    { 
      id: "bills", 
      words: [
        "điện", "nước", "internet", "wifi", "truyền hình", "chung cư", "phí dịch vụ", 
        "thuê nhà", "hóa đơn", "tiền nhà", "fpt", "viettel", "vnpt", "tiền mạng", 
        "tiền rác", "tiền điện", "bảo hiểm", "evn", "tiền nước"
      ] 
    },
    { 
      id: "shopping", 
      words: [
        "áo", "quần", "váy", "giày", "dép", "shopee", "tiki", "lazada", "mỹ phẩm", 
        "son", "mua sắm", "uniqlo", "zara", "dưỡng da", "kem chống nắng", "nước hoa", 
        "túi xách", "đồng hồ", "cắt tóc", "nail", "spa", "mua đồ"
      ] 
    },
    { 
      id: "health", 
      words: [
        "thuốc", "bệnh viện", "bác sĩ", "khám", "nha khoa", "răng", "vitamin", 
        "khám bệnh", "long châu", "an khang", "pharmacity", "panadol", "kháng sinh", 
        "nhỏ mắt", "khám mắt", "tai mũi họng", "nội soi", "xét nghiệm"
      ] 
    },
    { 
      id: "entertainment", 
      words: [
        "phim", "cinema", "du lịch", "vé", "karaoke", "game", "netflix", "spotify", 
        "chơi", "cắm trại", "resort", "khách sạn", "hồ bơi", "steam", "xem phim", "vé xem phim"
      ] 
    },
    { 
      id: "salary", 
      words: [
        "lương", "thưởng", "thu", "nhận tiền", "khách trả", "hoa hồng", "thu nhập", 
        "chuyển khoản nhận", "tiền về", "lãi", "cổ tức", "tiền lương"
      ] 
    }
  ];

  // Bóc tách thời gian tự nhiên (Hôm qua, sáng nay, tối qua, tuần trước...)
  function parseNaturalDate(text) {
    const now = new Date();
    const lower = text.toLowerCase();

    // 1. Hôm qua
    if (lower.includes("hôm qua") || lower.includes("hom qua")) {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }
    // 2. Hôm kia
    if (lower.includes("hôm kia") || lower.includes("hom kia")) {
      const d = new Date(now);
      d.setDate(d.getDate() - 2);
      return d.toISOString();
    }
    // 3. Tuần trước
    if (lower.includes("tuần trước") || lower.includes("tuan truoc")) {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    // 4. Tối qua
    if (lower.includes("tối qua") || lower.includes("toi qua")) {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      d.setHours(20, 0, 0);
      return d.toISOString();
    }
    // 5. Sáng nay
    if (lower.includes("sáng nay") || lower.includes("sang nay")) {
      const d = new Date(now);
      d.setHours(8, 30, 0);
      return d.toISOString();
    }
    // 6. Trưa nay
    if (lower.includes("trưa nay") || lower.includes("trua nay")) {
      const d = new Date(now);
      d.setHours(12, 15, 0);
      return d.toISOString();
    }
    // 7. Chiều nay
    if (lower.includes("chiều nay") || lower.includes("chieu nay")) {
      const d = new Date(now);
      d.setHours(17, 30, 0);
      return d.toISOString();
    }

    return now.toISOString();
  }

  // Phân tích số tiền bằng tiếng Việt toàn diện (vd: 2m5, 1tr5, 50k, 2 củ rưỡi, 2 lít, 50000...)
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

  // Bóc tách 1 câu lệnh đơn lẻ
  function parseSingleNaturalText(segmentText, fullPrompt) {
    const text = segmentText.toLowerCase().trim();
    const parsedAmt = parseAmount(text);

    if (!parsedAmt) {
      return null;
    }

    const amount = parsedAmt.val;

    // Nhận diện người chi (Chồng hay Vợ / Tên tùy biến)
    const myRole = Store.state.settings.activeAuthor || "husband";
    let author = myRole;
    const husbandName = (Store.getMemberName("husband") || "Chồng").toLowerCase();
    const wifeName = (Store.getMemberName("wife") || "Vợ").toLowerCase();

    if (text.includes("vợ") || text.includes("mẹ nó") || text.includes("vợ chi") || text.includes("vợ mua") || (wifeName !== "vợ" && text.includes(wifeName))) {
      author = "wife";
    } else if (text.includes("chồng") || text.includes("bố nó") || text.includes("chồng chi") || text.includes("anh mua") || (husbandName !== "chồng" && text.includes(husbandName))) {
      author = "husband";
    }

    // Nhận diện con cái (Tự động quét danh sách bé trong Store)
    let beneficiary = "none";
    const allChildren = Store.getChildren();
    for (const child of allChildren) {
      const cName = (child.name || "").toLowerCase().trim();
      const cId = (child.id || "").toLowerCase().trim();
      const shortName = cName.replace(/^(bé|con)\s+/i, "").trim();

      const isMatch = 
        (shortName && (
          text.includes("cho " + shortName) ||
          text.includes("của " + shortName) ||
          text.includes("bé " + shortName) ||
          text.includes("với " + shortName) ||
          text.includes("cùng " + shortName) ||
          text.includes("cho con " + shortName) ||
          text.includes(shortName)
        )) ||
        text.includes("cho " + cName) ||
        text.includes("của " + cName) ||
        text.includes("bé " + cName) ||
        text.includes("với " + cName) ||
        text.includes("cùng " + cName) ||
        text.includes(cName) ||
        (cId && (text.includes("cho " + cId) || text.includes("của " + cId) || text.includes("với " + cId) || text.includes(cId)));

      if (isMatch) {
        beneficiary = child.id;
        break;
      }
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
      const childObj = Store.getChildren().find(c => c.id === beneficiary || c.name === beneficiary);
      if (childObj && childObj.note && (childObj.note.toLowerCase().includes("học") || childObj.note.toLowerCase().includes("trường"))) {
        category = "education";
      } else {
        category = "baby";
      }
    }

    // Nhận diện ngày giờ giao dịch tự nhiên
    const date = parseNaturalDate(fullPrompt || segmentText);

    // Làm sạch ghi chú
    let note = segmentText.replace(new RegExp(parsedAmt.raw, "i"), "").trim();
    note = note.replace(/\b(hết|mất|khoảng|tầm|vừa|ví gia đình|ví cá nhân|tiền|hôm qua|hôm kia|tối qua|sáng nay|trưa nay|chiều nay)\b/gi, "").trim();
    note = note.replace(/\s+/g, " ");
    if (!note) note = Store.CATEGORIES.find(c => c.id === category)?.name || "Chi tiêu";
    note = note.charAt(0).toUpperCase() + note.slice(1);

    return {
      isCommand: true,
      data: {
        type,
        amount,
        category,
        note,
        wallet,
        author,
        beneficiary,
        date
      }
    };
  }

  // Phân tích câu nói bằng Offline Engine (Hỗ trợ đa giao dịch trong 1 câu)
  function parseNaturalTextOffline(promptText) {
    const cleanPrompt = promptText.trim();

    // 1. Kiểm tra xem có phải câu ghép nhiều giao dịch không (ngăn cách bởi "và", "với", "rồi", "sau đó", ",")
    const segments = cleanPrompt.split(/\s*(?:và|với|rồi|sau đó|\+|,)\s*/i);
    const validCommands = [];

    if (segments.length > 1) {
      for (const seg of segments) {
        const sub = parseSingleNaturalText(seg, cleanPrompt);
        if (sub && sub.isCommand && sub.data) {
          validCommands.push(sub.data);
        }
      }
    }

    if (validCommands.length > 1) {
      return {
        isCommand: true,
        isMultiple: true,
        dataList: validCommands
      };
    }

    // 2. Câu lệnh đơn lẻ
    const single = parseSingleNaturalText(cleanPrompt, cleanPrompt);
    if (single) {
      return single;
    }

    // 3. Câu hỏi truy vấn tài chính
    return { isCommand: false, query: promptText };
  }

  // Trả lời câu hỏi tài chính và tư vấn thông minh (Offline Financial Advisor)
  function answerQueryOffline(query) {
    const q = query.toLowerCase();
    const summary = Store.getFinancialSummary();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

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
      const todayTxs = Store.getFilteredTransactions().filter(t => t.date && t.date.startsWith(todayStr) && t.type === "expense");
      const todayTotal = todayTxs.reduce((sum, t) => sum + t.amount, 0);

      if (todayTxs.length === 0) {
        return "✨ Hôm nay bạn chưa có khoản chi tiêu nào ghi nhận!";
      }

      let res = `📅 Hôm nay đã chi tổng cộng **${Store.formatMoney(todayTotal)}** (${todayTxs.length} giao dịch):\n`;
      todayTxs.forEach(t => {
        const authorName = t.author === "wife" ? "👩 Vợ" : "👨 Chồng";
        const walletName = t.wallet === "family" ? "Gia Đình" : "Cá Nhân";
        res += `• **${t.note || t.category}**: ${Store.formatMoney(t.amount)} (${authorName} • ${walletName})\n`;
      });
      return res;
    }

    // 2. Hỏi hôm qua
    if (q.includes("hôm qua") || q.includes("hom qua")) {
      const yestTxs = Store.getFilteredTransactions().filter(t => t.date && t.date.startsWith(yesterdayStr) && t.type === "expense");
      const yestTotal = yestTxs.reduce((sum, t) => sum + t.amount, 0);

      if (yestTxs.length === 0) {
        return "✨ Hôm qua bạn không có khoản chi tiêu nào!";
      }

      let res = `📅 Hôm qua đã chi tổng cộng **${Store.formatMoney(yestTotal)}** (${yestTxs.length} giao dịch):\n`;
      yestTxs.forEach(t => {
        res += `• **${t.note || t.category}**: ${Store.formatMoney(t.amount)}\n`;
      });
      return res;
    }

    // 3. Hỏi con cái (Tự động quét các bé trong gia đình)
    const childrenList = Store.getChildren();
    for (const child of childrenList) {
      const cName = (child.name || "").toLowerCase();
      const cId = (child.id || "").toLowerCase();
      if (q.includes(cName) || q.includes(cId) || (cName.includes("bo") && q.includes("bo")) || (cName.includes("bông") && (q.includes("bông") || q.includes("bong")))) {
        const amt = (summary.childrenMap && summary.childrenMap[child.id]) || 0;
        return `${child.avatar || "👶"} Chi phí cho **${child.name}** tháng này: **${Store.formatMoney(amt)}** ${child.note ? `(Ghi chú: ${child.note})` : ""}.`;
      }
    }
    if (q.includes("con cái") || q.includes("các con") || q.includes("mấy đứa")) {
      if (childrenList.length === 0) return "Gia đình chưa thêm thông tin bé nào!";
      let res = `👶 **Chi phí cho các con tháng này:**\n`;
      childrenList.forEach(child => {
        const amt = (summary.childrenMap && summary.childrenMap[child.id]) || 0;
        res += `• ${child.avatar || "👶"} **${child.name}**: ${Store.formatMoney(amt)}\n`;
      });
      return res;
    }

    // 4. Hỏi so sánh Chồng vs Vợ / Hai Trụ Cột (trong Ví Gia Đình)
    const hTitle = Store.getMemberName("husband");
    const wTitle = Store.getMemberName("wife");
    if (q.includes("chồng") || q.includes("vợ") || q.includes(hTitle.toLowerCase()) || q.includes(wTitle.toLowerCase()) || q.includes("ai chi nhiều")) {
      if (summary.totalFamily === 0) {
        return `👨‍👩‍👧 Cả hai (${hTitle} & ${wTitle}) tháng này chưa có khoản chi chung nào trong Ví Gia Đình!`;
      }
      return `⚖️ **Đóng góp Ví Gia Đình tháng này:**\n• 👨 ${hTitle}: **${Store.formatMoney(summary.husbandTotal)}** (${summary.husbandPercent}%)\n• 👩 ${wTitle}: **${Store.formatMoney(summary.wifeTotal)}** (${summary.wifePercent}%)\n\n${summary.husbandPercent > summary.wifePercent ? `👉 Tháng này **${hTitle}** đang đóng góp nhiều hơn.` : `👉 Tháng này **${wTitle}** đang đóng góp nhiều hơn.`}`;
    }

    // 5. Hỏi danh mục tốn tiền nhất
    if (q.includes("mục nào") || q.includes("danh mục") || q.includes("tốn tiền") || q.includes("tiêu nhiều nhất")) {
      const breakdown = Store.getCategoryBreakdown();
      if (breakdown.data.length === 0) {
        return "Bạn chưa có khoản chi nào để phân loại danh mục!";
      }
      const topCat = breakdown.labels[0];
      const topAmount = breakdown.data[0];
      const topPercent = Math.round((topAmount / summary.totalExpense) * 100);

      return `📊 Danh mục tốn tiền nhất hiện tại là **${topCat}** với **${Store.formatMoney(topAmount)}** (chiếm **${topPercent}%** tổng chi tiêu).`;
    }

    // 6. Cố vấn Tiết Kiệm & Đánh giá Tài chính (Smart Financial Advice)
    if (q.includes("lời khuyên") || q.includes("tiết kiệm") || q.includes("tư vấn") || q.includes("đánh giá")) {
      const budget = summary.budget;
      const expense = summary.totalExpense;
      const percent = summary.actualPercent;

      let advice = `💡 **Phân tích Cố vấn Tài chính OmniWallet:**\n`;
      advice += `• Bạn đã chi: **${Store.formatMoney(expense)}** / ${Store.formatMoney(budget)} (${percent}% ngân sách tháng).\n`;

      if (percent > 100) {
        advice += `🚨 **Cảnh báo:** Bạn đã vượt ngân sách **${percent - 100}%**! Cần tạm dừng các khoản chi mua sắm, giải trí và ăn ngoài ngay lập tức.\n`;
      } else if (percent > 75) {
        advice += `⚠️ **Lưu ý:** Ngân sách đã chạm mức **${percent}%**. Hãy tập trung chi cho nhu cầu thiết yếu (đi chợ, con cái, hóa đơn).\n`;
      } else {
        advice += `✅ **Tình hình rất tốt:** Bạn đang kiểm soát chi tiêu rất kỷ luật dưới định mức ngân sách.\n`;
      }

      const breakdown = Store.getCategoryBreakdown();
      if (breakdown.labels.length > 0) {
        advice += `\n🎯 **Gợi ý tối ưu:** Cắt giảm bớt ở mục **${breakdown.labels[0]}** để dành thêm ít nhất 10 - 20% thu nhập làm quỹ dự phòng khẩn cấp!`;
      }
      return advice;
    }

    // 7. Dự báo ngân sách & tốc độ tiêu tiền (Burn Rate)
    if (q.includes("dự báo") || q.includes("ngân sách") || q.includes("thâm hụt") || q.includes("cháy túi")) {
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dailyBurn = summary.totalExpense / Math.max(dayOfMonth, 1);
      const projectedExpense = dailyBurn * daysInMonth;

      let report = `📈 **Dự báo Chi tiêu Hết Tháng:**\n`;
      report += `• Tốc độ chi trung bình: **${Store.formatMoney(dailyBurn)} / ngày**.\n`;
      report += `• Dự kiến cả tháng sẽ tiêu: **${Store.formatMoney(projectedExpense)}** (Ngân sách: ${Store.formatMoney(summary.budget)}).\n`;

      if (projectedExpense > summary.budget) {
        report += `🔴 **Nguy cơ:** Với đà này, bạn sẽ vượt ngân sách khoảng **${Store.formatMoney(projectedExpense - summary.budget)}** vào cuối tháng!`;
      } else {
        report += `🟢 **Khả quan:** Dự kiến bạn sẽ dư **${Store.formatMoney(summary.budget - projectedExpense)}** để bỏ ống heo tiết kiệm!`;
      }
      return report;
    }

    // 8. Hỏi tổng chi / số dư / tiết kiệm được bao nhiêu
    if (q.includes("tổng") || q.includes("số dư") || q.includes("còn bao nhiêu") || q.includes("tiết kiệm")) {
      return `💰 **Tình hình tài chính tháng này:**\n• Tổng Thu: **+${Store.formatMoney(summary.totalIncome)}**\n• Tổng Chi: **-${Store.formatMoney(summary.totalExpense)}**\n• Số dư tích lũy: **${Store.formatMoney(summary.netBalance)}**`;
    }

    return "🤖 Tôi hiểu câu hỏi của bạn! Bạn có thể hỏi tôi:\n• *'Hôm nay tiêu bao nhiêu?'*\n• *'Mục nào tốn tiền nhất?'*\n• *'Dự báo ngân sách tháng này'* hoặc *'Cho tôi lời khuyên tiết kiệm'*";
  }

  // Gọi Gemini API (Google AI) khi có API Key
  async function callGemini(promptText) {
    const key = (typeof localStorage !== "undefined") ? localStorage.getItem(GEMINI_KEY_STORAGE) : null;
    if (!key) return null;

    try {
      const summary = Store.getFinancialSummary();
      const recentTxs = Store.getFilteredTransactions().slice(0, 20);
      const catBreakdown = Store.getCategoryBreakdown();

      const systemPrompt = `Bạn là Trợ lý Cố Vấn Tài Chính Gia Đình & Cá Nhân OmniWallet thông minh, am hiểu văn hóa và tài chính gia đình Việt Nam.
Nguyên tắc:
1. Trả lời bằng tiếng Việt tự nhiên, ấm áp, ngắn gọn, súc tích, mang tính xây dựng cho hạnh phúc gia đình.
2. Bảo mật tuyệt đối: Không bao giờ tiết lộ ví cá nhân của vợ cho chồng hoặc ngược lại.
3. Dữ liệu tài chính thực tế hiện tại của gia đình:
- Tổng thu nhập tháng: ${summary.totalIncome.toLocaleString("vi-VN")} ₫
- Tổng chi tiêu tháng: ${summary.totalExpense.toLocaleString("vi-VN")} ₫
- Số dư ròng: ${summary.netBalance.toLocaleString("vi-VN")} ₫
- Ngân sách tháng: ${summary.budget.toLocaleString("vi-VN")} ₫ (đã dùng ${summary.actualPercent}%)
- Chi cho Bé Bo: ${summary.childBo.toLocaleString("vi-VN")} ₫
- Chi cho Bé Bông: ${summary.childBong.toLocaleString("vi-VN")} ₫
- Đóng góp vào gia đình: Chồng ${summary.husbandTotal.toLocaleString("vi-VN")} ₫ (${summary.husbandPercent}%), Vợ ${summary.wifeTotal.toLocaleString("vi-VN")} ₫ (${summary.wifePercent}%)
- Top danh mục chi nhiều nhất: ${catBreakdown.labels.slice(0, 5).join(", ")}
- Các giao dịch gần đây: ${JSON.stringify(recentTxs.map(t => ({ note: t.note, amount: t.amount, cat: t.category, date: t.date, wallet: t.wallet })))}

Dựa vào các số liệu trên, hãy phân tích, nhận xét và đưa ra câu trả lời sắc sảo, thiết thực nhất cho câu hỏi của người dùng.`;

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
    parseNaturalDate,
    parseNaturalTextOffline,
    answerQueryOffline,
    callGemini
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIAssistant;
}
