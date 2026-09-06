/**
 * OmniWallet Data Store
 * - Local-First Storage (LocalStorage + Realtime Sync Ready)
 * - Manages 3 Wallet States (Personal, Family, All)
 * - Beneficiaries per Child (Bo, Bông)
 * - Authors (Husband, Wife)
 */

const Store = (() => {
  const STORAGE_KEY = "omniwallet_data_v1";
  const SETTINGS_KEY = "omniwallet_settings_v1";

  // Danh mục mặc định sinh động với màu sắc & icon FontAwesome
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

  // Khởi tạo trạng thái mặc định
  let state = {
    transactions: [],
    settings: {
      activeAuthor: "husband", // 'husband' | 'wife'
      activeWallet: "personal", // 'personal' | 'family' | 'all'
      authorFilter: "all",
      childFilter: "all",
      privacyMode: false,
      monthlyBudget: 15000000, // 15 triệu mặc định
      vaultId: null
    }
  };

  // Tải dữ liệu từ LocalStorage
  function init() {
    try {
      const rawData = (typeof localStorage !== "undefined") ? localStorage.getItem(STORAGE_KEY) : null;
      if (rawData) {
        state.transactions = JSON.parse(rawData);
      } else {
        // Dữ liệu mẫu ban đầu để giao diện đẹp ngay lập tức
        state.transactions = getSeedData();
        save();
      }

      const rawSettings = (typeof localStorage !== "undefined") ? localStorage.getItem(SETTINGS_KEY) : null;
      if (rawSettings) {
        state.settings = { ...state.settings, ...JSON.parse(rawSettings) };
      }

      // Kiểm tra Vault ID trong URL hash nếu có (kết nối link Zalo)
      const hashParams = (typeof window !== "undefined" && window.location) ? new URLSearchParams(window.location.hash.substring(1)) : new URLSearchParams();
      const sharedVault = hashParams.get("vault");
      if (sharedVault) {
        state.settings.vaultId = sharedVault;
        state.settings.activeAuthor = "wife"; // Khách mở link Zalo thường là vợ
        saveSettings();
      } else if (!state.settings.vaultId) {
        state.settings.vaultId = "vault_" + Math.random().toString(36).substring(2, 9);
        saveSettings();
      }
    } catch (e) {
      console.warn("Store init error:", e);
    }
  }

  function getSeedData() {
    const today = new Date().toISOString().split("T")[0];
    return [
      {
        id: "tx_1",
        type: "expense",
        amount: 45000,
        category: "food",
        note: "Cà phê sáng cùng đồng nghiệp",
        wallet: "personal",
        author: "husband",
        beneficiary: "none",
        date: today + "T08:30:00"
      },
      {
        id: "tx_2",
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
        id: "tx_3",
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
        id: "tx_4",
        type: "expense",
        amount: 185000,
        category: "market",
        note: "Đi chợ mua rau thịt cho cả nhà",
        wallet: "family",
        author: "wife",
        beneficiary: "none",
        date: today + "T11:20:00"
      },
      {
        id: "tx_5",
        type: "income",
        amount: 15000000,
        category: "salary",
        note: "Lương tháng này",
        wallet: "family",
        author: "husband",
        beneficiary: "none",
        date: today + "T07:00:00"
      }
    ];
  }

  function save() {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
    } catch (e) {
      console.warn("Cannot save transactions:", e);
    }
  }

  function saveSettings() {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (e) {
      console.warn("Cannot save settings:", e);
    }
  }

  // Thêm khoản chi / thu mới
  function addTransaction(tx) {
    const newTx = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      type: tx.type || "expense",
      amount: Math.abs(parseFloat(tx.amount) || 0),
      category: tx.category || "other",
      note: tx.note ? tx.note.trim() : "",
      wallet: tx.wallet || state.settings.activeWallet || "family",
      author: tx.author || state.settings.activeAuthor || "husband",
      beneficiary: tx.beneficiary || "none",
      date: tx.date || new Date().toISOString()
    };

    state.transactions.unshift(newTx);
    save();

    // Đồng bộ Supabase nếu có
    if (window.SupabaseSync && typeof window.SupabaseSync.pushTransaction === "function") {
      window.SupabaseSync.pushTransaction(newTx);
    }

    return newTx;
  }

  // Xóa khoản chi
  function deleteTransaction(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    save();

    if (window.SupabaseSync && typeof window.SupabaseSync.deleteRemoteTransaction === "function") {
      window.SupabaseSync.deleteRemoteTransaction(id);
    }
  }

  // Lọc giao dịch theo ví, người chi, con cái
  function getFilteredTransactions() {
    const { activeWallet, authorFilter, childFilter } = state.settings;

    return state.transactions.filter(tx => {
      // Lọc theo ví
      if (activeWallet === "personal" && tx.wallet !== "personal") return false;
      if (activeWallet === "family" && tx.wallet !== "family") return false;
      // activeWallet === 'all' -> lấy hết

      // Lọc theo người chi
      if (authorFilter !== "all" && tx.author !== authorFilter) return false;

      // Lọc theo con
      if (childFilter !== "all" && tx.beneficiary !== childFilter) return false;

      return true;
    });
  }

  // Tính toán tóm tắt tài chính (Số dư, Tổng thu, Tổng chi, Ngân sách)
  function getFinancialSummary() {
    const txs = getFilteredTransactions();

    let totalIncome = 0;
    let totalExpense = 0;

    txs.forEach(t => {
      if (t.type === "income") totalIncome += t.amount;
      else totalExpense += t.amount;
    });

    const netBalance = totalIncome - totalExpense;

    // Tính chi theo con cái (trong tháng hiện tại)
    let childBo = 0;
    let childBong = 0;
    let husbandTotal = 0;
    let wifeTotal = 0;

    state.transactions.forEach(t => {
      if (t.type === "expense") {
        if (t.beneficiary === "Bo") childBo += t.amount;
        if (t.beneficiary === "Bông") childBong += t.amount;

        if (t.author === "husband") husbandTotal += t.amount;
        else if (t.author === "wife") wifeTotal += t.amount;
      }
    });

    const totalSpouseExpense = husbandTotal + wifeTotal;
    const husbandPercent = totalSpouseExpense > 0 ? Math.round((husbandTotal / totalSpouseExpense) * 100) : 50;
    const wifePercent = totalSpouseExpense > 0 ? (100 - husbandPercent) : 50;

    const budget = state.settings.monthlyBudget || 15000000;
    const budgetPercent = Math.min(100, Math.round((totalExpense / budget) * 100));

    return {
      netBalance,
      totalIncome,
      totalExpense,
      budget,
      budgetPercent,
      childBo,
      childBong,
      husbandTotal,
      wifeTotal,
      husbandPercent,
      wifePercent
    };
  }

  // Tóm tắt theo danh mục để vẽ biểu đồ
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

  // Format tiền tệ Việt Nam
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
