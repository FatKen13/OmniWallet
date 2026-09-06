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

  const authorFilterChips = document.querySelectorAll("#author-filter-chips .filter-chip");
  const childFilterChips = document.querySelectorAll("#child-filter-chips .filter-chip");

  let categoryChart = null;

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
  renderAll();
  populateCategoryGrid();
  updateAuthorUI();
  setupSyncModal();

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
    showToast(`Đã chuyển sang: ${Store.state.settings.activeAuthor === "husband" ? "👨 Chồng" : "👩 Vợ"}`);
  });

  function updateAuthorUI() {
    const author = Store.state.settings.activeAuthor;
    if (author === "husband") {
      authorIcon.textContent = "👨";
      authorName.textContent = "Chồng (Tôi)";
      btnToggleAuthor.style.borderColor = "var(--husband-color)";
    } else {
      authorIcon.textContent = "👩";
      authorName.textContent = "Vợ (Tôi)";
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
      budgetText.textContent = `${summary.budgetPercent}% (Đang ẩn)`;
    } else {
      displayBalance.textContent = Store.formatMoney(summary.netBalance);
      displayIncome.textContent = "+" + Store.formatMoney(summary.totalIncome);
      displayExpense.textContent = "-" + Store.formatMoney(summary.totalExpense);
      budgetText.textContent = `${summary.actualPercent || summary.budgetPercent}% (${Store.formatMoney(summary.totalExpense)} / ${Store.formatMoney(summary.budget)})`;
    }

    budgetBar.style.width = summary.budgetPercent + "%";
    if (summary.budgetPercent > 90) {
      budgetBar.style.background = "linear-gradient(90deg, #f59e0b, #ef4444)";
    } else {
      budgetBar.style.background = "linear-gradient(90deg, #10b981, #f59e0b)";
    }
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
      const authorClass = t.author === "wife" ? "wife" : "husband";
      const authorText = t.author === "wife" ? "👩 Vợ" : "👨 Chồng";
      const isExpense = t.type === "expense";
      const timeText = formatTxTime(t.date);

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
              ${t.beneficiary !== "none" ? `<span class="tx-badge child">Bé ${t.beneficiary}</span>` : ""}
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

    // Cập nhật thẻ con cái
    const boEl = document.getElementById("child-amount-bo");
    const bongEl = document.getElementById("child-amount-bong");
    if (boEl) boEl.textContent = Store.formatMoney(summary.childBo);
    if (bongEl) bongEl.textContent = Store.formatMoney(summary.childBong);

    // Cập nhật thanh so sánh Chồng vs Vợ
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

    // Cập nhật Chart.js
    const catData = Store.getCategoryBreakdown();
    const ctx = document.getElementById("categoryChart");
    if (!ctx) return;

    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }

    if (catData.data.length === 0) {
      return;
    }

    if (typeof Chart === "undefined") {
      return;
    }

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

  // Toggle Analytics View
  btnToggleAnalytics.addEventListener("click", () => {
    const isHidden = analyticsView.style.display === "none";
    analyticsView.style.display = isHidden ? "flex" : "none";
    analyticsBtnText.textContent = isHidden ? "Thu Gọn" : "Báo Cáo";
    if (isHidden) {
      renderAnalytics();
    }
  });

  // Bộ lọc nhanh
  authorFilterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      authorFilterChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      Store.state.settings.authorFilter = chip.getAttribute("data-author");
      renderTransactions();
    });
  });

  childFilterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      childFilterChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      Store.state.settings.childFilter = chip.getAttribute("data-child");
      renderTransactions();
    });
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
      addModalOverlay.classList.remove("active");
      aiModalOverlay.classList.remove("active");
      syncModalOverlay.classList.remove("active");
    }
  });

  // Child select in sheet
  document.querySelectorAll(".child-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".child-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
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

    if (parsed.isCommand && parsed.data) {
      const d = parsed.data;
      const catName = Store.CATEGORIES.find(c => c.id === d.category)?.name || d.category;
      const authorName = d.author === "wife" ? "Vợ" : "Chồng";
      const walletName = d.wallet === "family" ? "Gia Đình" : "Cá Nhân";
      const childText = d.beneficiary !== "none" ? `(Bé ${d.beneficiary})` : "";

      const confirmHtml = `
        Tôi đã nhận diện giao dịch này:
        <div class="ai-confirm-card">
          <strong>Số tiền: ${Store.formatMoney(d.amount)}</strong>
          <span>Danh mục: ${catName} ${childText}</span>
          <span>Người chi: ${authorName} • Ví: ${walletName}</span>
          <span>Ghi chú: "${d.note}"</span>
          <button class="btn-confirm-ai" id="btn-save-ai-parsed">Xác Nhận & Lưu Ngay</button>
        </div>
      `;
      appendAIMsg("bot", confirmHtml);

      document.getElementById("btn-save-ai-parsed")?.addEventListener("click", () => {
        Store.addTransaction(d);
        renderAll();
        appendAIMsg("bot", `✅ Đã lưu thành công **${Store.formatMoney(d.amount)}** vào ví!`);
        showToast("AI đã lưu khoản chi thành công!");
      });
      return;
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
    const vaultId = Store.state.settings.vaultId || "family";
    const shareUrl = `${window.location.origin}${window.location.pathname}#vault=${vaultId}&role=wife`;
    syncShareUrl.value = shareUrl;

    btnOpenSync.addEventListener("click", () => syncModalOverlay.classList.add("active"));
    btnCloseSyncModal.addEventListener("click", () => syncModalOverlay.classList.remove("active"));
    syncModalOverlay.addEventListener("click", (e) => {
      if (e.target === syncModalOverlay) syncModalOverlay.classList.remove("active");
    });

    btnCopyShareUrl.addEventListener("click", () => {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Đã sao chép link Zalo! Hãy gửi cho vợ", "fa-clipboard-check");
      });
    });

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
