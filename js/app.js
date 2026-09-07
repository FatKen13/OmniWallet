/**
 * OmniWallet Main Controller
 * - Điều phối giao diện người dùng, Tab chuyển đổi, Chart.js, Modal
 * - Xử lý nhập liệu bằng giọng nói (Speech-to-Text vi-VN)
 * - Hiệu ứng âm thanh và vi phản hồi (Haptic Micro-interaction)
 */

document.addEventListener("DOMContentLoaded", () => {
  Store.init();
  SupabaseSync.init();

  // Elements
  const btnToggleAuthor = document.getElementById("btn-toggle-author");
  const authorIcon = document.getElementById("author-icon");
  const authorName = document.getElementById("author-name");

  const btnHeaderFamily = document.getElementById("btn-header-family");
  const headerFamName = document.getElementById("header-fam-name");
  const btnOpenFamilyModal = document.getElementById("btn-open-family-modal");
  const familyModalOverlay = document.getElementById("family-modal-overlay");
  const btnCloseFamilyModal = document.getElementById("btn-close-family-modal");

  const walletTabBtns = document.querySelectorAll(".wallet-tab-btn");
  const currentWalletLabel = document.getElementById("current-wallet-label");
  const displayBalance = document.getElementById("display-balance");
  const displayIncome = document.getElementById("display-income");
  const displayExpense = document.getElementById("display-expense");
  const budgetText = document.getElementById("budget-text");
  const budgetBar = document.getElementById("budget-bar");
  const btnTogglePrivacy = document.getElementById("btn-toggle-privacy");
  const eyeIcon = document.getElementById("eye-icon");

  const btnOpenAddExpense = document.getElementById("btn-open-add-expense");
  const addModalOverlay = document.getElementById("add-modal-overlay");
  const btnCloseAddModal = document.getElementById("btn-close-add-modal");

  const btnOpenAI = document.getElementById("btn-open-ai");
  const aiModalOverlay = document.getElementById("ai-modal-overlay");
  const btnCloseAIModal = document.getElementById("btn-close-ai-modal");
  const aiTextInput = document.getElementById("ai-text-input");
  const btnAISend = document.getElementById("btn-ai-send");
  const btnVoiceInput = document.getElementById("btn-voice-input");
  const aiChatBody = document.getElementById("ai-chat-body");

  const btnOpenSync = document.getElementById("btn-open-sync");
  const syncModalOverlay = document.getElementById("sync-modal-overlay");
  const btnCloseSyncModal = document.getElementById("btn-close-sync-modal");
  const syncShareUrl = document.getElementById("sync-share-url");
  const btnCopyShareUrl = document.getElementById("btn-copy-share-url");

  const btnToggleAnalytics = document.getElementById("btn-toggle-analytics");
  const analyticsView = document.getElementById("analytics-view");
  const analyticsBtnText = document.getElementById("analytics-btn-text");

  const txList = document.getElementById("tx-list");
  const txCount = document.getElementById("tx-count");

  let categoryChart = null;
  let dailyTrendChart = null;

  // 1. Khởi tạo giao diện
  const initialWallet = Store.state.settings.activeWallet || "personal";
  walletTabBtns.forEach(b => {
    if (b.getAttribute("data-wallet") === initialWallet) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  });
  if (initialWallet === "personal") currentWalletLabel.textContent = "Số Dư Ví Cá Nhân";
  else if (initialWallet === "family") currentWalletLabel.textContent = "Số Dư Quỹ Gia Đình";
  else currentWalletLabel.textContent = "Số Dư Toàn Bộ (Tổng Hợp)";

  updateFilterBarVisibility();
  renderDynamicUI();
  renderAll();
  populateCategoryGrid();
  updateAuthorUI();
  setupSyncModal();
  setupFamilyModal();

  // 2. Chuyển đổi Ví (Cá Nhân / Gia Đình / Tổng Hợp)
  walletTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      walletTabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const walletType = btn.getAttribute("data-wallet");
      Store.state.settings.activeWallet = walletType;
      Store.saveSettings();

      if (walletType === "personal") currentWalletLabel.textContent = "Số Dư Ví Cá Nhân";
      else if (walletType === "family") currentWalletLabel.textContent = "Số Dư Quỹ Gia Đình";
      else currentWalletLabel.textContent = "Số Dư Toàn Bộ (Tổng Hợp)";

      updateFilterBarVisibility();
      renderAll();
    });
  });

  function updateFilterBarVisibility() {
    const currentWallet = Store.state.settings.activeWallet;
    const filterBar = document.getElementById("filter-bar");
    const childGroup = document.getElementById("child-filter-chips");
    const authorGroup = document.getElementById("author-filter-chips");

    if (currentWallet === "personal") {
      if (filterBar) filterBar.style.display = "none";
    } else {
      if (filterBar) filterBar.style.display = "flex";
      if (authorGroup) authorGroup.style.display = "flex";
      if (childGroup) childGroup.style.display = "flex";
    }
  }

  // 3. Đổi Người Chi (Chồng <-> Vợ)
  btnToggleAuthor.addEventListener("click", () => {
    const cur = Store.state.settings.activeAuthor;
    Store.state.settings.activeAuthor = cur === "husband" ? "wife" : "husband";
    Store.saveSettings();
    updateAuthorUI();
    renderAll();
    const curRole = Store.state.settings.activeAuthor;
    const name = Store.getMemberName(curRole);
    showToast(`Đã chuyển sang: ${curRole === "husband" ? "👨" : "👩"} ${name}`);
  });

  function updateAuthorUI() {
    const author = Store.state.settings.activeAuthor;
    const name = Store.getMemberName(author);
    if (author === "husband") {
      authorIcon.textContent = "👨";
      authorName.textContent = `${name} (Tôi)`;
      btnToggleAuthor.style.borderColor = "var(--husband-color)";
    } else {
      authorIcon.textContent = "👩";
      authorName.textContent = `${name} (Tôi)`;
      btnToggleAuthor.style.borderColor = "var(--wife-color)";
    }
  }

  // 4. Ẩn / Hiện số tiền (Privacy)
  btnTogglePrivacy.addEventListener("click", () => {
    Store.state.settings.privacyMode = !Store.state.settings.privacyMode;
    Store.saveSettings();
    updatePrivacyUI();
  });

  function updatePrivacyUI() {
    const isPrivate = Store.state.settings.privacyMode;
    eyeIcon.className = isPrivate ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
    renderBalance();
  }

  // Cập nhật giao diện động theo gia đình và thành viên tùy biến
  function renderDynamicUI() {
    // 1. Cập nhật tên gia đình trên Header
    const curFam = Store.getCurrentFamily();
    if (headerFamName && curFam) {
      headerFamName.textContent = curFam.name;
    }

    // 2. Cập nhật nhãn người chi chính
    updateAuthorUI();

    // 3. Cập nhật tên vợ/chồng trên bộ lọc nhanh (Filter chips)
    const hName = Store.getMemberName("husband");
    const wName = Store.getMemberName("wife");

    const chipH = document.querySelector('#author-filter-chips [data-author="husband"]');
    const chipW = document.querySelector('#author-filter-chips [data-author="wife"]');
    if (chipH) chipH.textContent = `👨 ${hName}`;
    if (chipW) chipW.textContent = `👩 ${wName}`;

    // Bắt sự kiện click cho author chips
    document.querySelectorAll("#author-filter-chips .filter-chip").forEach(chip => {
      chip.onclick = () => {
        document.querySelectorAll("#author-filter-chips .filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        Store.state.settings.authorFilter = chip.getAttribute("data-author");
        renderTransactions();
      };
    });

    // 4. Cập nhật chip con cái
    const childContainer = document.getElementById("child-filter-chips");
    if (childContainer) {
      const curChildFilter = Store.state.settings.childFilter || "all";
      childContainer.innerHTML = `<button class="filter-chip ${curChildFilter === 'all' ? 'active' : ''}" data-child="all">Tất cả con</button>`;
      Store.getChildren().forEach(child => {
        const btn = document.createElement("button");
        btn.className = `filter-chip ${curChildFilter === child.id ? 'active' : ''}`;
        btn.setAttribute("data-child", child.id);
        btn.textContent = `${child.avatar || '👶'} ${child.name}`;
        childContainer.appendChild(btn);
      });
      childContainer.querySelectorAll(".filter-chip").forEach(chip => {
        chip.onclick = () => {
          childContainer.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
          Store.state.settings.childFilter = chip.getAttribute("data-child");
          renderTransactions();
        };
      });
    }

    // 5. Cập nhật form thêm chi tiêu (Add Modal Sheet)
    const sheetH = document.querySelector('#sheet-author-segmented [data-val="husband"]');
    const sheetW = document.querySelector('#sheet-author-segmented [data-val="wife"]');
    if (sheetH) sheetH.textContent = `👨 ${hName}`;
    if (sheetW) sheetW.textContent = `👩 ${wName}`;

    const childSelectRow = document.querySelector("#sheet-beneficiary-group .child-select-row");
    if (childSelectRow) {
      childSelectRow.innerHTML = `<button type="button" class="child-btn active" data-val="none">👨‍👩‍👧 Chung cả nhà</button>`;
      Store.getChildren().forEach(child => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "child-btn";
        b.setAttribute("data-val", child.id);
        b.textContent = `${child.avatar || '👶'} ${child.name}`;
        childSelectRow.appendChild(b);
      });
      childSelectRow.querySelectorAll(".child-btn").forEach(btn => {
        btn.onclick = () => {
          childSelectRow.querySelectorAll(".child-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        };
      });
    }

    // 6. Cập nhật tiêu đề Analytics
    const spouseCompTitle = document.getElementById("spouse-comparison-title");
    if (spouseCompTitle) spouseCompTitle.innerHTML = `<i class="fa-solid fa-scale-balanced"></i> Đóng Góp Chi Tiêu (${hName} vs ${wName})`;
    const spouseLblH = document.getElementById("spouse-label-husband");
    const spouseLblW = document.getElementById("spouse-label-wife");
    if (spouseLblH) spouseLblH.textContent = hName;
    if (spouseLblW) spouseLblW.textContent = wName;

    const childrenList = Store.getChildren();
    const childrenAnalyticsTitle = document.getElementById("children-analytics-title");
    if (childrenAnalyticsTitle) {
      if (childrenList.length > 0) {
        childrenAnalyticsTitle.innerHTML = `<i class="fa-solid fa-children"></i> Chi Phí Nuôi Con (${childrenList.map(c => c.name).join(" vs ")})`;
      } else {
        childrenAnalyticsTitle.innerHTML = `<i class="fa-solid fa-children"></i> Chi Phí Nuôi Con`;
      }
    }
  }

  // 5. Render toàn bộ
  function renderAll() {
    renderBalance();
    renderTransactions();
    renderAnalytics();
  }

  function renderBalance() {
    const summary = Store.getFinancialSummary();
    const isPrivate = Store.state.settings.privacyMode;

    if (isPrivate) {
      displayBalance.textContent = "•••••••• ₫";
      displayIncome.textContent = "+•••••• ₫";
      displayExpense.textContent = "-•••••• ₫";
      budgetText.textContent = summary.budget > 0 ? `${summary.budgetPercent}% (Đang ẩn)` : "Chưa đặt ngân sách";
    } else {
      displayBalance.textContent = Store.formatMoney(summary.netBalance);
      displayIncome.textContent = "+" + Store.formatMoney(summary.totalIncome);
      displayExpense.textContent = "-" + Store.formatMoney(summary.totalExpense);
      if (summary.budget > 0) {
        budgetText.textContent = `${summary.actualPercent || summary.budgetPercent}% (${Store.formatMoney(summary.totalExpense)} / ${Store.formatMoney(summary.budget)})`;
      } else {
        budgetText.textContent = `Chưa đặt (Bấm để cài đặt)`;
      }
    }

    if (summary.budget > 0) {
      budgetBar.style.display = "block";
      budgetBar.style.width = summary.budgetPercent + "%";
      if (summary.budgetPercent > 90) {
        budgetBar.style.background = "linear-gradient(90deg, #f59e0b, #ef4444)";
      } else {
        budgetBar.style.background = "linear-gradient(90deg, #10b981, #f59e0b)";
      }
    } else {
      budgetBar.style.width = "0%";
    }
  }

  // Cho phép người dùng bấm trực tiếp vào Ngân sách tháng để cài đặt
  const budgetBox = document.getElementById("budget-box");
  if (budgetBox) {
    budgetBox.addEventListener("click", () => {
      const curBudget = Store.getBudgetForMonth();
      const promptVal = prompt(
        `Cài đặt ngân sách chi tiêu cho tháng này:\n(Nhập số tiền bằng VNĐ, ví dụ: 10tr, 15000000, hoặc nhập 0 để tắt ngân sách)`,
        curBudget > 0 ? curBudget : "15000000"
      );
      if (promptVal !== null && promptVal.trim() !== "") {
        const raw = promptVal.trim();
        let val = 0;
        if (/tr|m/i.test(raw)) {
          val = parseFloat(raw.replace(/[^\d.]/g, "")) * 1000000;
        } else if (/k/i.test(raw)) {
          val = parseFloat(raw.replace(/[^\d.]/g, "")) * 1000;
        } else {
          val = parseInt(raw.replace(/[.,\sđ₫]/g, "")) || 0;
        }

        Store.setBudgetForMonth(val);
        renderBalance();
        if (val > 0) {
          showToast(`Đã đặt ngân sách tháng này là ${Store.formatMoney(val)}!`, "fa-bullseye");
        } else {
          showToast("Đã tắt ngân sách tháng!", "fa-circle-info");
        }
      }
    });
  }

  function formatTxDateGroup(dateStr) {
    if (!dateStr) return "Giao dịch trước đây";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Giao dịch";

    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");

    if (isToday) return `Hôm nay • ${day}/${month}`;
    if (isYesterday) return `Hôm qua • ${day}/${month}`;
    return `Ngày ${day}/${month}/${d.getFullYear()}`;
  }

  function formatTxTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${mins}`;
  }

  function renderTransactions() {
    const txs = Store.getFilteredTransactions();
    txCount.textContent = `${txs.length} giao dịch`;
    txList.innerHTML = "";

    if (txs.length === 0) {
      txList.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-receipt"></i>
          <p>Chưa có khoản chi tiêu nào phù hợp.</p>
          <button class="empty-add-btn" id="btn-empty-add"><i class="fa-solid fa-plus"></i> Thêm giao dịch mới</button>
        </div>
      `;
      document.getElementById("btn-empty-add")?.addEventListener("click", () => {
        btnOpenAddExpense.click();
      });
      return;
    }

    let lastDateGroup = null;

    txs.forEach(t => {
      const dateGroup = formatTxDateGroup(t.date);
      if (dateGroup !== lastDateGroup) {
        const divider = document.createElement("div");
        divider.className = "tx-date-divider";
        divider.textContent = dateGroup;
        txList.appendChild(divider);
        lastDateGroup = dateGroup;
      }

      const cat = Store.CATEGORIES.find(c => c.id === t.category) || { name: "Khác", icon: "fa-circle-dot", color: "#64748b" };
      const hName = Store.getMemberName("husband");
      const wName = Store.getMemberName("wife");
      const authorClass = t.author === "wife" ? "wife" : "husband";
      const authorText = t.author === "wife" ? `👩 ${wName}` : `👨 ${hName}`;
      const isExpense = t.type === "expense";
      const timeText = formatTxTime(t.date);

      let childBadge = "";
      if (t.beneficiary && t.beneficiary !== "none") {
        const foundChild = Store.getChildren().find(c => 
          c.id === t.beneficiary || 
          c.name === t.beneficiary ||
          (c.id && c.id.toLowerCase() === t.beneficiary.toLowerCase()) ||
          (c.name && c.name.toLowerCase() === t.beneficiary.toLowerCase())
        );
        const childLabel = foundChild ? `${foundChild.avatar || "👶"} ${foundChild.name}` : Store.getChildDisplayName(t.beneficiary);
        childBadge = `<span class="tx-badge child">${childLabel}</span>`;
      }

      const card = document.createElement("div");
      card.className = "tx-card";
      card.innerHTML = `
        <div class="tx-left">
          <div class="tx-cat-icon" style="background: ${cat.color}20; color: ${cat.color};">
            <i class="fa-solid ${cat.icon}"></i>
          </div>
          <div class="tx-details">
            <span class="tx-note" title="${t.note || cat.name}">${t.note || cat.name}</span>
            <div class="tx-meta-badges">
              ${timeText ? `<span class="tx-badge time"><i class="fa-regular fa-clock"></i> ${timeText}</span>` : ""}
              <span class="tx-badge ${authorClass}">${authorText}</span>
              <span class="tx-badge family">${t.wallet === "family" ? "Gia Đình" : "Cá Nhân"}</span>
              ${childBadge}
            </div>
          </div>
        </div>
        <div class="tx-right">
          <span class="tx-amount ${isExpense ? "expense" : "income"}">
            ${isExpense ? "-" : "+"}${Store.formatMoney(t.amount)}
          </span>
          <button class="tx-del-btn" data-id="${t.id}" title="Xóa"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      `;
      txList.appendChild(card);
    });

    // Event listener cho nút xóa
    document.querySelectorAll(".tx-del-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (confirm("Bạn có chắc muốn xóa khoản chi này?")) {
          Store.deleteTransaction(id);
          renderAll();
          showToast("Đã xóa giao dịch", "fa-trash");
        }
      });
    });
  }

  function renderAnalytics() {
    const summary = Store.getFinancialSummary();

    // 1. Cập nhật Thẻ Dòng Tiền & Tỷ Lệ Tích Lũy
    const cfRatioText = document.getElementById("cf-ratio-text");
    const cfSavingsRate = document.getElementById("cf-savings-rate");
    const cfBadge = document.getElementById("cashflow-health-badge");
    const cfBarFill = document.getElementById("cf-bar-fill");

    if (cfRatioText && cfSavingsRate && cfBadge && cfBarFill) {
      cfRatioText.textContent = `${Store.formatMoney(summary.totalIncome)} / ${Store.formatMoney(summary.totalExpense)}`;
      
      let savingsRate = 0;
      if (summary.totalIncome > 0) {
        savingsRate = Math.round(((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 100);
      }
      cfSavingsRate.textContent = `${savingsRate > 0 ? "+" : ""}${savingsRate}%`;

      if (savingsRate >= 20) {
        cfBadge.className = "cashflow-badge healthy";
        cfBadge.textContent = "🟢 Tích lũy tốt (>20%)";
        cfSavingsRate.style.color = "var(--income-color)";
        cfBarFill.style.background = "linear-gradient(90deg, #10b981, #06b6d4)";
      } else if (savingsRate >= 0) {
        cfBadge.className = "cashflow-badge warning";
        cfBadge.textContent = "🟡 Cân bằng (0-20%)";
        cfSavingsRate.style.color = "var(--brand-primary)";
        cfBarFill.style.background = "linear-gradient(90deg, #f59e0b, #6366f1)";
      } else {
        cfBadge.className = "cashflow-badge danger";
        cfBadge.textContent = "🔴 Thâm hụt ngân sách";
        cfSavingsRate.style.color = "var(--expense-color)";
        cfBarFill.style.background = "linear-gradient(90deg, #ef4444, #f43f5e)";
      }

      const totalFlow = summary.totalIncome + summary.totalExpense;
      const incomeFillPercent = totalFlow > 0 ? Math.round((summary.totalIncome / totalFlow) * 100) : 50;
      cfBarFill.style.width = incomeFillPercent + "%";
    }

    // 2. Cập nhật thẻ & thanh so sánh con cái (Động theo Store.getChildren)
    const childrenGrid = document.getElementById("children-analytics-grid");
    const childrenList = Store.getChildren();
    if (childrenGrid) {
      childrenGrid.innerHTML = "";
      if (childrenList.length === 0) {
        childrenGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">Chưa thêm thông tin bé nào. Bấm vào Quản Lý Gia Đình & Thành Viên để thêm con.</div>`;
      } else {
        childrenList.forEach(child => {
          const amt = (summary.childrenMap && summary.childrenMap[child.id]) || 0;
          const card = document.createElement("div");
          card.className = "child-card";
          card.innerHTML = `
            <div class="child-card-header">
              <span class="child-avatar">${child.avatar || "👶"}</span>
              <div>
                <h4>${child.name}</h4>
                <small>${child.note || "Học tập, đồ dùng"}</small>
              </div>
            </div>
            <div class="child-amount">${Store.formatMoney(amt)}</div>
          `;
          childrenGrid.appendChild(card);
        });
      }
    }

    // Thanh so sánh tỷ trọng chi cho các con
    const childrenSpousesBar = document.getElementById("children-spouses-bar");
    if (childrenSpousesBar) {
      childrenSpousesBar.innerHTML = "";
      let totalChild = 0;
      childrenList.forEach(c => {
        totalChild += (summary.childrenMap && summary.childrenMap[c.id]) || 0;
      });

      if (totalChild === 0 || childrenList.length === 0) {
        childrenSpousesBar.innerHTML = `<div class="spouses-segment" style="width: 100%; background: var(--border-glass-strong); color: var(--text-muted); justify-content: center;">Chưa có chi phí cho con</div>`;
      } else {
        const palette = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];
        childrenList.forEach((child, idx) => {
          const amt = (summary.childrenMap && summary.childrenMap[child.id]) || 0;
          const pct = Math.round((amt / totalChild) * 100);
          if (pct > 0) {
            const seg = document.createElement("div");
            seg.className = "spouses-segment";
            seg.style.background = palette[idx % palette.length];
            seg.style.width = Math.max(pct, 12) + "%";
            seg.textContent = pct >= 15 ? `${child.name}: ${pct}%` : `${pct}%`;
            childrenSpousesBar.appendChild(seg);
          }
        });
      }
    }

    // 3. Cập nhật thanh so sánh Chồng vs Vợ
    const barH = document.getElementById("spouse-bar-husband");
    const barW = document.getElementById("spouse-bar-wife");
    if (barH && barW) {
      if (summary.totalFamily === 0) {
        barH.style.width = "100%";
        barH.textContent = "Chưa có chi tiêu chung";
        barH.style.background = "var(--border-glass-strong)";
        barH.style.color = "var(--text-muted)";
        barW.style.display = "none";
      } else {
        barH.style.display = "flex";
        barH.style.background = "var(--husband-color)";
        barH.style.color = "#fff";
        barH.style.width = Math.max(summary.husbandPercent, 10) + "%";
        barH.textContent = summary.husbandPercent >= 15 ? summary.husbandPercent + "%" : "";

        barW.style.display = summary.wifePercent > 0 ? "flex" : "none";
        barW.style.background = "var(--wife-color)";
        barW.style.color = "#fff";
        barW.style.width = Math.max(summary.wifePercent, 10) + "%";
        barW.textContent = summary.wifePercent >= 15 ? summary.wifePercent + "%" : "";
      }
    }

    document.getElementById("spouse-val-husband").textContent = Store.formatMoney(summary.husbandTotal);
    document.getElementById("spouse-val-wife").textContent = Store.formatMoney(summary.wifeTotal);

    // 4. Cập nhật Chart.js
    if (typeof Chart === "undefined") return;

    // A. Biểu đồ Cột Xu Hướng 7 Ngày Gần Nhất
    const dailyData = Store.getDailyExpenseTrend(7);
    const dailyCtx = document.getElementById("dailyTrendChart");
    if (dailyCtx) {
      if (dailyTrendChart) {
        dailyTrendChart.destroy();
        dailyTrendChart = null;
      }
      try {
        dailyTrendChart = new Chart(dailyCtx, {
          type: "bar",
          data: {
            labels: dailyData.labels,
            datasets: [{
              label: "Chi tiêu",
              data: dailyData.data,
              backgroundColor: "rgba(99, 102, 241, 0.75)",
              hoverBackgroundColor: "#6366f1",
              borderRadius: 6,
              borderSkipped: false
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => " " + Store.formatMoney(context.raw)
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: "#94a3b8", font: { family: "Plus Jakarta Sans", size: 11 } }
              },
              y: {
                grid: { color: "rgba(255, 255, 255, 0.05)" },
                ticks: {
                  color: "#94a3b8",
                  font: { family: "Plus Jakarta Sans", size: 10 },
                  callback: (value) => value >= 1000000 ? (value / 1000000) + "M" : (value >= 1000 ? (value / 1000) + "k" : value)
                }
              }
            }
          }
        });
      } catch (e) {
        console.warn("dailyTrendChart creation error:", e);
      }
    }

    // B. Biểu đồ Tròn Phân Bổ Theo Danh Mục
    const catData = Store.getCategoryBreakdown();
    const ctx = document.getElementById("categoryChart");
    if (ctx) {
      if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
      }

      if (catData.data.length > 0) {
        try {
          categoryChart = new Chart(ctx, {
            type: "doughnut",
            data: {
              labels: catData.labels,
              datasets: [{
                data: catData.data,
                backgroundColor: catData.colors,
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "right",
                  labels: { color: "#94a3b8", font: { family: "Plus Jakarta Sans", size: 11 } }
                }
              },
              cutout: "68%"
            }
          });
        } catch (e) {
          console.warn("Chart creation error:", e);
        }
      }
    }
  }

  // Toggle Analytics View
  btnToggleAnalytics.addEventListener("click", () => {
    const isHidden = analyticsView.style.display === "none";
    analyticsView.style.display = isHidden ? "flex" : "none";
    analyticsBtnText.textContent = isHidden ? "Thu Gọn" : "Báo Cáo";
    if (isHidden) {
      renderAnalytics();
    }
  });

  // ==================== POPULATE & MODAL ADD ====================
  function populateCategoryGrid() {
    const grid = document.getElementById("category-grid");
    if (!grid) return;
    grid.innerHTML = "";

    Store.CATEGORIES.forEach((c, idx) => {
      const btn = document.createElement("button");
      btn.className = `cat-btn ${idx === 0 ? "active" : ""}`;
      btn.setAttribute("data-id", c.id);
      btn.innerHTML = `
        <span class="cat-icon" style="color: ${c.color};"><i class="fa-solid ${c.icon}"></i></span>
        <span class="cat-name">${c.name}</span>
      `;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Nếu chọn học tập hoặc mẹ bé -> tự highlight chọn con cái
        if (c.id === "education" || c.id === "baby") {
          document.getElementById("sheet-beneficiary-group").style.display = "flex";
        }
      });
      grid.appendChild(btn);
    });
  }

  // Mở & Đóng Add Modal
  btnOpenAddExpense.addEventListener("click", () => {
    const curWallet = Store.state.settings.activeWallet === "all" ? "family" : Store.state.settings.activeWallet;
    document.querySelectorAll("#sheet-wallet-segmented .mini-btn").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-val") === curWallet);
    });

    const sheetBeneficiaryGroup = document.getElementById("sheet-beneficiary-group");
    const sheetAuthorGroup = document.querySelector("#sheet-author-segmented")?.closest(".field-col");

    if (curWallet === "personal") {
      if (sheetBeneficiaryGroup) sheetBeneficiaryGroup.style.display = "none";
      if (sheetAuthorGroup) {
        sheetAuthorGroup.style.opacity = "0.4";
        sheetAuthorGroup.style.pointerEvents = "none";
      }
    } else {
      if (sheetBeneficiaryGroup) sheetBeneficiaryGroup.style.display = "flex";
      if (sheetAuthorGroup) {
        sheetAuthorGroup.style.opacity = "1";
        sheetAuthorGroup.style.pointerEvents = "auto";
      }
    }

    addModalOverlay.classList.add("active");
    document.getElementById("input-amount").focus();
  });
  btnCloseAddModal.addEventListener("click", () => addModalOverlay.classList.remove("active"));
  addModalOverlay.addEventListener("click", (e) => {
    if (e.target === addModalOverlay) addModalOverlay.classList.remove("active");
  });

  // Quick Amount Pills (+10k, +50k...) & Clear
  document.querySelectorAll(".num-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const addVal = parseInt(pill.getAttribute("data-val"));
      if (isNaN(addVal)) return;
      const curVal = parseInt(document.getElementById("input-amount").value.replace(/[^0-9]/g, "") || "0");
      document.getElementById("input-amount").value = (curVal + addVal).toLocaleString("vi-VN");
    });
  });

  const inputAmount = document.getElementById("input-amount");
  const inputNote = document.getElementById("input-note");
  const btnClearAmount = document.getElementById("btn-clear-amount");

  // Format số tiền tức thì khi người dùng gõ
  inputAmount.addEventListener("input", () => {
    const clean = inputAmount.value.replace(/[^0-9]/g, "");
    if (!clean) {
      inputAmount.value = "";
      return;
    }
    inputAmount.value = parseInt(clean, 10).toLocaleString("vi-VN");
  });

  if (btnClearAmount) {
    btnClearAmount.addEventListener("click", () => {
      inputAmount.value = "";
      inputAmount.focus();
    });
  }

  // Điều hướng bàn phím tiện thao tác: Enter từ số tiền nhảy sang ghi chú, Enter từ ghi chú lưu ngay
  inputAmount.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputNote.focus();
    }
  });

  inputNote.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("btn-save-tx").click();
    }
  });

  // Phím ESC đóng mọi modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      addModalOverlay?.classList.remove("active");
      aiModalOverlay?.classList.remove("active");
      syncModalOverlay?.classList.remove("active");
      familyModalOverlay?.classList.remove("active");
    }
  });

  // Wallet & Author mini segmented
  setupMiniSegmented("sheet-wallet-segmented");
  setupMiniSegmented("sheet-author-segmented");

  // Điều chỉnh form thêm chi tiêu theo ví được chọn
  const sheetWalletBtns = document.querySelectorAll("#sheet-wallet-segmented .mini-btn");
  const sheetBeneficiaryGroup = document.getElementById("sheet-beneficiary-group");
  const sheetAuthorGroup = document.querySelector("#sheet-author-segmented").closest(".field-col");

  sheetWalletBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute("data-val");
      if (val === "personal") {
        if (sheetBeneficiaryGroup) sheetBeneficiaryGroup.style.display = "none";
        if (sheetAuthorGroup) sheetAuthorGroup.style.opacity = "0.4";
        if (sheetAuthorGroup) sheetAuthorGroup.style.pointerEvents = "none";
      } else {
        if (sheetBeneficiaryGroup) sheetBeneficiaryGroup.style.display = "flex";
        if (sheetAuthorGroup) sheetAuthorGroup.style.opacity = "1";
        if (sheetAuthorGroup) sheetAuthorGroup.style.pointerEvents = "auto";
      }
    });
  });


  function setupMiniSegmented(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll(".mini-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.querySelectorAll(".mini-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  // Type Toggle (Expense / Income)
  const btnTypeExpense = document.getElementById("btn-type-expense");
  const btnTypeIncome = document.getElementById("btn-type-income");
  let activeTxType = "expense";

  btnTypeExpense.addEventListener("click", () => {
    btnTypeExpense.classList.add("active");
    btnTypeIncome.classList.remove("active");
    activeTxType = "expense";
  });
  btnTypeIncome.addEventListener("click", () => {
    btnTypeIncome.classList.add("active");
    btnTypeExpense.classList.remove("active");
    activeTxType = "income";
  });

  // Lưu giao dịch từ Modal
  document.getElementById("btn-save-tx").addEventListener("click", () => {
    const rawAmount = document.getElementById("input-amount").value.replace(/[^0-9]/g, "");
    const amount = parseFloat(rawAmount);

    if (!amount || isNaN(amount) || amount <= 0) {
      alert("Vui lòng nhập số tiền hợp lệ!");
      return;
    }

    const activeCatBtn = document.querySelector(".cat-btn.active");
    const category = activeCatBtn ? activeCatBtn.getAttribute("data-id") : "other";

    const activeChildBtn = document.querySelector(".child-btn.active");
    const beneficiary = activeChildBtn ? activeChildBtn.getAttribute("data-val") : "none";

    const activeWalletBtn = document.querySelector("#sheet-wallet-segmented .mini-btn.active");
    const wallet = activeWalletBtn ? activeWalletBtn.getAttribute("data-val") : "family";

    const activeAuthorBtn = document.querySelector("#sheet-author-segmented .mini-btn.active");
    const author = activeAuthorBtn ? activeAuthorBtn.getAttribute("data-val") : "husband";

    const note = document.getElementById("input-note").value;

    Store.addTransaction({
      type: activeTxType,
      amount,
      category,
      beneficiary,
      wallet,
      author,
      note
    });

    // Reset Form
    document.getElementById("input-amount").value = "";
    document.getElementById("input-note").value = "";
    addModalOverlay.classList.remove("active");

    renderAll();
    showToast(`Đã lưu: ${Store.formatMoney(amount)}`, "fa-circle-check");
  });

  // ==================== AI ASSISTANT CHAT ====================
  btnOpenAI.addEventListener("click", () => {
    aiModalOverlay.classList.add("active");
    setTimeout(() => aiTextInput.focus(), 150);
  });
  btnCloseAIModal.addEventListener("click", () => aiModalOverlay.classList.remove("active"));
  aiModalOverlay.addEventListener("click", (e) => {
    if (e.target === aiModalOverlay) aiModalOverlay.classList.remove("active");
  });

  btnAISend.addEventListener("click", handleAISubmit);
  aiTextInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleAISubmit();
  });

  // Quick AI chips
  document.querySelectorAll(".ai-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      aiTextInput.value = chip.getAttribute("data-prompt");
      handleAISubmit();
    });
  });

  async function handleAISubmit() {
    const prompt = aiTextInput.value.trim();
    if (!prompt) return;

    appendAIMsg("user", prompt);
    aiTextInput.value = "";

    // 1. Kiểm tra xem có phải lệnh ghi tiền không
    const parsed = AIAssistant.parseNaturalTextOffline(prompt);

    if (parsed.isCommand) {
      // Trường hợp đặt ngân sách bằng AI
      if (parsed.isBudgetCommand) {
        Store.setBudgetForMonth(parsed.budgetAmount);
        renderAll();
        appendAIMsg("bot", `🎯 Đã cập nhật ngân sách chi tiêu tháng này là **${Store.formatMoney(parsed.budgetAmount)}** thành công!`);
        showToast(`Đã đặt ngân sách: ${Store.formatMoney(parsed.budgetAmount)}`, "fa-bullseye");
        return;
      }

      // Trường hợp 1: Nhận diện nhiều giao dịch trong 1 câu (VD: "ăn trưa 50k và đổ xăng 80k")
      if (parsed.isMultiple && parsed.dataList && parsed.dataList.length > 0) {
        let totalAmt = 0;
        const multiBtnId = "btn-save-ai-multi-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
        let listHtml = `Tôi đã nhận diện được **${parsed.dataList.length}** khoản chi tiêu cùng lúc:<div class="ai-multi-confirm-box">`;
        
        parsed.dataList.forEach((d, idx) => {
          totalAmt += d.amount;
          const cat = Store.CATEGORIES.find(c => c.id === d.category) || { emoji: "✨", name: d.category };
          const authorMember = Store.getMemberName(d.author);
          const authorName = d.author === "wife" ? `👩 ${authorMember}` : `👨 ${authorMember}`;
          const walletName = d.wallet === "family" ? "Gia Đình" : "Cá Nhân";
          const childDisplayName = Store.getChildDisplayName(d.beneficiary);
          const childText = childDisplayName ? ` (${childDisplayName})` : "";

          listHtml += `
            <div class="ai-multi-item">
              <span><strong>${idx + 1}. ${d.note}</strong>: ${Store.formatMoney(d.amount)}</span>
              <small>${cat.emoji} ${cat.name}${childText} • ${authorName} • Ví ${walletName}</small>
            </div>
          `;
        });

        listHtml += `
          <div class="ai-multi-total">Tổng cộng: <strong>${Store.formatMoney(totalAmt)}</strong></div>
          <button class="btn-confirm-ai" id="${multiBtnId}">Xác Nhận & Lưu Toàn Bộ ${parsed.dataList.length} Khoản</button>
        </div>`;

        appendAIMsg("bot", listHtml);

        const multiBtn = document.getElementById(multiBtnId);
        if (multiBtn) {
          multiBtn.addEventListener("click", () => {
            if (multiBtn.disabled) return;
            multiBtn.disabled = true;
            multiBtn.innerHTML = `<i class="fa-solid fa-check"></i> Đã Lưu Toàn Bộ Vào Ví`;
            multiBtn.style.opacity = "0.7";
            multiBtn.style.cursor = "default";

            parsed.dataList.forEach(d => Store.addTransaction(d));
            renderAll();
            appendAIMsg("bot", `✅ Đã lưu thành công **${parsed.dataList.length}** khoản chi (tổng **${Store.formatMoney(totalAmt)}**) vào ví!`);
            showToast(`Đã lưu ${parsed.dataList.length} giao dịch!`, "fa-circle-check");
          });
        }
        return;
      }

      // Trường hợp 2: Giao dịch đơn lẻ
      if (parsed.data) {
        const d = parsed.data;
        const cat = Store.CATEGORIES.find(c => c.id === d.category) || { emoji: "✨", name: d.category };
        const authorMember = Store.getMemberName(d.author);
        const authorName = d.author === "wife" ? `👩 ${authorMember}` : `👨 ${authorMember}`;
        const walletName = d.wallet === "family" ? "Gia Đình" : "Cá Nhân";
        const childDisplayName = Store.getChildDisplayName(d.beneficiary);
        const childText = childDisplayName ? ` (${childDisplayName})` : "";
        const singleBtnId = "btn-save-ai-" + Date.now() + "-" + Math.floor(Math.random() * 10000);

        const confirmHtml = `
          Tôi đã nhận diện giao dịch này:
          <div class="ai-confirm-card">
            <strong>Số tiền: ${Store.formatMoney(d.amount)}</strong>
            <span>Danh mục: ${cat.emoji} ${cat.name}${childText}</span>
            <span>Người chi: ${authorName} • Ví: ${walletName}</span>
            <span>Ghi chú: "${d.note}"</span>
            <button class="btn-confirm-ai" id="${singleBtnId}">Xác Nhận & Lưu Ngay</button>
          </div>
        `;
        appendAIMsg("bot", confirmHtml);

        const singleBtn = document.getElementById(singleBtnId);
        if (singleBtn) {
          singleBtn.addEventListener("click", () => {
            if (singleBtn.disabled) return;
            singleBtn.disabled = true;
            singleBtn.innerHTML = `<i class="fa-solid fa-check"></i> Đã Lưu Vào Ví`;
            singleBtn.style.opacity = "0.7";
            singleBtn.style.cursor = "default";

            Store.addTransaction(d);
            renderAll();
            appendAIMsg("bot", `✅ Đã lưu thành công **${Store.formatMoney(d.amount)}** vào ví!`);
            showToast("AI đã lưu khoản chi thành công!");
          });
        }
        return;
      }
    }

    // 2. Nếu là câu hỏi -> Thử Gemini trước, nếu không có key -> Trả lời bằng Offline NLP
    const geminiAnswer = await AIAssistant.callGemini(prompt);
    if (geminiAnswer) {
      appendAIMsg("bot", geminiAnswer);
    } else {
      const offlineAnswer = AIAssistant.answerQueryOffline(prompt);
      appendAIMsg("bot", offlineAnswer);
    }
  }

  function appendAIMsg(sender, content) {
    const div = document.createElement("div");
    div.className = `ai-msg ${sender}`;
    div.innerHTML = `
      <div class="msg-avatar">${sender === "user" ? "👤" : "🤖"}</div>
      <div class="msg-bubble">${content.replace(/\n/g, "<br>")}</div>
    `;
    aiChatBody.appendChild(div);
    aiChatBody.scrollTop = aiChatBody.scrollHeight;
    return div;
  }

  // Nhận diện giọng nói (Speech to Text vi-VN)
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      btnVoiceInput.classList.add("recording");
      showToast("Đang lắng nghe giọng nói của bạn...", "fa-microphone");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      aiTextInput.value = transcript;
      handleAISubmit();
    };

    recognition.onerror = () => {
      btnVoiceInput.classList.remove("recording");
    };

    recognition.onend = () => {
      btnVoiceInput.classList.remove("recording");
    };

    btnVoiceInput.addEventListener("click", () => {
      try {
        recognition.start();
      } catch (e) {
        recognition.stop();
      }
    });
  } else {
    btnVoiceInput.style.display = "none";
  }

  // ==================== SYNC MODAL & MAGIC LINK ====================
  function setupSyncModal() {
    const curFam = Store.getCurrentFamily();
    const vaultId = curFam.vaultId || Store.state.settings.vaultId || "family";
    const shareUrl = `${window.location.origin}${window.location.pathname}#vault=${vaultId}&role=wife&fam=${encodeURIComponent(curFam.name)}`;
    syncShareUrl.value = shareUrl;

    btnOpenSync.onclick = () => syncModalOverlay.classList.add("active");
    btnCloseSyncModal.onclick = () => syncModalOverlay.classList.remove("active");
    syncModalOverlay.onclick = (e) => {
      if (e.target === syncModalOverlay) syncModalOverlay.classList.remove("active");
    };

    btnCopyShareUrl.onclick = () => {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Đã sao chép link Zalo! Hãy gửi cho vợ", "fa-clipboard-check");
      });
    };

    // Vẽ QR Code đơn giản lên Canvas
    drawSimpleQR(shareUrl);

    // Lưu cấu hình Supabase
    document.getElementById("btn-save-supabase-cfg")?.addEventListener("click", () => {
      const u = document.getElementById("cfg-supabase-url").value;
      const k = document.getElementById("cfg-supabase-key").value;
      if (u && k) {
        SupabaseSync.saveConfig(u, k);
        showToast("Đã lưu cấu hình Supabase!");
      }
    });

    // Lưu cấu hình Gemini
    document.getElementById("btn-save-gemini-cfg")?.addEventListener("click", () => {
      const k = document.getElementById("cfg-gemini-key").value;
      if (k) {
        localStorage.setItem("omniwallet_gemini_key", k.trim());
        showToast("Đã lưu Gemini API Key!");
      }
    });
  }

  function drawSimpleQR(text) {
    const canvas = document.getElementById("qr-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 180, 180);
    ctx.fillStyle = "#0f172a";
    // Pattern mô phỏng QR Code đẹp mắt
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if ((i + j) % 2 === 0 || (i === 0 || i === 8 || j === 0 || j === 8)) {
          ctx.fillRect(10 + i * 18, 10 + j * 18, 14, 14);
        }
      }
    }
  }

  // ==================== FAMILY & MEMBER MANAGEMENT MODAL ====================
  function setupFamilyModal() {
    if (!familyModalOverlay) return;

    const openModal = (tab = "families") => {
      familyModalOverlay.classList.add("active");
      switchFamilyTab(tab);
      renderFamilyList();
      renderChildrenManageList();
      // Pre-fill member names
      const inH = document.getElementById("input-rename-husband");
      const inW = document.getElementById("input-rename-wife");
      if (inH) inH.value = Store.getMemberName("husband");
      if (inW) inW.value = Store.getMemberName("wife");
    };

    btnHeaderFamily?.addEventListener("click", () => openModal("families"));
    btnOpenFamilyModal?.addEventListener("click", () => openModal("families"));
    btnCloseFamilyModal?.addEventListener("click", () => familyModalOverlay.classList.remove("active"));
    familyModalOverlay.addEventListener("click", (e) => {
      if (e.target === familyModalOverlay) familyModalOverlay.classList.remove("active");
    });

    // Tab switching inside modal
    const tabBtnFamilies = document.getElementById("tab-btn-families");
    const tabBtnMembers = document.getElementById("tab-btn-members");
    const paneFamilies = document.getElementById("pane-families");
    const paneMembers = document.getElementById("pane-members");

    function switchFamilyTab(tab) {
      if (tab === "families") {
        tabBtnFamilies?.classList.add("active");
        tabBtnMembers?.classList.remove("active");
        if (paneFamilies) paneFamilies.style.display = "block";
        if (paneMembers) paneMembers.style.display = "none";
      } else {
        tabBtnMembers?.classList.add("active");
        tabBtnFamilies?.classList.remove("active");
        if (paneMembers) paneMembers.style.display = "block";
        if (paneFamilies) paneFamilies.style.display = "none";
      }
    }

    tabBtnFamilies?.addEventListener("click", () => switchFamilyTab("families"));
    tabBtnMembers?.addEventListener("click", () => switchFamilyTab("members"));

    // 1. Render danh sách các gia đình
    function renderFamilyList() {
      const container = document.getElementById("family-list-container");
      const badge = document.getElementById("family-count-badge");
      if (!container) return;
      container.innerHTML = "";

      const families = Store.getFamilies();
      const currentFam = Store.getCurrentFamily();
      if (badge) badge.textContent = `${families.length} gia đình`;

      families.forEach(fam => {
        const isActive = fam.id === currentFam.id;
        const item = document.createElement("div");
        item.className = `family-card-item ${isActive ? "active" : ""}`;
        item.innerHTML = `
          <div class="fam-item-left">
            <div class="fam-icon-circle">🏡</div>
            <div class="fam-item-info">
              <h5>
                ${fam.name}
                ${isActive ? '<span class="fam-status-tag">Đang chọn</span>' : ""}
              </h5>
              <small><i class="fa-solid fa-key" style="font-size: 0.65rem;"></i> Mã ví: ${fam.vaultId || "default"}</small>
            </div>
          </div>
          <div class="fam-item-actions">
            ${!isActive ? `<button class="fam-switch-btn" data-id="${fam.id}"><i class="fa-solid fa-arrow-right-arrow-left"></i> Chọn</button>` : ""}
            <button class="fam-icon-action edit" data-id="${fam.id}" title="Đổi tên gia đình"><i class="fa-regular fa-pen-to-square"></i></button>
            ${families.length > 1 ? `<button class="fam-icon-action del" data-id="${fam.id}" title="Xóa gia đình"><i class="fa-regular fa-trash-can"></i></button>` : ""}
          </div>
        `;
        container.appendChild(item);
      });

      // Switch family click
      container.querySelectorAll(".fam-switch-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const switched = Store.switchFamily(id);
          if (switched) {
            renderFamilyList();
            renderDynamicUI();
            renderAll();
            setupSyncModal();
            showToast(`Đã chuyển sang: 🏡 ${switched.name}`, "fa-house-chimney");
          }
        });
      });

      // Rename family click
      container.querySelectorAll(".fam-icon-action.edit").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const fam = families.find(f => f.id === id);
          if (!fam) return;
          const newName = prompt(`Nhập tên mới cho gia đình "${fam.name}":`, fam.name);
          if (newName && newName.trim() && newName.trim() !== fam.name) {
            Store.renameFamily(id, newName.trim());
            renderFamilyList();
            renderDynamicUI();
            setupSyncModal();
            showToast(`Đã đổi tên thành "${newName.trim()}"`);
          }
        });
      });

      // Delete family click
      container.querySelectorAll(".fam-icon-action.del").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const fam = families.find(f => f.id === id);
          if (!fam) return;
          if (confirm(`Bạn có chắc muốn xóa gia đình "${fam.name}"?`)) {
            Store.deleteFamily(id);
            renderFamilyList();
            renderDynamicUI();
            renderAll();
            setupSyncModal();
            showToast(`Đã xóa gia đình "${fam.name}"`, "fa-trash");
          }
        });
      });
    }

    // 2. Tạo gia đình mới
    document.getElementById("btn-create-family")?.addEventListener("click", () => {
      const input = document.getElementById("input-new-family-name");
      const name = input ? input.value.trim() : "";
      if (!name) {
        alert("Vui lòng nhập tên cho gia đình mới (VD: Nhà Ngoại, Nhà Nội...)");
        input?.focus();
        return;
      }
      const newFam = Store.addFamily(name);
      if (newFam) {
        input.value = "";
        renderFamilyList();
        renderDynamicUI();
        renderAll();
        setupSyncModal();
        showToast(`Đã tạo gia đình "${newFam.name}" thành công!`, "fa-house-circle-check");
      }
    });

    // 3. Tham gia gia đình bằng mã ví
    document.getElementById("btn-join-family")?.addEventListener("click", () => {
      const inVault = document.getElementById("input-join-vault-id");
      const inName = document.getElementById("input-join-family-name");
      const vaultId = inVault ? inVault.value.trim() : "";
      const famName = inName && inName.value.trim() ? inName.value.trim() : "Gia Đình Đã Tham Gia";

      if (!vaultId) {
        alert("Vui lòng nhập mã Vault ID được chia sẻ từ người thân!");
        inVault?.focus();
        return;
      }

      const joinedFam = Store.addFamily(famName, vaultId);
      if (joinedFam) {
        if (inVault) inVault.value = "";
        if (inName) inName.value = "";
        renderFamilyList();
        renderDynamicUI();
        renderAll();
        setupSyncModal();
        showToast(`Đã tham gia gia đình "${joinedFam.name}"!`, "fa-link");
      }
    });

    // 4. Đổi tên thành viên (Chồng / Vợ)
    document.getElementById("btn-save-member-names")?.addEventListener("click", () => {
      const inH = document.getElementById("input-rename-husband");
      const inW = document.getElementById("input-rename-wife");
      const hVal = inH ? inH.value.trim() : "";
      const wVal = inW ? inW.value.trim() : "";

      if (hVal) Store.setMemberName("husband", hVal);
      if (wVal) Store.setMemberName("wife", wVal);

      updateAuthorUI();
      renderDynamicUI();
      renderAll();
      showToast("Đã lưu tên thành viên thành công!", "fa-floppy-disk");
    });

    // 5. Quản lý con cái (Danh sách bé)
    function renderChildrenManageList() {
      const list = document.getElementById("children-manage-list");
      const badge = document.getElementById("children-count-badge");
      if (!list) return;
      list.innerHTML = "";

      const children = Store.getChildren();
      if (badge) badge.textContent = `${children.length}`;

      if (children.length === 0) {
        list.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 0.5rem 0;">Chưa có thành viên con nào. Hãy thêm ở bên dưới!</div>`;
        return;
      }

      children.forEach(child => {
        const item = document.createElement("div");
        item.className = "child-manage-item";
        item.innerHTML = `
          <div class="child-item-left">
            <div class="child-avatar-pill">${child.avatar || "👶"}</div>
            <div class="child-item-info">
              <h5>${child.name}</h5>
              <small>${child.note || "Chi phí sinh hoạt, học tập"}</small>
            </div>
          </div>
          <div class="fam-item-actions">
            <button class="fam-icon-action edit" data-id="${child.id}" title="Sửa tên / ghi chú"><i class="fa-regular fa-pen-to-square"></i></button>
            <button class="fam-icon-action del" data-id="${child.id}" title="Xóa bé"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        `;
        list.appendChild(item);
      });

      // Edit child
      list.querySelectorAll(".fam-icon-action.edit").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const child = children.find(c => c.id === id);
          if (!child) return;
          const newName = prompt(`Nhập tên mới cho "${child.name}":`, child.name);
          if (newName && newName.trim()) {
            const newNote = prompt(`Nhập ghi chú cho "${newName.trim()}":`, child.note || "");
            Store.renameChild(id, newName.trim(), child.avatar, newNote !== null ? newNote : child.note);
            renderChildrenManageList();
            renderDynamicUI();
            renderAll();
            showToast(`Đã cập nhật thông tin "${newName.trim()}"!`);
          }
        });
      });

      // Delete child
      list.querySelectorAll(".fam-icon-action.del").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const child = children.find(c => c.id === id);
          if (!child) return;
          if (confirm(`Bạn có chắc muốn xóa "${child.name}" khỏi danh sách?`)) {
            Store.deleteChild(id);
            renderChildrenManageList();
            renderDynamicUI();
            renderAll();
            showToast(`Đã xóa "${child.name}"`, "fa-trash");
          }
        });
      });
    }

    // Avatar Picker
    let selectedAvatar = "👦";
    document.querySelectorAll(".avatar-pick-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".avatar-pick-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedAvatar = btn.getAttribute("data-emoji") || "👶";
      });
    });

    // Thêm bé mới
    document.getElementById("btn-add-child")?.addEventListener("click", () => {
      const inName = document.getElementById("input-new-child-name");
      const inNote = document.getElementById("input-new-child-note");
      const name = inName ? inName.value.trim() : "";
      const note = inNote ? inNote.value.trim() : "";

      if (!name) {
        alert("Vui lòng nhập tên (VD: Vừng, Bo, Bông...)");
        inName?.focus();
        return;
      }

      Store.addChild(name, selectedAvatar, note);
      if (inName) inName.value = "";
      if (inNote) inNote.value = "";
      renderChildrenManageList();
      renderDynamicUI();
      renderAll();
      showToast(`Đã thêm "${name}" vào gia đình!`, "fa-child");
    });
  }

  // ==================== THEME TOGGLE ====================
  const btnToggleTheme = document.getElementById("btn-toggle-theme");
  const themeIcon = document.getElementById("theme-icon");

  btnToggleTheme.addEventListener("click", () => {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    html.setAttribute("data-theme", isDark ? "light" : "dark");
    themeIcon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    const metaThemeColor = document.getElementById("meta-theme-color");
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", isDark ? "#f1f5f9" : "#070a12");
    }
    if (categoryChart) renderAnalytics();
  });

  // ==================== TOAST HELPER ====================
  function showToast(msg, icon = "fa-check") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  window.App = { renderAll, showToast };
});
