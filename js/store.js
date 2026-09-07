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
      activeAuthor: "husband", // 'husband' | 'wife' cố định cho thiết bị này
      activeWallet: "personal", // 'personal' | 'family' | 'all'
      authorFilter: "all",
      childFilter: "all",
      privacyMode: false,
      monthlyBudget: 15000000,
      periodMode: "month", // 'month' | 'year' | 'all'
      periodYear: new Date().getFullYear(),
      periodMonth: new Date().getMonth() + 1,
      syncPeriodTimeline: true,
      vaultId: null,
      currentFamilyId: "fam_main",
      families: [
        { id: "fam_main", name: "Gia Đình Nhỏ", vaultId: "vault_default" }
      ],
      members: {
        husband: "Chồng",
        wife: "Vợ"
      },
      children: [
        { id: "Bo", name: "Bé Bo", avatar: "👦", note: "Tiền học, đồ dùng" },
        { id: "Bông", name: "Bé Bông", avatar: "👧", note: "Mầm non, bỉm sữa" }
      ]
    }
  };

  function init() {
    try {
      const rawSettings = (typeof localStorage !== "undefined") ? localStorage.getItem(SETTINGS_KEY) : null;
      if (rawSettings) {
        state.settings = { ...state.settings, ...JSON.parse(rawSettings) };
      }

      // Đảm bảo cấu trúc các trường mới luôn tồn tại (tương thích ngược)
      if (!state.settings.periodMode) state.settings.periodMode = "month";
      if (!state.settings.periodYear) state.settings.periodYear = new Date().getFullYear();
      if (!state.settings.periodMonth) state.settings.periodMonth = new Date().getMonth() + 1;
      if (state.settings.syncPeriodTimeline === undefined) state.settings.syncPeriodTimeline = true;
      if (!state.settings.members || typeof state.settings.members !== "object") {
        state.settings.members = { husband: "Chồng", wife: "Vợ" };
      }
      if (!Array.isArray(state.settings.children) || state.settings.children.length === 0) {
        state.settings.children = [
          { id: "Bo", name: "Bé Bo", avatar: "👦", note: "Tiền học, đồ dùng" },
          { id: "Bông", name: "Bé Bông", avatar: "👧", note: "Mầm non, bỉm sữa" }
        ];
      }
      if (!Array.isArray(state.settings.families) || state.settings.families.length === 0) {
        const defaultVaultId = state.settings.vaultId || ("vault_" + Math.random().toString(36).substring(2, 9));
        state.settings.families = [
          { id: "fam_main", name: "Gia Đình Nhỏ", vaultId: defaultVaultId }
        ];
      }
      if (!state.settings.currentFamilyId) {
        state.settings.currentFamilyId = state.settings.families[0].id;
      }

      // Đảm bảo vaultId luôn khớp với gia đình hiện tại
      const curFam = state.settings.families.find(f => f.id === state.settings.currentFamilyId) || state.settings.families[0];
      state.settings.currentFamilyId = curFam.id;
      state.settings.vaultId = curFam.vaultId;

      // Kiểm tra tham số URL nếu mở từ link mời Zalo: vd ...#vault=xyz&role=wife&fam=...
      const hashParams = (typeof window !== "undefined" && window.location) ? new URLSearchParams(window.location.hash.substring(1)) : new URLSearchParams();
      const sharedVault = hashParams.get("vault");
      const roleParam = hashParams.get("role");
      const famNameParam = hashParams.get("fam");

      if (sharedVault) {
        let existingFam = state.settings.families.find(f => f.vaultId === sharedVault);
        if (!existingFam) {
          existingFam = {
            id: "fam_" + Date.now().toString(36),
            name: famNameParam ? decodeURIComponent(famNameParam) : "Gia Đình Chia Sẻ",
            vaultId: sharedVault
          };
          state.settings.families.push(existingFam);
        }
        state.settings.currentFamilyId = existingFam.id;
        state.settings.vaultId = sharedVault;
      }

      if (roleParam === "wife" || roleParam === "husband") {
        state.settings.activeAuthor = roleParam;
      }
      saveSettings();

      const rawData = (typeof localStorage !== "undefined") ? localStorage.getItem(STORAGE_KEY) : null;
      if (rawData) {
        state.transactions = JSON.parse(rawData);
      } else {
        state.transactions = getInitialSeedData(state.settings.activeAuthor);
        save();
      }

      // Tự động đồng bộ ID và giao dịch nếu tên con cái đã được đổi (VD: id là 'Bo' nhưng tên là 'Vừng')
      if (Array.isArray(state.settings.children)) {
        let changed = false;
        state.settings.children.forEach(c => {
          if (c.id === "Bo" && c.name && !c.name.toLowerCase().includes("bo")) {
            const cleanId = c.name.replace(/^(Bé|bé|con)\s+/i, "").trim().replace(/\s+/g, "_") || c.name;
            const oldId = c.id;
            c.id = cleanId;
            state.transactions.forEach(t => {
              if (t.beneficiary === oldId) t.beneficiary = cleanId;
            });
            if (state.settings.childFilter === oldId) state.settings.childFilter = cleanId;
            changed = true;
          }
          if (c.id === "Bông" && c.name && !c.name.toLowerCase().includes("bông") && !c.name.toLowerCase().includes("bong")) {
            const cleanId = c.name.replace(/^(Bé|bé|con)\s+/i, "").trim().replace(/\s+/g, "_") || c.name;
            const oldId = c.id;
            c.id = cleanId;
            state.transactions.forEach(t => {
              if (t.beneficiary === oldId) t.beneficiary = cleanId;
            });
            if (state.settings.childFilter === oldId) state.settings.childFilter = cleanId;
            changed = true;
          }
        });
        if (changed) {
          save();
          saveSettings();
        }
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
        familyId: null,
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
        familyId: "fam_main",
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
        familyId: "fam_main",
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
        familyId: "fam_main",
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
        familyId: "fam_main",
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
    const currentFamily = getCurrentFamily();

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
      familyId: (targetWallet === "family") ? (tx.familyId || (currentFamily ? currentFamily.id : "fam_main")) : null,
      date: tx.date || new Date().toISOString()
    };

    state.transactions.unshift(newTx);
    save();

    // CHỈ ĐỒNG BỘ LÊN CLOUD NẾU LÀ VÍ GIA ĐÌNH!
    // Ví cá nhân giữ lại cục bộ trên máy, KHÔNG BAO GIỜ đẩy lên kênh chung!
    if (targetWallet === "family" && typeof window !== "undefined" && window.SupabaseSync && typeof window.SupabaseSync.pushTransaction === "function") {
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

    if (tx.wallet === "family" && typeof window !== "undefined" && window.SupabaseSync && typeof window.SupabaseSync.deleteRemoteTransaction === "function") {
      window.SupabaseSync.deleteRemoteTransaction(id);
    }
  }

  /**
   * BỘ LỌC CỐT LÕI (BẢO MẬT & CÁ NHÂN HÓA):
   * - Nếu tx là 'personal': CHỈ CHẤP NHẬN NẾU tx.author === myRole.
   *   Khoản cá nhân của người kia TUYỆT ĐỐI BỊ LOẠI BỎ (không bao giờ hiển thị).
   * - Nếu tx là 'family': Chỉ hiển thị nếu thuộc gia đình hiện tại (hoặc giao dịch mặc định ban đầu).
   * - Sắp xếp theo ngày giờ mới nhất lên đầu.
   */
  /**
   * CÁC HÀM XỬ LÝ KỲ BÁO CÁO (THEO THÁNG / THEO NĂM / TẤT CẢ):
   */
  function getPeriod() {
    const mode = state.settings.periodMode || "month";
    const year = parseInt(state.settings.periodYear, 10) || new Date().getFullYear();
    const month = parseInt(state.settings.periodMonth, 10) || (new Date().getMonth() + 1);
    const ym = `${year}-${String(month).padStart(2, "0")}`;

    let label = "";
    if (mode === "month") {
      label = `Tháng ${String(month).padStart(2, "0")}/${year}`;
    } else if (mode === "year") {
      label = `Năm ${year}`;
    } else {
      label = "Toàn bộ thời gian";
    }

    return { mode, year, month, ym, label, syncTimeline: !!state.settings.syncPeriodTimeline };
  }

  function setPeriod(mode, year, month) {
    if (mode) state.settings.periodMode = mode;
    if (year !== undefined && year !== null) state.settings.periodYear = parseInt(year, 10);
    if (month !== undefined && month !== null) state.settings.periodMonth = parseInt(month, 10);
    saveSettings();
    return getPeriod();
  }

  function shiftPeriod(delta) {
    const mode = state.settings.periodMode || "month";
    let year = parseInt(state.settings.periodYear, 10) || new Date().getFullYear();
    let month = parseInt(state.settings.periodMonth, 10) || (new Date().getMonth() + 1);

    if (mode === "month") {
      month += delta;
      while (month > 12) {
        month -= 12;
        year += 1;
      }
      while (month < 1) {
        month += 12;
        year -= 1;
      }
    } else if (mode === "year") {
      year += delta;
    }

    state.settings.periodYear = year;
    state.settings.periodMonth = month;
    saveSettings();
    return getPeriod();
  }

  function resetPeriodToCurrent() {
    const now = new Date();
    state.settings.periodMode = "month";
    state.settings.periodYear = now.getFullYear();
    state.settings.periodMonth = now.getMonth() + 1;
    saveSettings();
    return getPeriod();
  }

  function setSyncPeriodTimeline(sync) {
    state.settings.syncPeriodTimeline = !!sync;
    saveSettings();
    return state.settings.syncPeriodTimeline;
  }

  /**
   * BỘ LỌC CỐT LÕI (BẢO MẬT & CÁ NHÂN HÓA & KỲ THỜI GIAN):
   * - Nếu tx là 'personal': CHỈ CHẤP NHẬN NẾU tx.author === myRole.
   * - Nếu tx là 'family': Chỉ hiển thị nếu thuộc gia đình hiện tại.
   * - Lọc theo Kỳ báo cáo (Tháng / Năm / Tất Cả) khi options.forAnalytics = true hoặc khi syncPeriodTimeline = true.
   * - Sắp xếp theo ngày giờ mới nhất lên đầu.
   */
  function getFilteredTransactions(options = {}) {
    const { activeAuthor, activeWallet, childFilter, authorFilter, currentFamilyId, periodMode, periodYear, periodMonth, syncPeriodTimeline } = state.settings;

    const ignorePeriod = options.ignorePeriod !== undefined 
      ? options.ignorePeriod 
      : (options.forAnalytics ? false : !syncPeriodTimeline);

    const mode = options.periodMode || periodMode || "month";
    const year = options.periodYear !== undefined ? parseInt(options.periodYear, 10) : (parseInt(periodYear, 10) || new Date().getFullYear());
    const month = options.periodMonth !== undefined ? parseInt(options.periodMonth, 10) : (parseInt(periodMonth, 10) || (new Date().getMonth() + 1));

    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const yearPrefix = `${year}-`;

    const filtered = state.transactions.filter(tx => {
      // 1. Kiểm tra an toàn cá nhân: Khoản cá nhân của người kia bị loại bỏ ngay từ đầu
      if (tx.wallet === "personal" && tx.author !== activeAuthor) {
        return false;
      }

      // 2. Lọc theo gia đình đang kích hoạt
      if (tx.wallet === "family") {
        const txFamId = tx.familyId || "fam_main";
        if (txFamId !== (currentFamilyId || "fam_main")) {
          return false;
        }
      }

      // 3. Lọc theo tab ví đang chọn:
      if (activeWallet === "personal") {
        if (tx.wallet !== "personal" || tx.author !== activeAuthor) return false;
      } else if (activeWallet === "family") {
        if (tx.wallet !== "family") return false;
      } else if (activeWallet === "all") {
        const isMyPersonal = (tx.wallet === "personal" && tx.author === activeAuthor);
        const isFamily = (tx.wallet === "family");
        if (!isMyPersonal && !isFamily) return false;
      }

      // 4. Lọc theo con cái
      if (childFilter && childFilter !== "all" && tx.beneficiary !== childFilter) {
        return false;
      }

      // 5. Lọc theo người chi (filter chip Chồng / Vợ)
      if (authorFilter && authorFilter !== "all" && tx.author !== authorFilter) {
        return false;
      }

      // 6. Lọc theo kỳ thời gian (Tháng / Năm / Tất Cả)
      if (!ignorePeriod && tx.date) {
        if (mode === "month" && !tx.date.startsWith(monthPrefix)) {
          return false;
        }
        if (mode === "year" && !tx.date.startsWith(yearPrefix)) {
          return false;
        }
      }

      return true;
    });

    // Sắp xếp thời gian mới nhất lên đầu (Chính xác theo thời gian giao dịch)
    return filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  // Tính toán tóm tắt tài chính hiển thị theo kỳ
  function getFinancialSummary(periodOverride = null) {
    const pOpts = periodOverride || { forAnalytics: true };
    const txs = getFilteredTransactions(pOpts);

    let totalIncome = 0;
    let totalExpense = 0;

    txs.forEach(t => {
      if (t.type === "income") totalIncome += t.amount;
      else totalExpense += t.amount;
    });

    const netBalance = totalIncome - totalExpense;

    // Thống kê riêng cho Ví Gia Đình đang chọn trong kỳ
    const currentFamilyId = state.settings.currentFamilyId || "fam_main";
    const childrenMap = {};
    (state.settings.children || []).forEach(c => {
      childrenMap[c.id] = 0;
    });

    let husbandFamilyTotal = 0;
    let wifeFamilyTotal = 0;

    txs.forEach(t => {
      const txFamId = t.familyId || "fam_main";
      if (t.wallet === "family" && txFamId === currentFamilyId && t.type === "expense") {
        if (t.beneficiary && t.beneficiary !== "none") {
          const matchedChild = (state.settings.children || []).find(c => c.id === t.beneficiary || c.name === t.beneficiary);
          if (matchedChild && childrenMap.hasOwnProperty(matchedChild.id)) {
            childrenMap[matchedChild.id] += t.amount;
          } else if (childrenMap.hasOwnProperty(t.beneficiary)) {
            childrenMap[t.beneficiary] += t.amount;
          }
        }

        if (t.author === "husband") husbandFamilyTotal += t.amount;
        else if (t.author === "wife") wifeFamilyTotal += t.amount;
      }
    });

    const totalFamily = husbandFamilyTotal + wifeFamilyTotal;
    const husbandPercent = totalFamily > 0 ? Math.round((husbandFamilyTotal / totalFamily) * 100) : 0;
    const wifePercent = totalFamily > 0 ? (100 - husbandPercent) : 0;

    // Ngân sách theo kỳ
    let period;
    if (periodOverride) {
      const mode = periodOverride.periodMode || state.settings.periodMode || "month";
      const year = parseInt(periodOverride.periodYear, 10) || parseInt(state.settings.periodYear, 10) || new Date().getFullYear();
      const month = parseInt(periodOverride.periodMonth, 10) || parseInt(state.settings.periodMonth, 10) || (new Date().getMonth() + 1);
      const ym = `${year}-${String(month).padStart(2, "0")}`;
      let label = "";
      if (mode === "month") label = `Tháng ${String(month).padStart(2, "0")}/${year}`;
      else if (mode === "year") label = `Năm ${year}`;
      else label = "Toàn bộ thời gian";
      period = { mode, year, month, ym, label, syncTimeline: !!state.settings.syncPeriodTimeline };
    } else {
      period = getPeriod();
    }

    let budget = 0;
    if (period.mode === "month") {
      budget = getBudgetForMonth(period.ym);
    } else if (period.mode === "year") {
      budget = getBudgetForMonth(getCurrentYearMonth()) * 12;
    } else {
      budget = 0;
    }

    const budgetPercent = budget > 0 ? Math.min(100, Math.round((totalExpense / budget) * 100)) : 0;
    const actualPercent = budget > 0 ? Math.round((totalExpense / budget) * 100) : 0;

    return {
      netBalance,
      totalIncome,
      totalExpense,
      budget,
      budgetPercent,
      actualPercent,
      childrenMap,
      childBo: childrenMap["Bo"] || 0,
      childBong: childrenMap["Bông"] || 0,
      husbandTotal: husbandFamilyTotal,
      wifeTotal: wifeFamilyTotal,
      husbandPercent,
      wifePercent,
      totalFamily,
      period
    };
  }

  // Breakdown cho Chart.js theo kỳ
  function getCategoryBreakdown(periodOverride = null) {
    const pOpts = periodOverride || { forAnalytics: true };
    const txs = getFilteredTransactions(pOpts).filter(t => t.type === "expense");
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

  // Lấy xu hướng chi tiêu 12 tháng trong năm cho Biểu đồ Cột Theo Năm
  function getMonthlyExpenseTrend(year) {
    const targetYear = parseInt(year, 10) || parseInt(state.settings.periodYear, 10) || new Date().getFullYear();
    const txs = getFilteredTransactions({ ignorePeriod: true }).filter(t => 
      t.type === "expense" && t.date && t.date.startsWith(`${targetYear}-`)
    );

    const labels = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
    const data = Array(12).fill(0);

    txs.forEach(t => {
      const parts = t.date.split("-");
      if (parts.length >= 2) {
        const m = parseInt(parts[1], 10); // 1-12
        if (m >= 1 && m <= 12) {
          data[m - 1] += t.amount;
        }
      }
    });

    return { labels, data, isYearly: true, year: targetYear };
  }

  // Lấy xu hướng chi tiêu theo kỳ (Biểu đồ Cột)
  function getDailyExpenseTrend(days = 7, periodOverride = null) {
    const period = periodOverride ? {
      mode: periodOverride.periodMode || state.settings.periodMode || "month",
      year: parseInt(periodOverride.periodYear, 10) || parseInt(state.settings.periodYear, 10) || new Date().getFullYear(),
      month: parseInt(periodOverride.periodMonth, 10) || parseInt(state.settings.periodMonth, 10) || (new Date().getMonth() + 1)
    } : getPeriod();

    // 1. Chế độ Theo Năm: Trả về 12 tháng
    if (period.mode === "year") {
      return getMonthlyExpenseTrend(period.year);
    }

    // 2. Chế độ Theo Tháng: Trả về chi tiêu các ngày trong tháng
    if (period.mode === "month") {
      const y = period.year;
      const m = period.month;
      const mStr = String(m).padStart(2, "0");
      const ymPrefix = `${y}-${mStr}`;

      const txs = getFilteredTransactions({ ignorePeriod: true }).filter(t => 
        t.type === "expense" && t.date && t.date.startsWith(ymPrefix)
      );

      const daysInMonth = new Date(y, m, 0).getDate();
      const labels = [];
      const data = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = String(day).padStart(2, "0");
        labels.push(`${dayStr}/${mStr}`);
        const dayPrefix = `${ymPrefix}-${dayStr}`;
        const daySum = txs
          .filter(t => t.date && t.date.startsWith(dayPrefix))
          .reduce((sum, t) => sum + t.amount, 0);
        data.push(daySum);
      }

      return { labels, data, isYearly: false, year: y, month: m, daysInMonth };
    }

    // 3. Chế độ Tất Cả: 7 ngày gần nhất
    const txs = getFilteredTransactions({ ignorePeriod: true }).filter(t => t.type === "expense");
    const labels = [];
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");

      labels.push(`${day}/${month}`);

      const dayTotal = txs
        .filter(t => t.date && t.date.startsWith(dateStr))
        .reduce((sum, t) => sum + t.amount, 0);

      data.push(dayTotal);
    }

    return { labels, data, isYearly: false };
  }

  // ==================== QUẢN LÝ NHIỀU GIA ĐÌNH ====================
  function getFamilies() {
    return state.settings.families || [];
  }

  function getCurrentFamily() {
    const families = getFamilies();
    return families.find(f => f.id === state.settings.currentFamilyId) || families[0] || { id: "fam_main", name: "Gia Đình Nhỏ", vaultId: "vault_default" };
  }

  function addFamily(name, customVaultId = null) {
    if (!name || !name.trim()) return null;
    if (!Array.isArray(state.settings.families)) state.settings.families = [];

    const id = "fam_" + Date.now().toString(36);
    const vaultId = (customVaultId && customVaultId.trim()) ? customVaultId.trim() : ("vault_" + Math.random().toString(36).substring(2, 9));
    const newFam = {
      id,
      name: name.trim(),
      vaultId
    };

    state.settings.families.push(newFam);
    state.settings.currentFamilyId = id;
    state.settings.vaultId = vaultId;
    saveSettings();

    // Reconnect supabase nếu có
    if (typeof window !== "undefined" && window.SupabaseSync && typeof window.SupabaseSync.init === "function") {
      window.SupabaseSync.init();
    }

    return newFam;
  }

  function switchFamily(id) {
    const fam = (state.settings.families || []).find(f => f.id === id);
    if (fam) {
      state.settings.currentFamilyId = fam.id;
      state.settings.vaultId = fam.vaultId;
      saveSettings();

      if (typeof window !== "undefined" && window.SupabaseSync && typeof window.SupabaseSync.init === "function") {
        window.SupabaseSync.init();
      }
      return fam;
    }
    return null;
  }

  function renameFamily(id, newName) {
    if (!newName || !newName.trim()) return null;
    const fam = (state.settings.families || []).find(f => f.id === id);
    if (fam) {
      fam.name = newName.trim();
      saveSettings();
      return fam;
    }
    return null;
  }

  function deleteFamily(id) {
    if (!state.settings.families || state.settings.families.length <= 1) {
      return false; // Phải giữ ít nhất 1 gia đình
    }
    state.settings.families = state.settings.families.filter(f => f.id !== id);
    if (state.settings.currentFamilyId === id) {
      state.settings.currentFamilyId = state.settings.families[0].id;
      state.settings.vaultId = state.settings.families[0].vaultId;
    }
    saveSettings();

    if (typeof window !== "undefined" && window.SupabaseSync && typeof window.SupabaseSync.init === "function") {
      window.SupabaseSync.init();
    }
    return true;
  }

  // ==================== QUẢN LÝ THÀNH VIÊN (CHỒNG / VỢ) ====================
  function getMemberName(role) {
    const members = state.settings.members || { husband: "Chồng", wife: "Vợ" };
    return members[role] || (role === "wife" ? "Vợ" : "Chồng");
  }

  function setMemberName(role, name) {
    if (!state.settings.members) state.settings.members = { husband: "Chồng", wife: "Vợ" };
    if (name && name.trim()) {
      state.settings.members[role] = name.trim();
      saveSettings();
    }
  }

  // ==================== QUẢN LÝ CON CÁI (BÉ BO, BÔNG...) ====================
  function getChildren() {
    return state.settings.children || [];
  }

  function addChild(name, avatar = "👶", note = "") {
    if (!name || !name.trim()) return null;
    if (!Array.isArray(state.settings.children)) state.settings.children = [];

    // Tạo ID an toàn, ngắn gọn
    const cleanId = name.trim().replace(/\s+/g, "_");
    const id = cleanId + "_" + Math.random().toString(36).substring(2, 5);

    const newChild = {
      id,
      name: name.trim(),
      avatar: avatar || "👶",
      note: note ? note.trim() : ""
    };

    state.settings.children.push(newChild);
    saveSettings();
    return newChild;
  }

  function renameChild(id, newName, newAvatar, newNote) {
    const child = (state.settings.children || []).find(c => c.id === id || c.name === id);
    if (child) {
      const oldId = child.id;
      const cleanName = newName ? newName.trim() : child.name;
      const cleanId = cleanName.replace(/^(Bé|bé|con)\s+/i, "").trim().replace(/\s+/g, "_") || cleanName;

      child.name = cleanName;
      child.id = cleanId;
      if (newAvatar) child.avatar = newAvatar;
      if (newNote !== undefined) child.note = newNote.trim();

      // Cập nhật tất cả các giao dịch cũ có beneficiary là oldId sang cleanId
      if (oldId !== cleanId) {
        state.transactions.forEach(t => {
          if (t.beneficiary === oldId) {
            t.beneficiary = cleanId;
          }
        });
        if (state.settings.childFilter === oldId) {
          state.settings.childFilter = cleanId;
        }
        save();
      }

      saveSettings();
      return child;
    }
    return null;
  }

  function getChildDisplayName(beneficiary) {
    if (!beneficiary || beneficiary === "none") return "";
    const children = getChildren();
    const child = children.find(c => c.id === beneficiary || c.name === beneficiary || (c.id && c.id.toLowerCase() === beneficiary.toLowerCase()) || (c.name && c.name.toLowerCase() === beneficiary.toLowerCase()));
    if (child) {
      return child.name;
    }
    return beneficiary;
  }

  function deleteChild(id) {
    if (!state.settings.children) return false;
    state.settings.children = state.settings.children.filter(c => c.id !== id && c.name !== id);
    if (state.settings.childFilter === id) {
      state.settings.childFilter = "all";
    }
    saveSettings();
    return true;
  }

  function formatNumber(val) {
    if (val === null || val === undefined || val === "") return "";
    const clean = val.toString().replace(/\D/g, "");
    if (!clean) return "";
    const normalized = clean.replace(/^0+(?=\d)/, "");
    return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function parseNumber(val) {
    if (val === null || val === undefined) return 0;
    const raw = val.toString().trim();
    if (/tr|m/i.test(raw)) {
      return Math.round((parseFloat(raw.replace(/[^\d.]/g, "")) || 0) * 1000000);
    }
    if (/k/i.test(raw)) {
      return Math.round((parseFloat(raw.replace(/[^\d.]/g, "")) || 0) * 1000);
    }
    return parseInt(raw.replace(/\D/g, ""), 10) || 0;
  }

  function formatMoney(amount) {
    if (isNaN(amount) || amount === null) return "0 ₫";
    const rounded = Math.round(amount);
    if (rounded === 0) return "0 ₫";
    return formatNumber(rounded) + " ₫";
  }

  function getCurrentYearMonth() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function getBudgetForMonth(yearMonth) {
    const ym = yearMonth || getCurrentYearMonth();
    if (state.settings.monthlyBudgets && state.settings.monthlyBudgets[ym] !== undefined) {
      return Number(state.settings.monthlyBudgets[ym]);
    }
    return state.settings.monthlyBudget !== undefined ? Number(state.settings.monthlyBudget) : 15000000;
  }

  function setBudgetForMonth(amount, yearMonth) {
    const ym = yearMonth || getCurrentYearMonth();
    if (!state.settings.monthlyBudgets || typeof state.settings.monthlyBudgets !== "object") {
      state.settings.monthlyBudgets = {};
    }
    const val = Math.max(0, parseInt(amount) || 0);
    state.settings.monthlyBudgets[ym] = val;
    state.settings.monthlyBudget = val;
    saveSettings();
    return val;
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
    getDailyExpenseTrend,
    getMonthlyExpenseTrend,
    formatMoney,
    formatNumber,
    parseNumber,
    saveSettings,
    // Period & Report methods
    getPeriod,
    setPeriod,
    shiftPeriod,
    resetPeriodToCurrent,
    setSyncPeriodTimeline,
    // Budget methods
    getCurrentYearMonth,
    getBudgetForMonth,
    setBudgetForMonth,
    // Multi-family methods
    getFamilies,
    getCurrentFamily,
    addFamily,
    switchFamily,
    renameFamily,
    deleteFamily,
    // Custom Member & Children methods
    getMemberName,
    setMemberName,
    getChildren,
    getChildDisplayName,
    addChild,
    renameChild,
    deleteChild
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Store;
}
