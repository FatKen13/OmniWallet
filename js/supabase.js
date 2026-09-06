/**
 * OmniWallet Supabase Realtime Connector
 * - Hỗ trợ đồng bộ Realtime tức thì qua mạng giữa 2 vợ chồng
 * - Hoạt động độc lập an toàn: Nếu chưa cấu hình, app vẫn chạy Local-first 100%
 */

const SupabaseSync = (() => {
  const URL_KEY = "omniwallet_sb_url";
  const KEY_KEY = "omniwallet_sb_key";

  let client = null;
  let channel = null;

  function init() {
    const url = localStorage.getItem(URL_KEY);
    const key = localStorage.getItem(KEY_KEY);

    if (url && key && window.supabase && typeof window.supabase.createClient === "function") {
      try {
        client = window.supabase.createClient(url, key);
        setupRealtimeSubscription();
        console.log("[Supabase] Đã kết nối Realtime Cloud thành công");
      } catch (e) {
        console.warn("[Supabase] Lỗi kết nối:", e);
      }
    }
  }

  function setupRealtimeSubscription() {
    if (!client) return;

    const vaultId = Store.state.settings.vaultId || "default";

    channel = client
      .channel(`vault_${vaultId}`)
      .on("broadcast", { event: "new_transaction" }, payload => {
        if (payload && payload.transaction) {
          // Nhận giao dịch từ máy vợ/chồng
          const exists = Store.state.transactions.some(t => t.id === payload.transaction.id);
          if (!exists) {
            Store.state.transactions.unshift(payload.transaction);
            Store.saveSettings();
            if (window.App && typeof window.App.renderAll === "function") {
              window.App.renderAll();
              window.App.showToast(`Đồng bộ: ${payload.transaction.author === "wife" ? "Vợ" : "Chồng"} vừa thêm khoản chi`, "fa-cloud-arrow-down");
            }
          }
        }
      })
      .subscribe();
  }

  function pushTransaction(tx) {
    if (!client || !channel) return;
    try {
      channel.send({
        type: "broadcast",
        event: "new_transaction",
        payload: { transaction: tx }
      });
    } catch (e) {
      console.warn("[Supabase] Lỗi push transaction:", e);
    }
  }

  function saveConfig(url, key) {
    localStorage.setItem(URL_KEY, url.trim());
    localStorage.setItem(KEY_KEY, key.trim());
    init();
  }

  return {
    init,
    pushTransaction,
    saveConfig
  };
})();
