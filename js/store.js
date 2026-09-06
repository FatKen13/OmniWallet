/**
 * OmniWallet Data Store
 * - BẢO MẬT & CÁ NHÂN HÓA NGIÊM NGẶT:
 *   1. Ví Cá Nhân: Chồng KHÔNG xem được ví cá nhân của Vợ, Vợ KHÔNG xem được ví cá nhân của Chồng.
 *   2. Ví Gia Đình: Cả 2 vợ chồng đều xem được toàn bộ các khoản chi chung (ai tạo thì người kia cũng thấy).
 *   3. Tổng Hợp: Trên máy ai thì bằng = [Cá nhân của chính người đó] + [Chi tiêu Gia Đình chung].
 */

const Store = (() => {
  const STORAGE_KEY = "omniwallet_data_v2";
  const SETTINGS_KEY = "omniwallet_settings_v2";

  // Danh mục mặc định
  const CATEGORIES = [
    { id: "food", name: "Ăn uống", icon: "fa-utensils", color: "#f59e0b", emoji: "🍜" },
    { id: "market", name: "Đi chợ / ST", icon: "fa-basket-shopping", color: "#10b981", emoji: "🛒" },
    { id: "education", name: "Học tập", icon: "fa-graduation-cap", color: "#6366f1", emoji: "🎓" },
    { id: "baby", name: "Mẹ & Bé", icon: "fa-baby", color: "#ec4899", emoji: "🍼" },
    { id: "transport", name: "Di chuyển", icon: "fa-motorcycle", color: "#3b82f6", emoji: "🚗" },
    { id: "bills", name: "Hóa đơn", icon: "fa-file-invoice-dollar", color: "#ef4444", emoji: "🧾" },
    { id: "shopping", name: "Mua sắm", icon: "fa-bag-shopping", color: "#8b5cf6", emoji: "🛍️" },
    { id: "health", name: "Y tế / Thuốc", icon: "fa-stethoscope", color: "#14b8a6", emoji: "💊" },
    { id: "entertainment", name: "Giải trí", icon: "fa-gamepad", color: "#f97316", emoji: "🎮" },
    { id: "salary", name: "Thu nhập", icon: "fa-money-bill-wave", color: "#10b981", emoji: "💰" },
    { id: "other", name: "Khác", icon: "fa-circle-dot", color: "#64748b", emoji: "✨" }
  ];

  let state = {
    transactions: [],
    settings: {
      activeAuthor: "husband", // 'husband' (Chồng) | 'wife' (Vợ) cố định cho thiết bị này
      activeWallet: "personal", // 'personal' | 'family' | 'all'
      authorFilter: "all",
      childFilter: "all",
      privacyMode: false,
      monthlyBudget: 15000000,
      vaultId: null
    }
  };

  function init() {
    try {
      const rawSettings = (typeof localStorage !== "undefined") ? localStorage.getItem(SETTINGS_KEY) : null;
      if (rawSettings) {
        state.settings = { ...state.settings, ...JSON.parse(rawSettings) };
      }

      // Kiểm tra tham số URL nếu mở từ link mời Zalo: vd ...#vault=xyz&role=wife
      const hashParams = (typeof window !== "undefined" && window.location) ? new URLSearchParams(window.location.hash.substring(1)) : new URLSearchParams();
      const sharedVault = hashParams.get("vault");
      const roleParam = hashParams.get("role");

      if (sharedVault) {
        state.settings.vaultId = sharedVault;
      }
      if (roleParam === "wife" || roleParam === "husband") {
        state.settings.activeAuthor = roleParam;
      }
      if (!state.settings.vaultId) {
        state.settings.vaultId = "vault_" + Math.random().toString(36).substring(2, 9);
      }
      saveSettings();

      const rawData = (typeof localStorage !== "undefined") ? localStorage.getItem(STORAGE_KEY) : null;
      if (rawData) {
        state.transactions = JSON.parse(rawData);
      } else {
        state.transactions = getInitialSeedData(state.settings.activeAuthor);
        save();
      }
    } catch (e) {
      console.warn("Store init error:", e);
    }
  }

  // Dữ liệu ban đầu mẫu (chỉ nạp dữ liệu phù hợp với vai trò của máy này)
  function getInitialSeedData(myRole) {
    const today = new Date().toISOString().split("T")[0];
    const isHusband = myRole === "husband";

    return [
      // Khoản cá nhân của chính chủ máy
      {
        id: "tx_init_1",
        type: "expense",
        amount: isHusband ? 45000 : 65000,
        category: "food",
        note: isHusband ? "Cà phê sáng với đồng nghiệp" : "Trà sữa cùng bạn bè",
        wallet: "personal",
        author: myRole,
        beneficiary: "none",
        date: today + "T08:30:00"
      },
      // Các khoản chung của gia đình (cả 2 vợ chồng đều thấy)
      {
        id: "tx_init_2",
        type: "expense",
        amount: 2500000,
        category: "education",
        note: "Đóng học phí tiếng Anh ILA cho Bo",
        wallet: "family",
        author: "husband",
        beneficiary: "Bo",
        date: today + "T09:45:00"
      },
      {
        id: "tx_init_3",
        type: "expense",
        amount: 420000,
        category: "baby",
        note: "Mua 1 hộp sữa Nan cho Bông",
        wallet: "family",
        author: "wife",
        beneficiary: "Bông",
        date: today + "T10:15:00"
      },
      {
        id: "tx_init_4",
        type: "expense",
        amount: 320000,
        category: "market",
        note: "Đi siêu thị mua thức ăn cả tuần",
        wallet: "family",
        author: "wife",
        beneficiary: "none",
        date: today + "T11:20:00"
      },
      {
        id: "tx_init_5",
        type: "income",
        amount: 15000000,
        category: "salary",
        note: "Đóng góp lương vào quỹ gia đình",
        wallet: "family",
        author: myRole,
        beneficiary: "none",
        date: today + "T07:00:00"
      }
    ];
  }

  function save() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
      }
    } catch (e) {
      console.warn("Cannot save transactions:", e);
    }
  }

  function saveSettings() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
      }
    } catch (e) {
      console.warn("Cannot save settings:", e);
    }
  }

  // Thêm giao dịch mới
  function addTransaction(tx) {
    const myRole = state.settings.activeAuthor;
    const targetWallet = tx.wallet || "personal";

    // Nếu là ví cá nhân, người chi BẮT BUỘC là chính chủ máy (không thể tạo ví cá nhân hộ người khác)
    const author = (targetWallet === "personal") ? myRole : (tx.author || myRole);

    const newTx = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      type: tx.type || "expense",
      amount: Math.abs(parseFloat(tx.amount) || 0),
      category: tx.category || "other",
      note: tx.note ? tx.note.trim() : "",
      wallet: targetWallet,
      author: author,
      beneficiary: (targetWallet === "personal") ? "none" : (tx.beneficiary || "none"),
      date: tx.date || new Date().toISOString()
    };

    state.transactions.unshift(newTx);
    save();

    // CHỈ ĐỒNG BỘ LÊN CLOUD NẾU LÀ VÍ GIA ĐÌNH!
    // Ví cá nhân giữ lại cục bộ trên máy, KHÔNG BAO GIỜ đẩy lên kênh chung!
    if (targetWallet === "family" && window.SupabaseSync && typeof window.SupabaseSync.pushTransaction === "function") {
      window.SupabaseSync.pushTransaction(newTx);
    }

    return newTx;
  }

  // Xóa giao dịch
  function deleteTransaction(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    // Chỉ cho phép xóa nếu là khoản của mình hoặc là khoản trong gia đình
    state.transactions = state.transactions.filter(t => t.id !== id);
    save();

    if (tx.wallet === "family" && window.SupabaseSync && typeof window.SupabaseSync.deleteRemoteTransaction === "function") {
      window.SupabaseSync.deleteRemoteTransaction(id);
    }
  }

  /**
   * BỘ LỌC CỐT LÕI (BẢO MẬT & CÁ NHÂN HÓA):
   * - Nếu tx là 'personal': CHỈ CHẤP NHẬN NẾU tx.author === myRole.
   *   Khoản cá nhân của người kia TUYỆT ĐỐI BỊ LOẠI BỎ (không bao giờ hiển thị).
   * - Nếu tx là 'family': CẢ 2 VỢ CHỒNG ĐỀU ĐƯỢC XEM.
   */
  function getFilteredTransactions() {
    const { activeAuthor, activeWallet, childFilter } = state.settings;

    return state.transactions.filter(tx => {
      // 1. Kiểm tra an toàn cá nhân: Khoản cá nhân của người kia bị loại bỏ ngay từ đầu
      if (tx.wallet === "personal" && tx.author !== activeAuthor) {
        return false;
      }

      // 2. Lọc theo tab ví đang chọn:
      if (activeWallet === "personal") {
        if (tx.wallet !== "personal" || tx.author !== activeAuthor) return false;
      } else if (activeWallet === "family") {
        if (tx.wallet !== "family") return false;
      } else if (activeWallet === "all") {
        // Tổng hợp = Khoản cá nhân của chính mình + Toàn bộ khoản chung gia đình
        const isMyPersonal = (tx.wallet === "personal" && tx.author === activeAuthor);
        const isFamily = (tx.wallet === "family");
        if (!isMyPersonal && !isFamily) return false;
      }

      // 3. Lọc theo con cái (nếu đang ở ví gia đình hoặc tổng hợp)
      if (childFilter && childFilter !== "all" && tx.beneficiary !== childFilter) {
        return false;
      }

      // 4. Lọc theo người chi (filter chip Chồng / Vợ)
      const { authorFilter } = state.settings;
      if (authorFilter && authorFilter !== "all" && tx.author !== authorFilter) {
        return false;
      }

      return true;
    });

    // Sắp xếp thời gian mới nhất lên đầu (Chính xác theo thời gian giao dịch)
    return filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  // Tính toán tóm tắt tài chính hiển thị
  function getFinancialSummary() {
    const txs = getFilteredTransactions();

    let totalIncome = 0;
    let totalExpense = 0;

    txs.forEach(t => {
      if (t.type === "income") totalIncome += t.amount;
      else totalExpense += t.amount;
    });

    const netBalance = totalIncome - totalExpense;

    // Thống kê riêng cho Ví Gia Đình (cả 2 cùng xem được đóng góp của nhau)
    let childBo = 0;
    let childBong = 0;
    let husbandFamilyTotal = 0;
    let wifeFamilyTotal = 0;

    state.transactions.forEach(t => {
      if (t.wallet === "family" && t.type === "expense") {
        if (t.beneficiary === "Bo") childBo += t.amount;
        if (t.beneficiary === "Bông") childBong += t.amount;

        if (t.author === "husband") husbandFamilyTotal += t.amount;
        else if (t.author === "wife") wifeFamilyTotal += t.amount;
      }
    });

    const totalFamily = husbandFamilyTotal + wifeFamilyTotal;
    const husbandPercent = totalFamily > 0 ? Math.round((husbandFamilyTotal / totalFamily) * 100) : 0;
    const wifePercent = totalFamily > 0 ? (100 - husbandPercent) : 0;

    const budget = state.settings.monthlyBudget || 15000000;
    const budgetPercent = Math.min(100, Math.round((totalExpense / budget) * 100));
    const actualPercent = budget > 0 ? Math.round((totalExpense / budget) * 100) : 0;

    return {
      netBalance,
      totalIncome,
      totalExpense,
      budget,
      budgetPercent,
      actualPercent,
      childBo,
      childBong,
      husbandTotal: husbandFamilyTotal,
      wifeTotal: wifeFamilyTotal,
      husbandPercent,
      wifePercent,
      totalFamily
    };
  }

  // Breakdown cho Chart.js
  function getCategoryBreakdown() {
    const txs = getFilteredTransactions().filter(t => t.type === "expense");
    const map = {};

    txs.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });

    const labels = [];
    const data = [];
    const colors = [];

    CATEGORIES.forEach(c => {
      if (map[c.id] && map[c.id] > 0) {
        labels.push(c.emoji + " " + c.name);
        data.push(map[c.id]);
        colors.push(c.color);
      }
    });

    return { labels, data, colors };
  }

  function formatMoney(amount) {
    if (isNaN(amount) || amount === null) return "0 ₫";
    return Math.round(amount).toLocaleString("vi-VN") + " ₫";
  }

  return {
    init,
    state,
    CATEGORIES,
    addTransaction,
    deleteTransaction,
    getFilteredTransactions,
    getFinancialSummary,
    getCategoryBreakdown,
    formatMoney,
    saveSettings
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Store;
}
