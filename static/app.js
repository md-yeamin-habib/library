// =================== GLOBAL STATE ===================
let authToken = null;
let userRole = null;

// Navigation stack (tiered flow)
let navStack = ["home-screen"];

// =================== SYSTEM DATE INIT ===================
let systemDateInitialized = false;

// =================== SCREEN UTILS ===================
function resetScreen(screenId) {
  const screen = document.getElementById(screenId);
  if (!screen) return;

  // Clear inputs
  screen.querySelectorAll("input").forEach(i => {
    if (i.type !== "checkbox" && i.type !== "radio") {
      i.value = "";
    } else {
      i.checked = false;
    }
  });

  // Clear messages / labels
  screen.querySelectorAll("p").forEach(p => {
    if (!p.classList.contains("persist-msg")) {
      p.textContent = "";
    }
  });
}

// Show target screen and hide others
function showScreen(screenId) {
  const current = navStack[navStack.length - 1];

  // Avoid duplicate pushes
  if (current !== screenId) {
    navStack.push(screenId);
  }

  document.querySelectorAll("section").forEach(sec => {
    sec.hidden = true;
  });

  const target = document.getElementById(screenId);
  if (target) {
    target.hidden = false;
    resetScreen(screenId);
  } else {
    console.warn("Screen not found:", screenId);
  }
}

// Go back to previous screen
function goBack() {
  if (navStack.length <= 1) return;

  // Remove current
  navStack.pop();

  const prev = navStack[navStack.length - 1];
  document.querySelectorAll("section").forEach(sec => sec.hidden = true);

  const target = document.getElementById(prev);
  if (target) {
    resetScreen(prev);
    target.hidden = false;
  }
}

// Hard reset after admin/student logout
function resetNavToHome() {
  navStack = ["home-screen"];
  document.querySelectorAll("section").forEach(sec => sec.hidden = true);

  const target = document.getElementById("home-screen");
  if (target) target.hidden = false;
}

// =================== SYSTEM DATE RESET ON STARTUP ===================
async function initSystemDateOnce() {
  if (systemDateInitialized) return;

  try {
    await fetch("http://127.0.0.1:5000/system/reset-date", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ source: "AUTO" })
    });

    systemDateInitialized = true;
    console.log("System date reset on app startup");
  } catch (err) {
    console.error("Failed to reset system date on startup:", err);
  }
}

// =================== GLOBAL BACK BUTTON HANDLER ===================
document.addEventListener("click", (e) => {
  const backBtn = e.target.closest(".back-btn");
  if (!backBtn) return;
  goBack();
});

// =================== GLOBAL MESSAGE BOX ===================
function showMessage(text, type = "success", timeout = 1200) {
  const overlay = document.getElementById("messagebox-overlay");
  const box = document.getElementById("messagebox");
  const msg = document.getElementById("messagebox-text");
  const ok = document.getElementById("messagebox-ok");

  // Reset any previous timer
  if (showMessage._timer) {
    clearTimeout(showMessage._timer);
  }

  box.className = type;
  msg.textContent = text;
  overlay.hidden = false;

  // Manual close
  ok.onclick = () => {
    overlay.hidden = true;
    clearTimeout(showMessage._timer);
  };

  // Auto close after timeout
  showMessage._timer = setTimeout(() => {
    overlay.hidden = true;
  }, timeout);
}

// =================== HOME SCREEN ===================
document.addEventListener("DOMContentLoaded", async () => {
  await initSystemDateOnce();
  const exitBtn = document.getElementById("exit-app");
  const adminLoginBtn = document.getElementById("go-admin-login");
  const studentLoginBtn = document.getElementById("go-student-login");

  const overlay = document.getElementById("exit-app-overlay");
  const confirmBtn = document.getElementById("exit-app-confirm");
  const cancelBtn = document.getElementById("exit-app-cancel");

  if (!exitBtn) return;

  exitBtn.addEventListener("click", () => {
    overlay.hidden = false;
  });

  confirmBtn.addEventListener("click", () => {
    window.close();
  });

  cancelBtn.addEventListener("click", () => {
    overlay.hidden = true;
  });

  if (adminLoginBtn) {
    adminLoginBtn.addEventListener("click", () => {
      showScreen("admin-login-screen");
    });
  }

  if (studentLoginBtn) {
    studentLoginBtn.addEventListener("click", () => {
      showScreen("student-login-screen");
    });
  }

  // Initial screen
  document.querySelectorAll("section").forEach(sec => sec.hidden = true);
  document.getElementById("home-screen").hidden = false;
});


// =================== ADMIN LOGIN ===================
document.addEventListener("DOMContentLoaded", () => {
  const adminPasswordInput = document.getElementById("admin-password");
  const adminLoginBtn = document.getElementById("admin-login-btn");
  const adminLoginMsg = document.getElementById("admin-login-msg");

  // 🔐 Log In button → Flask API
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener("click", async () => {
      const password = adminPasswordInput.value.trim();
      adminLoginMsg.textContent = "";

      if (!password) {
        adminLoginMsg.textContent = "Please enter a password.";
        adminLoginMsg.style.color = "red";
        return;
      }

      try {
        adminLoginBtn.disabled = true;
        adminLoginBtn.textContent = "Logging in...";

        const res = await fetch("http://127.0.0.1:5000/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password })
        });

        const data = await res.json();

        if (data.success) {
          authToken = data.token;
          userRole = "admin";
          showMessage("Logged in as Admin", "success");
          adminPasswordInput.value = "";
          setTimeout(() => {
            adminLoginMsg.textContent = "";
            showScreen("admin-dashboard");
          }, 1200);
        } else {
          adminLoginMsg.textContent = data.message || "Login failed.";
          adminLoginMsg.style.color = "red";
          adminPasswordInput.value = ""; 
        }

      } catch (err) {
        console.error("Admin login error:", err);
        adminLoginMsg.textContent = "Server error. Try again.";
        adminLoginMsg.style.color = "red";
      } finally {
        adminLoginBtn.disabled = false;
        adminLoginBtn.textContent = "Log In";
      }
    });
  }
});


// =================== ADMIN DASHBOARD ===================
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("admin-logout-btn");
  const changePasswordBtn = document.getElementById("admin-change-password-btn");
  const manageStockBtn = document.getElementById("admin-manage-stock-btn");
  const manageStudentsBtn = document.getElementById("admin-manage-students-btn");
  const processRequestsBtn = document.getElementById("admin-process-requests-btn");
  const viewLogBtn = document.getElementById("admin-view-log-btn");
  const clearDataBtn = document.getElementById("admin-clear-data-btn");

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", () => {
      showScreen("admin-change-password");
    });
  }

  if (manageStockBtn) {
    manageStockBtn.addEventListener("click", () => {
      showScreen("admin-manage-stock");
      onAdminManageStockOpen();
    });
  }

  if (manageStudentsBtn) {
    manageStudentsBtn.addEventListener("click", () => {
      showScreen("admin-manage-students");
      onAdminManageStudentsOpen()
    });
  }
  if (processRequestsBtn) {
    processRequestsBtn.addEventListener("click", () => { 
      showScreen("admin-process-requests");
      onAdminProcessRequestsOpen();
    });
  }

  if (viewLogBtn) {
    viewLogBtn.addEventListener("click", () => {
      showScreen("admin-view-log");
      onAdminViewLogOpen();
    });
  }

  if (clearDataBtn) {
    clearDataBtn.addEventListener("click", () => {
      showScreen("admin-clear-data");
      onAdminClearDataOpen();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (!authToken) return;

      try {
        await fetch("http://127.0.0.1:5000/admin/logout", {
          method: "POST",
          headers: { "Authorization": authToken }
        });
      } catch (err) {
        console.warn("Logout failed:", err);
      }

      authToken = null;
      userRole = null;

      showMessage("Logged out successfully.", "success");
      setTimeout(() => {
        resetNavToHome();
      }, 1200);
    });
  }
});


// =================== ADMIN: CHANGE PASSWORD ===================
document.addEventListener("DOMContentLoaded", () => {
  const screen = document.getElementById("admin-change-password");
  if (!screen) return;

  const oldInput = document.getElementById("old-password");
  const newInput = document.getElementById("new-password");
  const confirmInput = document.getElementById("confirm-password");
  const confirmBtn = document.getElementById("confirm-change-password-btn");
  const cancelBtn = document.getElementById("cancel-change-password-btn");

  let msg = screen.querySelector(".change-password-msg");
  if (!msg) {
    msg = document.createElement("p");
    msg.className = "change-password-msg";
    screen.appendChild(msg);
  }

  function clearForm() {
    oldInput.value = "";
    newInput.value = "";
    confirmInput.value = "";
    msg.textContent = "";
  }

  // ❌ Cancel → Reset fields only
  cancelBtn?.addEventListener("click", () => {
    clearForm();
  });

  // ✅ Confirm → API call
  confirmBtn?.addEventListener("click", async () => {
    const oldPassword = oldInput.value.trim();
    const newPassword = newInput.value.trim();
    const confirmPassword = confirmInput.value.trim();

    msg.textContent = "";
    msg.style.color = "red";

    if (!oldPassword || !newPassword || !confirmPassword) {
      msg.textContent = "All fields are required.";
      return;
    }

    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Processing...";

      const res = await fetch("http://127.0.0.1:5000/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authToken
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await res.json();

      msg.textContent = data.message || "Unknown error";
      msg.style.color = data.success ? "green" : "red";
      oldInput.value = "";
      newInput.value = "";
      confirmInput.value = "";

      if (data.success) {
        authToken = null;
        userRole = null;

        clearForm();
        showMessage("Password updated successfully.", "success");
        setTimeout(() => {
          resetNavToAdminLogin();
        }, 1200);
      }

    } catch (err) {
      console.error("Change password error:", err);
      msg.textContent = "Server error. Try again.";
      msg.style.color = "red";
      oldInput.value = "";
      newInput.value = "";
      confirmInput.value = "";

    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirm";
    }
  });
});

// ================= ADMIN: MANAGE STOCK =================
document.addEventListener("DOMContentLoaded", () => {
  const screen = document.getElementById("admin-manage-stock");
  if (!screen) return;

  const searchInput = document.getElementById("stock-search");
  const searchBtn = document.getElementById("stock-search-btn");
  const searchColumn = document.getElementById("stock-search-column");
  const tableBody = document.getElementById("stock-table-body");
  const emptyMsg = document.getElementById("stock-empty-msg");

  const popup = document.getElementById("stock-add-popup");
  const popupName = document.getElementById("stock-add-name");
  const popupQty = document.getElementById("stock-add-qty");
  const popupConfirm = document.getElementById("stock-add-confirm");
  const popupCancel = document.getElementById("stock-add-cancel");
  const popupStatus = document.getElementById("stock-add-status");

  const ctxMenu = document.getElementById("stock-context-menu");
  const ctxIncrease = document.getElementById("ctx-increase");
  const ctxDecrease = document.getElementById("ctx-decrease");
  const ctxDelete = document.getElementById("ctx-delete");

  const modifyOverlay = document.getElementById("stock-modify-overlay");
  const modifyTitle = document.getElementById("stock-modify-title");
  const modifyBookLabel = document.getElementById("stock-modify-book");
  const modifyQtyInput = document.getElementById("stock-modify-qty");
  const modifyConfirmBtn = document.getElementById("stock-modify-confirm");
  const modifyCancelBtn = document.getElementById("stock-modify-cancel");
  const modifyMsg = document.getElementById("stock-modify-msg");

  const deleteOverlay = document.getElementById("stock-delete-overlay");
  const deleteBookLabel = document.getElementById("stock-delete-book");
  const deleteConfirmBtn = document.getElementById("stock-delete-confirm");
  const deleteCancelBtn = document.getElementById("stock-delete-cancel");
  const deleteMsg = document.getElementById("stock-delete-msg");

  let stockData = [];
  let sortCol = "book_id";
  let sortAsc = true;
  let noResultsMode = false;
  let ctxBook = null;
  let modifyMode = null;

  // ---------------- Reset UI State ----------------
  function resetUIState() {
    searchInput.value = "";
    searchColumn.value = "name";
    sortCol = "book_id";
    sortAsc = true;
    noResultsMode = false;
    hasLoadedOnce = false;
    ctxBook = null;

    screen.querySelectorAll(".sort-indicator").forEach(i => i.textContent = "-");
    const firstHeader = screen.querySelector('th[data-col="book_id"] .sort-indicator');
    if (firstHeader) firstHeader.textContent = "▲";

    emptyMsg.hidden = true;
    emptyMsg.textContent = "Book not found";
    searchBtn.textContent = "🔍";
    tableBody.innerHTML = "";
  }

  // ---------------- Load Stock ----------------
  async function loadStock() {
    if (!authToken) return;

    try {
      const res = await fetch("http://127.0.0.1:5000/admin/books", {
        headers: { Authorization: authToken }
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Load failed");

      stockData = Array.isArray(data.data) ? data.data : [];
      applyFiltersAndRender();

    } catch (err) {
      console.error("Stock load error:", err);
      tableBody.innerHTML = "";
      emptyMsg.hidden = false;
      emptyMsg.textContent = "Unable to load stock.";
      searchBtn.textContent = "🔍";
    }
  }

  // ---------------- Render Table ----------------
  function renderTable(data) {
    tableBody.innerHTML = "";

    if (!data.length) {
      emptyMsg.hidden = false;
      emptyMsg.textContent = "Book not found";
      searchBtn.textContent = "➕";
      noResultsMode = true;
      return;
   }

    emptyMsg.hidden = true;
    searchBtn.textContent = "🔍";
    noResultsMode = false;

    data.forEach(b => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${b.book_id}</td>
        <td>${b.name}</td>
        <td>${b.current}</td>
        <td>${b.max}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // ---------------- Filter + Sort ----------------
  const numericColumns = new Set(["current", "max"]);

  function applyFiltersAndRender() {
    const term = searchInput.value.trim();
    const col = searchColumn.value;

    let result = [...stockData];

    // ---------- FILTER ----------
    if (term) {
      result = result.filter(b => {
        const value = b[col];

        // Numeric query search
        if (numericColumns.has(col)) {
          const num = Number(value);
          if (Number.isNaN(num)) return false;

          const match = term.match(/^(>=|<=|>|<|=)?\s*(\d+)$/);
          if (!match) return false;

          const op = match[1] || "=";
          const target = Number(match[2]);

          switch (op) {
            case ">": return num > target;
            case ">=": return num >= target;
            case "<": return num < target;
            case "<=": return num <= target;
            case "=": return num === target;
            default: return false;
         }
        }

        // String search
        return String(value ?? "")
          .toLowerCase()
          .includes(term.toLowerCase());
      });
   }

    // ---------- SORT ----------
    result.sort((a, b) => {
      let x = a[sortCol];
      let y = b[sortCol];

      if (x === undefined || y === undefined) return 0;

      if (numericColumns.has(sortCol)) {
        return sortAsc ? x - y : y - x;
     }

      x = String(x).toLowerCase();
      y = String(y).toLowerCase();
      return sortAsc
        ? x.localeCompare(y)
        : y.localeCompare(x);
    });

    renderTable(result);
  }

  // ---------------- Sorting ----------------
  screen.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      sortAsc = sortCol === col ? !sortAsc : true;
      sortCol = col;

      screen.querySelectorAll(".sort-indicator").forEach(i => (i.textContent = "-"));
      th.querySelector(".sort-indicator").textContent = sortAsc ? "▲" : "▼";

      applyFiltersAndRender();
    });
  });

  // ---------------- Search ----------------
  searchBtn.addEventListener("click", () => {
    if (noResultsMode) {
      popup.hidden = false;
      popupName.value = searchInput.value.trim();
      popupQty.value = "";
      popupStatus.textContent = "";
      popupStatus.style.color = "red";
      return;
    }
    applyFiltersAndRender();
  });

  searchInput.addEventListener("input", applyFiltersAndRender);

  // ---------------- Add Book Popup ----------------
  popupCancel.addEventListener("click", () => {
    popup.hidden = true;
    popupStatus.textContent = "";
    popupName.value = "";
    popupQty.value = "";
  });

  popupConfirm.addEventListener("click", async () => {
    const name = popupName.value.trim();
    const qty = popupQty.value.trim();
    popupStatus.style.color = "red";

    if (!name || !qty) {
      popupStatus.textContent = "Both fields are required.";
      return;
    }

    if (!/^\d+$/.test(qty)) {
      popupStatus.textContent = "Quantity must be a number.";
      return;
    }

    try {
      popupConfirm.disabled = true;
      popupConfirm.textContent = "Adding...";

      const res = await fetch("http://127.0.0.1:5000/admin/books/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authToken
        },
        body: JSON.stringify({ name, qty })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Add failed");

      popupStatus.style.color = "green";
      popupStatus.textContent = "Book added successfully.";

      setTimeout(async () => {
        popup.hidden = true;
        popupName.value = "";
        popupQty.value = "";
        popupStatus.textContent = "";

        resetUIState();
        await loadStock();
      }, 800);

    } catch (err) {
      console.error("Add book error:", err);
      popupStatus.textContent = err.message || "Server error";
    } finally {
      popupConfirm.disabled = false;
      popupConfirm.textContent = "Add";
    }
  });

  // ---------------- Context Menu ----------------
  document.addEventListener("click", () => {
    ctxMenu.hidden = true;
  });

  tableBody.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    const row = e.target.closest("tr");
    if (!row) return;

    const cells = row.children;
    ctxBook = {
      book_id: cells[0].textContent,
      name: cells[1].textContent,
      current: parseInt(cells[2].textContent),
      max: parseInt(cells[3].textContent)
    };

    ctxMenu.style.left = `${e.pageX}px`;
    ctxMenu.style.top = `${e.pageY}px`;
    ctxMenu.hidden = false;
  });

  // ---------------- Modify Popup ----------------
  function openModifyPopup(mode) {
    if (!ctxBook) return;

    modifyMode = mode;
    modifyTitle.textContent = mode === "add" ? "Increase Stock" : "Decrease Stock";
    modifyBookLabel.textContent = `${ctxBook.name} (${ctxBook.book_id})`;
    modifyQtyInput.value = "";
    modifyMsg.textContent = "";
    modifyMsg.style.color = "#e74c3c";
    modifyOverlay.hidden = false;
    modifyQtyInput.focus();
  }

  function closeModifyPopup() {
    modifyOverlay.hidden = true;
    modifyQtyInput.value = "";
    modifyMsg.textContent = "";
    modifyMode = null;
  }

  modifyConfirmBtn.addEventListener("click", async () => {
    const qty = parseInt(modifyQtyInput.value, 10);
    modifyMsg.textContent = "";
    modifyMsg.style.color = "#e74c3c";

    if (!qty || qty <= 0) {
      modifyMsg.textContent = "Please enter a valid quantity.";
      return;
    }

    try {
      modifyConfirmBtn.disabled = true;
      modifyConfirmBtn.textContent = "Processing...";

      const res = await fetch("http://127.0.0.1:5000/admin/books/modify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authToken
        },
        body: JSON.stringify({
          book_id: ctxBook.book_id,
          type: modifyMode,
          qty: qty
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Update failed");

      modifyMsg.textContent = "Stock updated successfully.";
      modifyMsg.style.color = "green";

      setTimeout(async () => {
        closeModifyPopup();
        await loadStock();
      }, 700);

    } catch (err) {
      console.error("Modify stock error:", err);
      modifyMsg.textContent = err.message || "Server error.";
    } finally {
      modifyConfirmBtn.disabled = false;
      modifyConfirmBtn.textContent = "Confirm";
    }
  });

  modifyCancelBtn.addEventListener("click", closeModifyPopup);

  ctxIncrease.addEventListener("click", () => {
    ctxMenu.hidden = true;
    openModifyPopup("add");
  });

  ctxDecrease.addEventListener("click", () => {
    ctxMenu.hidden = true;
    openModifyPopup("reduce");
  });

  ctxDelete.addEventListener("click", () => {
    ctxMenu.hidden = true;
    openDeletePopup();   // ✅ Instead of direct delete
  });

  deleteCancelBtn.addEventListener("click", () => {
    closeDeletePopup();
  });

  // ---------------- Delete Book ----------------
  deleteConfirmBtn.addEventListener("click", async () => {
    if (!ctxBook) return;

    deleteMsg.textContent = "Deleting book...";
    deleteMsg.style.color = "orange";

    try {
      deleteConfirmBtn.disabled = true;

      const res = await fetch("http://127.0.0.1:5000/admin/books/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authToken
        },
        body: JSON.stringify({
          book_id: ctxBook.book_id,
          confirm: true
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Delete failed");

      deleteMsg.textContent = "Book deleted successfully.";
      deleteMsg.style.color = "green";

      setTimeout(() => {
        closeDeletePopup();
        ctxBook = null;
        loadStock();   // refresh table
      }, 700);

    } catch (err) {
      console.error("Delete error:", err);
      deleteMsg.textContent = err.message || "Server error.";
    } finally {
      deleteConfirmBtn.disabled = false;
    }
  });
  
  function openDeletePopup() {
    if (!ctxBook) return;

    deleteBookLabel.textContent = `${ctxBook.name} (${ctxBook.book_id})`;
    deleteMsg.textContent = "";
    deleteMsg.style.color = "#e74c3c";
    deleteOverlay.hidden = false; 
  }

  function closeDeletePopup() {
    deleteOverlay.hidden = true;
    deleteMsg.textContent = "";
  }

  // ---------------- Screen Hook ----------------
  window.onAdminManageStockOpen = async () => {
    ctxBook = null;
    stockData = [];
    filteredData = [];
    hasLoadedOnce = false;

    resetUIState();
    await loadStock();
  };
});

// ================= ADMIN: MANAGE STUDENTS =================
document.addEventListener("DOMContentLoaded", () => {
  const screen = document.getElementById("admin-manage-students");
  if (!screen) return;

  const searchInput = document.getElementById("student-search");
  const searchColumn = document.getElementById("student-search-column");
  const tableBody = document.getElementById("students-table-body");
  const emptyMsg = document.getElementById("student-empty-msg");

  const ctxMenu = document.getElementById("students-context-menu");
  const ctxView = document.getElementById("ctx-view-history");
  const ctxDelete = document.getElementById("ctx-delete-student");

  const deleteOverlay = document.getElementById("student-delete-overlay");
  const deleteName = document.getElementById("student-delete-name");
  const deleteConfirm = document.getElementById("student-delete-confirm");
  const deleteCancel = document.getElementById("student-delete-cancel");
  const deleteMsg = document.getElementById("student-delete-msg");

  let students = [];
  let filtered = [];
  let sortCol = "user_id";
  let sortAsc = true;
  let ctxStudent = null;

  function resetUI() {
    searchInput.value = "";
    searchColumn.value = "name";
    sortCol = "user_id";
    sortAsc = true;
    students = [];
    filtered = [];
    tableBody.innerHTML = "";
    emptyMsg.hidden = true;

    screen.querySelectorAll(".sort-indicator").forEach(i => i.textContent = "-");
    const first = screen.querySelector('th[data-col="user_id"] .sort-indicator');
    if (first) first.textContent = "▲";
  }

  // ---------------- Load Students ----------------
  async function loadStudents() {
    if (!authToken) return;

    try {
      const res = await fetch("http://127.0.0.1:5000/admin/students", {
        headers: { Authorization: authToken }
      });

      const data = await res.json();
      if (!data.success) throw new Error();

      students = Array.isArray(data.data) ? data.data : [];
      applyFilters();

    } catch {
      emptyMsg.hidden = false;
      emptyMsg.textContent = "Failed to load students.";
   }
  }

  // ---------------- Render Table ----------------
  function render(data) {
    tableBody.innerHTML = "";

    if (!data.length) {
      emptyMsg.hidden = false;
      emptyMsg.textContent = "No student found";
      return;
   }

    emptyMsg.hidden = true;

    data.forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.user_id}</td>
        <td>${s.name}</td>
        <td>${s.pending_books}</td>
        <td>${s.total_borrowed}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // ---------------- Filter + Sort ----------------
  const numericColumns = new Set(["pending_books", "total_borrowed"]);

  function applyFilters() {
    const term = searchInput.value.trim();
    const col = searchColumn.value;

    let result = [...students];

    // ---------- FILTER ----------
    if (term) {
      result = result.filter(s => {
        const value = s[col];

        // Numeric query search
        if (numericColumns.has(col)) {
          const num = Number(value);
          if (Number.isNaN(num)) return false;

          const match = term.match(/^(>=|<=|!=|>|<|=)?\s*(\d+)$/);
          if (!match) return false;

          const op = match[1] || "=";
          const target = Number(match[2]);

          switch (op) {
            case ">":  return num > target;
            case ">=": return num >= target;
            case "<":  return num < target;
            case "<=": return num <= target;
            case "!=": return num !== target;
            case "=":  return num === target;
            default:   return false;
          }
        }

        // String search
        return String(value ?? "")
          .toLowerCase()
          .includes(term.toLowerCase());
      });
    }

    // ---------- SORT ----------
    result.sort((a, b) => {
      let x = a[sortCol];
      let y = b[sortCol];
      if (x === undefined || y === undefined) return 0;

      if (numericColumns.has(sortCol)) {
        return sortAsc ? Number(x) - Number(y) : Number(y) - Number(x);
      }

      x = String(x).toLowerCase();
      y = String(y).toLowerCase();
      return sortAsc
        ? x.localeCompare(y)
        : y.localeCompare(x);
    });

    render(result);
  }

  screen.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      sortAsc = sortCol === col ? !sortAsc : true;
      sortCol = col;

      screen.querySelectorAll(".sort-indicator").forEach(i => i.textContent = "-");
      th.querySelector(".sort-indicator").textContent = sortAsc ? "▲" : "▼";

      applyFilters();
    });
  });

  searchInput.addEventListener("input", applyFilters);

  tableBody.addEventListener("contextmenu", e => {
    e.preventDefault();
    const row = e.target.closest("tr");
    if (!row) return;

    const cells = row.children;
    ctxStudent = {
      user_id: cells[0].textContent,
      name: cells[1].textContent
    };

    ctxMenu.style.left = `${e.pageX}px`;
    ctxMenu.style.top = `${e.pageY}px`;
    ctxMenu.hidden = false;
  });

  document.addEventListener("click", () => ctxMenu.hidden = true);

  // ================= STUDENT HISTORY POPUP =================
  ctxView.addEventListener("click", async () => {
  ctxMenu.hidden = true;

  const width = 900, height = 500;
  const left = (screen.width - width) / 2;
  const top = (screen.height - height) / 2;

  const popup = window.open(
    "",
    `history-${ctxStudent.user_id}`,
    `width=${width},height=${height},top=${top},left=${left},resizable,scrollbars`
  );

  if (!popup) {
    showMessage("Popup blocked! Please allow popups for this site.", "error");
    return;
  }

popup.document.body.innerHTML = `
  <style>
  body {
    font-family: Arial, sans-serif;
    margin: 20px;
    background-color: #f4f7fc;
    overflow: hidden;
  }

  .popup-close-btn {
    position: absolute;
    top: 14px;
    right: 16px;
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 50%;
    width: 34px;
    height: 34px;
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    transition: all 0.18s;
  }
  .popup-close-btn:hover {
    background: #c0392b;
    transform: scale(1.08);
  }

  .popup-history-title {
    margin: 55px 40px 28px;
    font-size: 1.7em;
    text-align: center;
    color: #222;
  }

  .popup-history-wrapper {
    max-width: 940px;
    margin: 0 auto;
  }

  .popup-history-table-wrapper {
      max-height: 520px;
      overflow-y: auto;
      overflow-x: hidden;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 6px 24px rgba(0,0,0,0.08);
      border: 1px solid #dfe5ee;
    }

    table {
      width: 100%;
      border-collapse: collapse;
   }

    thead th {
      position: sticky;
      top: 0;
      background: #eef2f9;
      color: #444;
      font-weight: 600;
      z-index: 2;
      text-align: left;
   }

    th, td {
      padding: 14px 12px;
      font-size: 0.96em;
      text-align: left;
    }

    td {
      border-top: 1px solid #eef2f9;
    }

    tbody tr:hover {
      background: #f5f9ff;
      transition: background 0.14s;
    }

    .student-history-empty {
      position: absolute;
      top: 55%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #888;
      font-size: 1.15em;
    }

    /* Custom scrollbar */
    .popup-history-table-wrapper::-webkit-scrollbar {
      width: 10px;
    }
    .popup-history-table-wrapper::-webkit-scrollbar-track {
      background: #f1f3f7;
      border-radius: 10px;
    }
    .popup-history-table-wrapper::-webkit-scrollbar-thumb {
      background: #b8c1d3;
      border-radius: 10px;
    }
    .popup-history-table-wrapper::-webkit-scrollbar-thumb:hover {
      background: #8a96b0;
    }
  </style>

  <button class="popup-close-btn" onclick="window.close()">✖</button>

  <h2 class="popup-history-title">Reading History — ${ctxStudent.user_id}</h2>

  <div class="popup-history-wrapper">
    <div class="popup-history-table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Book ID</th>
            <th>Book Name</th>
            <th>Issue Date</th>
            <th>Due Date</th>
            <th>Return Date</th>
          </tr>
        </thead>
        <tbody id="popup-history-body"></tbody>
      </table>
      <div class="student-history-empty" id="student-history-empty" hidden>
       No reading history found
      </div>
    </div>
  </div>
`;

  const tbody = popup.document.getElementById("popup-history-body");
  const emptyLabel = popup.document.getElementById("student-history-empty");

  try {
    const res = await fetch("http://127.0.0.1:5000/admin/reading-history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authToken
      },
      body: JSON.stringify({ user_id: ctxStudent.user_id })
    });

    const data = await res.json();
    tbody.innerHTML = "";

    // ✅ FIX: use data.history
    if (!data.success || !Array.isArray(data.history) || data.history.length === 0) {
      emptyLabel.hidden = false;
      return;
    }

    emptyLabel.hidden = true;

    data.history.forEach(r => {
      const tr = popup.document.createElement("tr"); // ✅ FIX
      tr.innerHTML = `
        <td>${r.book_id}</td>
        <td>${r.book_name}</td>
        <td>${r.issue_date}</td>
        <td>${r.due_date}</td>
        <td>${r.return_date || "Not Returned"}</td>
      `;

      // Optional highlight
      if (r.return_date === "Not Returned") {
        tr.style.backgroundColor = "#fff4e5";
      }

      tbody.appendChild(tr);
    });

  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Error loading history.</td>
      </tr>
    `;
  }
});

  ctxDelete.addEventListener("click", () => {
    ctxMenu.hidden = true;
    deleteName.textContent = `${ctxStudent.name} (${ctxStudent.user_id})`;
    deleteMsg.textContent = "";
    deleteOverlay.hidden = false;
  });

  deleteCancel.addEventListener("click", () => {
    deleteOverlay.hidden = true;
  });

  deleteConfirm.addEventListener("click", async () => {
    deleteMsg.textContent = "Deleting...";
    deleteMsg.style.color = "orange";

    try {
      const res = await fetch("http://127.0.0.1:5000/admin/students/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authToken },
        body: JSON.stringify({ user_id: ctxStudent.user_id, confirm: true })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      deleteMsg.textContent = "Student deleted.";
      deleteMsg.style.color = "green";

      setTimeout(() => {
        deleteOverlay.hidden = true;
        ctxStudent = null;
        loadStudents();
      }, 700);

    } catch (err) {
      deleteMsg.textContent = err.message || "Server error.";
    }
  });

  window.onAdminManageStudentsOpen = () => {
    resetUI();
    setTimeout(loadStudents, 120);
  };
});

// ================= ADMIN: PROCESS REQUESTS =================
document.addEventListener("DOMContentLoaded", () => {
  const screen = document.getElementById("admin-process-requests");
  if (!screen) return;

  const body = document.getElementById("pending-requests-body");
  const emptyMsg = document.getElementById("requests-empty-msg");

  const approveBtn = document.getElementById("approve-requests-btn");
  const rejectBtn = document.getElementById("reject-requests-btn");
  const selectAllBtn = document.getElementById("select-all-requests-btn");
  const invertBtn = document.getElementById("invert-selection-btn");
  const clearBtn = document.getElementById("clear-selection-btn");

  let requests = [];

  /* ---------- LOAD REQUESTS ---------- */
  async function loadRequests() {
    body.innerHTML = "";
    emptyMsg.hidden = true;

    try {
      const res = await fetch("http://127.0.0.1:5000/admin/pending-approvals", {
        headers: { Authorization: authToken }
      });

      const data = await res.json();
      if (!data.success || !data.data.length) {
        emptyMsg.hidden = false;
        return;
      }

      requests = data.data;

      requests.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><input type="checkbox" data-id="${r.user_id}"></td>
          <td>${r.year}</td>
          <td>${r.roll}</td>
          <td>${r.name}</td>
          <td>${r.user_id}</td>
        `;

        /* 🔹 Row click toggles checkbox */
        tr.addEventListener("click", e => {
          if (e.target.tagName === "INPUT") return;
          const cb = tr.querySelector("input[type='checkbox']");
          cb.checked = !cb.checked;
        });

        body.appendChild(tr);
      });

    } catch {
      emptyMsg.hidden = false;
      emptyMsg.textContent = "Failed to load pending requests.";
    }
  }

  /* ---------- SELECTION HELPERS ---------- */
  function getSelectedIDs() {
    return [...body.querySelectorAll("input[type='checkbox']:checked")]
      .map(cb => cb.dataset.id);
  }

  selectAllBtn.onclick = () =>
    body.querySelectorAll("input[type='checkbox']").forEach(cb => cb.checked = true);

  clearBtn.onclick = () =>
    body.querySelectorAll("input[type='checkbox']").forEach(cb => cb.checked = false);

  invertBtn.onclick = () =>
    body.querySelectorAll("input[type='checkbox']").forEach(cb => cb.checked = !cb.checked);

  /* ---------- PROCESS REQUESTS ---------- */
  async function process(choice) {
    const selected = getSelectedIDs();
    if (!selected.length) {
      showMessage("Please select at least one request.", "warn");
      return;
    }

    let lastBackendMessage = "";

    for (const user_id of selected) {
      const res = await fetch("http://127.0.0.1:5000/admin/pending-approvals/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authToken
        },
        body: JSON.stringify({ choice, user_id })
      });

      const data = await res.json();

      if (!data.success) {
        showMessage(data.message || "Request failed.", "error");
        return;
      }

      lastBackendMessage = data.message;
    }

    /* 🔹 Smart message handling */
    if (selected.length === 1) {
      showMessage(lastBackendMessage, "success");
    } else {
      const count = selected.length;
      const actionText =
        choice === 1
          ? `${count} students approved and added to students list.`
          : `${count} requests rejected and removed from pending requests.`;

      showMessage(actionText, "success");
    }

    loadRequests();
  }

  approveBtn.onclick = () => process(1);
  rejectBtn.onclick = () => process(2);

  /* ---------- SCREEN ENTRY POINT ---------- */
  window.onAdminProcessRequestsOpen = () => {
    loadRequests();
  };
});

// ================= ADMIN: VIEW LOGS =================
document.addEventListener("DOMContentLoaded", () => {
  const logBtn = document.getElementById("admin-show-log-btn");
  const logOverlay = document.getElementById("admin-log-overlay");
  const logContent = document.getElementById("admin-log-content");
  const closeBtn = document.getElementById("log-close-btn");

  /* Controls */
  const searchInput = document.getElementById("log-search");
  const prevBtn = document.getElementById("log-prev");
  const nextBtn = document.getElementById("log-next");
  const hideAdminToggle = document.getElementById("hide-admin-toggle");
  const hideAdminLabel = document.getElementById("hide-admin-label");
  const downloadBtn = document.getElementById("log-download");
  const emptyMsg = document.getElementById("log-empty");

  if (!logBtn || !logOverlay) return;

  let fullLogText = "";
  let filteredLogText = "";
  let matches = [];
  let currentMatch = -1;

  /* ---------- OPEN ---------- */
  logBtn.addEventListener("click", async () => {
    logOverlay.hidden = false;
    logContent.textContent = "Loading logs...";
    emptyMsg.hidden = true;

    try {
      const res = await fetch("http://127.0.0.1:5000/admin/logs", {
        headers: { Authorization: authToken }
      });

      const data = await res.json();
      if (!data.success) {
        logContent.textContent = data.message || "Failed to load logs.";
        return;
      }

      fullLogText = data.log || "";
      filteredLogText = fullLogText;

      resetSearch();
      hideAdminToggle.checked = false;
      syncHideAdminLabel();
      renderLogs();

    } catch {
      logContent.textContent = "Server error while fetching logs.";
    }
  });

  /* ---------- CLOSE ---------- */
  closeBtn.addEventListener("click", () => {
    logOverlay.hidden = true;
    hideAdminToggle.checked = false;
    syncHideAdminLabel();
    resetSearch();
    logContent.textContent = fullLogText;
  });

  /* ---------- LABEL STATE ---------- */
  function syncHideAdminLabel() {
    hideAdminLabel.classList.toggle("enabled", hideAdminToggle.checked);
    hideAdminLabel.classList.toggle("disabled", !hideAdminToggle.checked);
  }

  hideAdminToggle.addEventListener("change", () => {
    syncHideAdminLabel();

    filteredLogText = hideAdminToggle.checked
      ? fullLogText.split("\n").filter(l => !l.includes("[ADMIN]")).join("\n")
      : fullLogText;

    renderLogs(searchInput.value.trim());
  });

  /* ---------- RENDER ---------- */
  function renderLogs(query = "") {
    logContent.innerHTML = "";
    emptyMsg.hidden = true;
    matches = [];
    currentMatch = -1;

    if (!query) {
      logContent.textContent = filteredLogText || "Log file is empty.";
      return;
    }

    const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
    const found = [...filteredLogText.matchAll(regex)];

    if (!found.length) {
      logContent.textContent = filteredLogText;
      emptyMsg.hidden = false;
      return;
    }

    logContent.innerHTML = filteredLogText.replace(
      regex,
      `<mark class="log-hit">$1</mark>`
    );

    matches = [...logContent.querySelectorAll(".log-hit")];
    currentMatch = 0;
    highlightCurrent();
  }

  /* ---------- SEARCH ---------- */
  searchInput.addEventListener("input", () => {
    renderLogs(searchInput.value.trim());
  });

  function resetSearch() {
    searchInput.value = "";
    matches = [];
    currentMatch = -1;
    emptyMsg.hidden = true;
  }

  /* ---------- NAVIGATION / JUMP ---------- */
  function jumpToTop() {
    logContent.scrollTo({ top: 0, behavior: "smooth" });
  }

  function jumpToBottom() {
    logContent.scrollTo({
      top: logContent.scrollHeight,
      behavior: "smooth"
    });
  }

  function highlightCurrent() {
    if (!matches.length) return;

    matches.forEach(m => m.classList.remove("active-hit"));
    const el = matches[currentMatch];
    el.classList.add("active-hit");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  nextBtn.addEventListener("click", () => {
    // 🔽 No search → jump to bottom
    if (!searchInput.value.trim()) {
      jumpToBottom();
      return;
    }

    // 🔎 Search active → next match
    if (!matches.length) return;
    currentMatch = (currentMatch + 1) % matches.length;
    highlightCurrent();
  });

  prevBtn.addEventListener("click", () => {
    // 🔼 No search → jump to top
    if (!searchInput.value.trim()) {
      jumpToTop();
      return;
    }

    // 🔎 Search active → previous match
    if (!matches.length) return;
    currentMatch = (currentMatch - 1 + matches.length) % matches.length;
    highlightCurrent();
  });

  /* ---------- DOWNLOAD ---------- */
  downloadBtn.addEventListener("click", () => {
    const blob = new Blob([filteredLogText], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "DailyLog.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---------- UTIL ---------- */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
});

// ================= ADMIN: CLEAR DATA =================
document.addEventListener("DOMContentLoaded", () => {
  const screen = document.getElementById("admin-clear-data");
  if (!screen) return;

  const overlay = document.getElementById("clear-data-overlay");
  const title = document.getElementById("clear-data-title");
  const message = document.getElementById("clear-data-message");
  const msgBox = document.getElementById("clear-data-msg");

  const step1 = document.getElementById("clear-step-1");
  const step2 = document.getElementById("clear-step-2");

  const confirmBtn = document.getElementById("clear-confirm-btn");
  const cancelBtn = document.getElementById("clear-cancel-btn");
  const finalConfirmBtn = document.getElementById("clear-final-confirm-btn");
  const finalCancelBtn = document.getElementById("clear-final-cancel-btn");

  const passwordInput = document.getElementById("clear-admin-password");

  let currentOption = null;
  let currentLabel = "";

  const optionMap = {
    transactions: { code: 1, label: "transactions table" },
    books: { code: 2, label: "books table" },
    students: { code: 3, label: "students table" },
    requests: { code: 4, label: "pending requests table" },
    log: { code: 5, label: "log file" },
    all: { code: 6, label: "ALL DATA" }
  };

  /* ---------- OPEN CONFIRM ---------- */
  screen.querySelectorAll(".danger-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.clear;
      const opt = optionMap[key];
      if (!opt) return;

      currentOption = opt.code;
      currentLabel = opt.label;

      title.textContent = "Confirm Deletion";
      message.textContent =
        `Are you sure you want to delete ${currentLabel}? ` +
        `Once deleted, the data cannot be recovered.`;

      step1.hidden = false;
      step2.hidden = true;
      passwordInput.value = "";
      msgBox.textContent = "";
      msgBox.style.color = "";

      overlay.hidden = false;
    });
  });

  /* ---------- STEP CONTROLS ---------- */
  confirmBtn.onclick = () => {
    step1.hidden = true;
    step2.hidden = false;
    passwordInput.focus();
  };

  cancelBtn.onclick = finalCancelBtn.onclick = () => {
    overlay.hidden = true;
  };

  /* ---------- FINAL CONFIRM ---------- */
  finalConfirmBtn.onclick = async () => {
    const password = passwordInput.value.trim();
    if (!password) {
      msgBox.textContent = "Admin password required.";
      msgBox.style.color = "red";
      return;
    }

    msgBox.textContent = "Processing...";
    msgBox.style.color = "orange";

    try {
      const res = await fetch("http://127.0.0.1:5000/admin/clear-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authToken
        },
        body: JSON.stringify({
          option: currentOption,
          admin_password: password
        })
      });

      const data = await res.json();

      if (!data.success) {
        msgBox.textContent = data.message || "Operation failed.";
        msgBox.style.color = "red";
        return;
      }

      msgBox.textContent = data.message;
      msgBox.style.color = "green";

      setTimeout(() => {
        overlay.hidden = true;
      }, 900);

    } catch {
      msgBox.textContent = "Server error.";
      msgBox.style.color = "red";
    }
  };
});

// ================= ADMIN: SET SYSTEM DATE =================
document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("admin-set-date-btn");
  const overlay = document.getElementById("system-date-overlay");
  const closeBtn = document.getElementById("system-date-close");
  const daySelect = document.getElementById("system-date-day");
  const monthSelect = document.getElementById("system-date-month");
  const yearSelect = document.getElementById("system-date-year");
  const setBtn = document.getElementById("system-date-set");
  const resetBtn = document.getElementById("system-date-reset");
  const displayLabel = document.getElementById("system-date-display");
  const msgBox = document.getElementById("system-date-msg");

  if (!openBtn || !overlay) return;

  // ===== Helper: Format YYYY-MM-DD → DD-MM-YYYY =====
  function formatDisplay(dateStr) {
    const [y, m, d] = dateStr.split("-");
    return `${d}-${m}-${y}`;
  }

  // ===== Populate Dropdowns =====
  function populateDropdowns() {
    // Day 1-31
    daySelect.innerHTML = "";
    for (let d = 1; d <= 31; d++) {
      const opt = document.createElement("option");
      opt.value = String(d).padStart(2, "0");
      opt.textContent = d;
      daySelect.appendChild(opt);
    }

    // Month January-December
    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    monthSelect.innerHTML = "";
    months.forEach((m, i) => {
      const opt = document.createElement("option");
      opt.value = String(i + 1).padStart(2, "0"); // numeric month 01-12
      opt.textContent = m;
      monthSelect.appendChild(opt);
    });

    // Year 2000-2099
    yearSelect.innerHTML = "";
    for (let y = 2000; y <= 2099; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    }
  }

  // ===== Fetch Current System Date =====
  async function fetchCurrentDate() {
    try {
      msgBox.textContent = "Loading...";
      const res = await fetch("http://127.0.0.1:5000/system/date", {
          headers: {
            "Content-Type": "application/json"
          }});

      const data = await res.json();
      if (!data.date) throw new Error("No date returned");

      const [y, m, d] = data.date.split("-");
      daySelect.value = d;
      monthSelect.value = m;
      yearSelect.value = y;
      displayLabel.textContent = formatDisplay(data.date);
      msgBox.textContent = "";

    } catch {
      msgBox.textContent = "Failed to fetch system date.";
      msgBox.style.color = "red";
    }
  }

  // ===== Open Popup =====
  openBtn.addEventListener("click", () => {
    overlay.hidden = false;
    msgBox.textContent = "";
    populateDropdowns();
    fetchCurrentDate();
  });

  // ===== Close Popup =====
  closeBtn.addEventListener("click", () => {
    overlay.hidden = true;
    msgBox.textContent = "";
  });

  // ===== Reset Date =====
  resetBtn.addEventListener("click", async () => {
    try {
      msgBox.textContent = "Resetting...";
      const res = await fetch("http://127.0.0.1:5000/system/reset-date", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ source: "MANUAL" })
      });

      const data = await res.json();
      if (!data.date) throw new Error("No date returned");

      const [y, m, d] = data.date.split("-");
      daySelect.value = d;
      monthSelect.value = m;
      yearSelect.value = y;
      displayLabel.textContent = formatDisplay(data.date);

      showMessage(data.message || "Date reset successfully.", "success");
      msgBox.textContent = "";

    } catch {
      msgBox.textContent = data.message || "Failed to reset date.";
      msgBox.style.color = "red";
    }
  });

  // ===== Set New Date =====
  setBtn.addEventListener("click", async () => {
    const new_day = daySelect.value;
    const new_month = monthSelect.value;
    const new_year = yearSelect.value;

    const new_date = `${new_day}-${new_month}-${new_year}`; // DD-MM-YYYY for backend
    try {
      msgBox.textContent = "Updating...";
      msgBox.style.color = "orange";
      const res = await fetch("http://127.0.0.1:5000/system/set-date", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ new_date, source: "MANUAL" })
        }); 

      const data = await res.json();
      if (!data.date) throw new Error("Invalid date format");

      displayLabel.textContent = formatDisplay(data.date);
      showMessage(data.message || "System date updated successfully.", "success");
      msgBox.textContent = "";

    } catch (err) {
      showMessage("Invalid date format.", "error");
      msgBox.textContent = err.message || "Failed to update system date.";
      msgBox.style.color = "red";
    }
  });
});

// ================= STUDENT SIGN UP =================
document.addEventListener("DOMContentLoaded", () => {

  const signupBtn = document.getElementById("student-signup-btn");
  const confirmSignupBtn = document.getElementById("confirm-signup-btn");

  const yearInput = document.getElementById("signup-year");
  const rollInput = document.getElementById("signup-roll");
  const nameInput = document.getElementById("signup-name");

  // ---------- OPEN SIGNUP SCREEN ----------
  if (signupBtn) {
    signupBtn.addEventListener("click", () => {
      showScreen("student-signup-screen");
    });
  }

  // ---------- CONFIRM SIGNUP ----------
  if (confirmSignupBtn) {
    confirmSignupBtn.addEventListener("click", async () => {
      const year = yearInput.value.trim();
      const roll = rollInput.value.trim();
      const name = nameInput.value.trim();

      try {
        const res = await fetch("http://127.0.0.1:5000/student/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: name,
            year: year,
            roll: roll
          })
        });

        const data = await res.json();

        if (!data.success) {
          showMessage(data.message || "Signup failed.", "error");
          resetScreen("student-signup-screen");
          return;
        }

        // Success
        showMessage(data.message || `Signup successful! Your User ID: ${data.user_id}`, "success", 5000);

        // Navigate back to student login after a short delay
        setTimeout(() => {
          resetNavToHome();
        }, 1200);

      } catch (err) {
        showMessage("Server error during signup.", "error");
      }
    });
  }
});


// ================= STUDENT LOGIN =================
document.addEventListener("DOMContentLoaded", () => {
  const signinBtn = document.getElementById("student-signin-btn");
  const signupBtn = document.getElementById("student-signup-btn");
  const userIdInput = document.getElementById("student-user-id");
  const msg = document.getElementById("student-login-msg");

  const welcomeLabel = document.getElementById("student-welcome-label");
  const studentBorrowBtn = document.getElementById("student-borrow-btn");
  const studentReturnBtn = document.getElementById("student-return-btn");
  const studentReadingHistoryBtn = document.getElementById("student-reading-history-btn");
  const logoutBtn = document.getElementById("student-logout-btn");

  if (!signinBtn) return;

  // ---------- SIGN IN ----------
  signinBtn.addEventListener("click", async () => {
    const userId = userIdInput.value.trim().toUpperCase();

    if (!userId) {
      msg.textContent = "Please enter your User ID.";
      msg.style.color = "red";
      return;
    }

    msg.textContent = "Signing in...";
    msg.style.color = "orange";

    try {
      const res = await fetch("http://127.0.0.1:5000/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();

      if (!data.success) {
        msg.textContent = data.message || "Login failed.";
        msg.style.color = "red";
        return;
      }

      // 🔐 Save global auth state
      authToken = data.token;
      userRole = "student";

      // 🎉 Welcome message
      welcomeLabel.textContent = data.message || "Welcome!";
      showMessage(welcomeLabel.textContent, "success");

      // ✅ Clear login message and navigate to dashboard
      msg.textContent = "";
      showScreen("student-dashboard");

      // 🎉 Extract name and show welcome label
      if (data.message?.startsWith("Welcome,")) {
        const name = data.message.replace("Welcome,", "").replace("!", "").trim();
        welcomeLabel.textContent = `Welcome, ${name}`;
      } else {
        welcomeLabel.textContent = "Welcome, Student";
      }

    } catch (err) {
      msg.textContent = "Server error during login.";
      msg.style.color = "red";
    }
  });

  if (studentBorrowBtn) {
    studentBorrowBtn.addEventListener("click", () => {
      showScreen("student-borrow");
      onStudentBorrowOpen(); 
    });
  }

  if (studentReturnBtn) {
    studentReturnBtn.addEventListener("click", () => {
      showScreen("student-return");
      onStudentReturnOpen();
    });
  }

  if (studentReadingHistoryBtn) {
    studentReadingHistoryBtn.addEventListener("click", () => {
      showScreen("student-reading-history");
      onStudentReadingHistoryOpen();
    }); 
  }

  // ---------- LOG OUT ----------
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await fetch("http://127.0.0.1:5000/student/logout", {
          method: "POST",
          headers: { Authorization: authToken }
        });
      } catch {
        // Ignore logout failure
      }

      authToken = null;
      userRole = null;

      showMessage("Logged out successfully.", "success");
      setTimeout(() => {
        resetScreen("home-screen");
        resetNavToHome();
      }, 800);
    });
  }

  window.onStudentDashboardOpen = () => {
    updateDashboardWelcome();
  };
});

// ================= STUDENT: BORROW BOOK =================
document.addEventListener("DOMContentLoaded", () => {
  const screen = document.getElementById("student-borrow");
  if (!screen) return;

  const searchInput = document.getElementById("borrow-search");
  const searchColumn = document.getElementById("borrow-search-column");
  const sortBtn = document.getElementById("borrow-sort-btn");
  const sortLabel = document.getElementById("borrow-sort-label");
  const hideUnavailableChk = document.getElementById("hide-unavailable");
  const hideUnavailableLabel = document.getElementById("hide-unavailable-label");

  const tableBody = document.getElementById("borrow-table-body");
  const emptyMsg = document.getElementById("borrow-empty-msg");
  const borrowBtn = document.getElementById("borrow-confirm-btn");

  let books = [];
  let filtered = [];
  let sortAsc = true;
  let selectedBookId = null;

  // ---------- LOAD BOOKS ----------
  async function loadAvailableBooks() {
    if (!authToken) return;

    try {
      const res = await fetch("http://127.0.0.1:5000/student/available-books", {
        headers: { Authorization: authToken }
      });

      const data = await res.json();
      if (!data.success) throw new Error();

      books = Array.isArray(data.data) ? data.data : [];
      applyFiltersAndRender();

    } catch {
      books = [];
      tableBody.innerHTML = "";
      emptyMsg.hidden = false;
      emptyMsg.textContent = "Unable to load books.";
    }
  }

  // ---------- FILTER + SORT ----------
  function applyFiltersAndRender() {
    const term = searchInput.value.trim().toLowerCase();
    const col = searchColumn.value;
    const hideUnavailable = hideUnavailableChk.checked;

    filtered = books.filter(b => {
      if (hideUnavailable && b.available <= 0) return false;

      if (!term) return true;
      return String(b[col] ?? "")
        .toLowerCase()
        .includes(term);
    });

    filtered.sort((a, b) => {
      let x = a[col];
      let y = b[col];

      if (typeof x === "string") x = x.toLowerCase();
      if (typeof y === "string") y = y.toLowerCase();

      if (x < y) return sortAsc ? -1 : 1;
      if (x > y) return sortAsc ? 1 : -1;
      return 0;
    });

    renderTable(filtered);
  }

  function selectBook(bookId, radio) {
    // If clicking the already-selected book → deselect
    if (selectedBookId === bookId) {
      radio.checked = false;
      selectedBookId = null;
      return;
    }

    // Otherwise select new book
    selectedBookId = bookId;
    radio.checked = true;
  }

  // ---------- RENDER TABLE ----------
  function renderTable(data) {
    tableBody.innerHTML = "";
    selectedBookId = null;

    if (!data.length) {
      emptyMsg.hidden = false;
      emptyMsg.textContent = "Book not found";
      return;
    }

    emptyMsg.hidden = true;

    data.forEach(b => {
      const unavailable = b.available <= 0;

      const tr = document.createElement("tr");
      if (unavailable) {
        tr.style.color = "#aaa";
      }

      tr.innerHTML = `
        <td>
          <input
            type="radio"
            name="borrow-select"
            class="borrow-radio"
            value="${b.book_id}"
            ${unavailable ? "disabled" : ""}
          >
        </td>
        <td>${b.book_id}</td>
        <td>${b.name}</td>
      `;

      const radio = tr.querySelector("input");

      // ✅ Radio click (keyboard / direct click)
      radio.addEventListener("click", (e) => {
        e.stopPropagation(); // prevent row click duplication
        selectBook(b.book_id, radio);
      });

      // ✅ Row click (anywhere)
      tr.addEventListener("click", () => {
        if (unavailable) return;
        selectBook(b.book_id, radio);
      });

      tableBody.appendChild(tr);
    });
  }

  // ---------- SORT TOGGLE ----------
  sortBtn.addEventListener("click", () => {
    sortAsc = !sortAsc;
    sortBtn.textContent = sortAsc ? "▲" : "▼";
    sortLabel.textContent = `Sort by: ${sortAsc ? "Ascending" : "Descending"}`;
    applyFiltersAndRender();
  });

  // ---------- SEARCH / FILTER EVENTS ----------
  searchInput.addEventListener("input", applyFiltersAndRender);
  searchColumn.addEventListener("change", applyFiltersAndRender);

  hideUnavailableChk.addEventListener("change", () => {
    hideUnavailableLabel.style.color = hideUnavailableChk.checked ? "#555" : "#999";
    applyFiltersAndRender();
  });

  // ---------- BORROW CONFIRM ----------
  borrowBtn.addEventListener("click", async () => {
    if (!selectedBookId) {
      showMessage("Please select a book to borrow.", "error");
      return;
    }

    borrowBtn.disabled = true;
    borrowBtn.textContent = "Borrowing...";

    try {
      const res = await fetch("http://127.0.0.1:5000/student/borrow-book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authToken
        },
        body: JSON.stringify({ book_id: selectedBookId })
      });

      const data = await res.json();

      if (!data.success) {
        showMessage(data.message || "Borrow failed.", "error");
        return;
      }

      showMessage(data.message || "Book borrowed successfully.", "success");
      loadAvailableBooks(); // refresh list

    } catch (err) {
      showMessage("Server error while borrowing book.", "error");
    } finally {
      borrowBtn.disabled = false;
      borrowBtn.textContent = "Borrow";
    }
  });

  // ---------- SCREEN OPEN HOOK ----------
  window.onStudentBorrowOpen = () => {
    searchInput.value = "";
    hideUnavailableChk.checked = false;
    hideUnavailableLabel.style.color = "#999";
    sortAsc = true;
    sortBtn.textContent = "▲";
    sortLabel.textContent = "Sort by: Ascending";
    selectedBookId = null;
    searchColumn.value = "name";
    loadAvailableBooks();
  };
});

// ================= STUDENT: RETURN BOOK =================
document.addEventListener("DOMContentLoaded", () => {
  const screen = document.getElementById("student-return");
  if (!screen) return;

  const tableBody = document.getElementById("return-table-body");
  const emptyLabel = document.getElementById("no-borrowed-label");
  const returnBtn = document.getElementById("return-btn");

  let borrowedBooks = [];
  let selectedTxn = null;

  // ---------------- Load Borrowed Books ----------------
  async function loadBorrowedBooks() {
    if (!authToken) return;

    try {
      const res = await fetch("http://127.0.0.1:5000/student/borrowed-books", {
        headers: { Authorization: authToken }
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Load failed");

      borrowedBooks = Array.isArray(data.data) ? data.data : [];

      if (!borrowedBooks.length) {
        tableBody.innerHTML = "";
        emptyLabel.hidden = false;
        returnBtn.disabled = true;
        return;
      }

      emptyLabel.hidden = true;
      returnBtn.disabled = false;
      renderTable();

    } catch (err) {
      console.error("Borrowed books load error:", err);
      tableBody.innerHTML = "";
      emptyLabel.hidden = false;
      emptyLabel.textContent = "Unable to load borrowed books.";
      returnBtn.disabled = true;
    }
  }

  // ---------------- Render Table ----------------
  function renderTable() {
    tableBody.innerHTML = "";
    selectedTxn = null;

    borrowedBooks.slice(0, 3).forEach(b => {
      const tr = document.createElement("tr");
      tr.dataset.txn = b.transaction_id;

      tr.innerHTML = `
        <td><input type="checkbox" class="return-select"></td>
        <td>${b.book_id}</td>
        <td>${b.book_name}</td>
        <td>${b.due_date}</td>
        <td>
          ${b.status === "OVERDUE"
            ? `<span class="return-overdue">OVERDUE</span>`
            : ""}
        </td>
      `;

      tableBody.appendChild(tr);
    });
  }

  // ---------------- Row Selection (Radio Behavior) ----------------
  tableBody.addEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;

    const checkbox = row.querySelector(".return-select");

    // Clear all selections
    tableBody.querySelectorAll("tr").forEach(r => {
      r.classList.remove("selected");
      r.querySelector(".return-select").checked = false;
    });

    // Toggle same row off
    if (selectedTxn === row.dataset.txn) {
      selectedTxn = null;
      return;
    }

    checkbox.checked = true;
    row.classList.add("selected");
    selectedTxn = row.dataset.txn;
  });

  // ---------------- Return Button Logic ----------------
  returnBtn.addEventListener("click", async () => {
    if (!selectedTxn) {
      showMessage("Please select a book to return.", "error");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:5000/student/return-book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authToken
        },
        body: JSON.stringify({
          transaction_id: selectedTxn
        })
      });

      const data = await res.json();

      // No fine → success
      if (data.success) {
        showMessage(data.message || "Book returned successfully.", "success");
        selectedTxn = null;
        await loadBorrowedBooks();
        return;
      }

      // Fine required → open payment popup
      if (data.requires_confirmation) {
        openFinePaymentPopup({
          transaction_id: data.transaction_id,
          fine: data.fine
        });
        return;
      }

      showMessage(data.message || "Return failed.", "error");

    } catch (err) {
      console.error("Return book error:", err);
      showMessage("Server error while returning book.", "error");
    }
  });

  // ---------------- Screen Hook ----------------
  window.onStudentReturnOpen = async () => {
    selectedTxn = null;
    borrowedBooks = [];
    emptyLabel.hidden = true;
    returnBtn.disabled = true;
    tableBody.innerHTML = "";
    await loadBorrowedBooks();
  };
});

// ================= STUDENT: FINE PAYMENT =================
document.addEventListener("DOMContentLoaded", () => {

  // ---------- POPUPS ----------
  const finePopup = document.getElementById("student-fine-payment");
  const cardPopup = document.getElementById("credit-card-payment");
  const netPopup = document.getElementById("net-banking-payment");
  const upiPopup = document.getElementById("upi-payment");
  const loadingPopup = document.getElementById("payment-loading");

  // ---------- BUTTONS ----------
  const proceedBtn = document.getElementById("proceed-payment-btn");
  const cancelFineBtn = document.getElementById("cancel-payment-btn");

  const ccConfirm = document.getElementById("cc-confirm-btn");
  const ccCancel = document.getElementById("cc-cancel-btn");

  const nbConfirm = document.getElementById("nb-confirm-btn");
  const nbCancel = document.getElementById("nb-cancel-btn");

  const upiConfirm = document.getElementById("upi-confirm-btn");
  const upiCancel = document.getElementById("upi-cancel-btn");

  // ---------- INPUTS ----------
  const ccNumber = document.getElementById("cc-number");
  const ccExpiry = document.getElementById("cc-expiry");
  const ccCvv = document.getElementById("cc-cvv");

  const nbAccount = document.getElementById("nb-account");
  const nbPassword = document.getElementById("nb-password");

  const upiId = document.getElementById("upi-id");
  const upiPin = document.getElementById("upi-pin");

  // ---------- LOADING ----------
  const methodHeading = document.getElementById("payment-method-heading");
  const paymentAmount = document.getElementById("payment-amount");
  const tick = loadingPopup.querySelector(".loader-tick");
  const statusText = loadingPopup.querySelector(".payment-status");

  // ---------- STATE ----------
  let fineTxnId = null;
  let fineAmount = 0;

  // ---------- HELPERS ----------
  function hideAllPopups() {
    [finePopup, cardPopup, netPopup, upiPopup, loadingPopup]
      .forEach(p => p.hidden = true);
  }

  function resetInputs() {
    ccNumber.value = ccExpiry.value = ccCvv.value = "";
    nbAccount.value = nbPassword.value = "";
    upiId.value = upiPin.value = "";
    document.querySelectorAll('input[name="payment"]').forEach(r => r.checked = false);
  }

  // ---------- OPEN FINE POPUP (called from Return screen) ----------
  window.openFinePaymentPopup = ({ transaction_id, fine }) => {
    fineTxnId = transaction_id;
    fineAmount = fine;
    resetInputs();
    hideAllPopups();
    finePopup.hidden = false;
  };

  // ---------- PAYMENT METHOD SELECT ----------
  proceedBtn.addEventListener("click", () => {
    const method = document.querySelector('input[name="payment"]:checked')?.value;
    if (!method) {
      showMessage("Please select a payment method.", "error");
      return;
    }

    finePopup.hidden = true;

    if (method === "card") cardPopup.hidden = false;
    if (method === "netbanking") netPopup.hidden = false;
    if (method === "upi") upiPopup.hidden = false;
  });

  cancelFineBtn.addEventListener("click", () => {
    hideAllPopups();
  });

  // ---------- CORE PAYMENT FUNCTION ----------
  async function processPayment(method, payload) {
    hideAllPopups();

    // --- Loader elements ---
    const progress = loadingPopup.querySelector(".progress");
    const tick = loadingPopup.querySelector(".loader-tick");
    const status = loadingPopup.querySelector(".payment-status");

    // --- Setup UI ---
    methodHeading.textContent = method.toUpperCase() + " PAYMENT";
    paymentAmount.textContent = `Amount: Rs. ${fineAmount}`;

    const recipient = document.getElementById("payment-recipient");
    recipient.textContent = 
      window.currentStudentName 
      ? `${window.currentStudentName} → Library`
      : "Student → Library";

    // Reset loader state
    progress.style.transition = "none";
    progress.style.strokeDashoffset = "452.39";
    tick.style.opacity = "0";
    status.style.opacity = "0";
    status.textContent = "Processing payment...";

    loadingPopup.hidden = false;

    // Force reflow (VERY important for SVG animation)
    progress.getBoundingClientRect();

    // Start loader animation
    progress.style.transition = "stroke-dashoffset 5.5s linear";
    progress.style.strokeDashoffset = "0";

    try {
      const res = await fetch("http://127.0.0.1:5000/student/return-book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authToken
        },
        body: JSON.stringify({
          transaction_id: fineTxnId,
          confirm_fine: true,
          payment_payload: {
            method,
            ...payload
         }
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.payment_error || data.message);

      // Wait for loader to finish, then show success
      setTimeout(() => {
        tick.style.opacity = "1";
        status.textContent = "Payment Successful";
        status.style.opacity = "1";

        // Close loader & refresh return screen
        setTimeout(async () => {
          hideAllPopups();
          showMessage(data.message, "success");
          fineTxnId = null;
          await window.onStudentReturnOpen();
        }, 900);

      }, 5500); // MUST match loader duration

    } catch (err) {
     hideAllPopups();
      showMessage(err.message || "Payment failed.", "error");
   }
   }

  // ---------- CARD ----------
  ccConfirm.addEventListener("click", () => {
    processPayment("card", {
      card_number: ccNumber.value.trim(),
      expiry: ccExpiry.value.trim(),
      cvv: ccCvv.value.trim()
    });
  });

  ccCancel.addEventListener("click", hideAllPopups);

  // ---------- NET BANKING ----------
  nbConfirm.addEventListener("click", () => {
    processPayment("netbanking", {
      account_no: nbAccount.value.trim(),
      password: nbPassword.value.trim()
    });
  });

  nbCancel.addEventListener("click", hideAllPopups);

  // ---------- UPI ----------
  upiConfirm.addEventListener("click", () => {
    processPayment("upi", {
      upi_id: upiId.value.trim(),
      upi_pin: upiPin.value.trim()
    });
  });

  upiCancel.addEventListener("click", hideAllPopups);
});

// ================= STUDENT: READING HISTORY =================
document.addEventListener("DOMContentLoaded", () => {
  const screen = document.getElementById("student-history");
  if (!screen) return;

  const historyBtn = document.getElementById("student-history-btn");
  const backBtn = screen.querySelector(".back-btn");

  const tableBody = document.getElementById("my-history-body");
  const emptyLabel = document.getElementById("history-empty");

  // ---------- Load Reading History ----------
  async function loadReadingHistory() {
    if (!authToken) return;

    tableBody.innerHTML = "";
    emptyLabel.hidden = true;

    try {
      const res = await fetch("http://127.0.0.1:5000/student/reading-history", {
        headers: {
          Authorization: authToken
        }
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to load reading history");
      }

      const history = Array.isArray(data.history) ? data.history : [];

      if (!history.length) {
        emptyLabel.hidden = false;
        return;
      }

      history.forEach(h => {
        const tr = document.createElement("tr");

        const notReturned = h.return_date === "Not Returned";

        if (notReturned) {
          tr.classList.add("not-returned");
        }

        tr.innerHTML = `
          <td>${h.book_id}</td>
          <td>${h.book_name}</td>
          <td>${h.issue_date}</td>
          <td>${h.due_date}</td>
          <td>${h.return_date}</td>
        `;

        tableBody.appendChild(tr);
      });

    } catch (err) {
      console.error("Reading history error:", err);
      emptyLabel.hidden = false;
      emptyLabel.textContent = "Unable to load reading history.";
    }
  }

  // ---------- Screen Open Hook ----------
  window.onStudentHistoryOpen = async () => {
    tableBody.innerHTML = "";
    emptyLabel.hidden = true;
    await loadReadingHistory();
  };

  // ---------- Open History Screen ----------
  if (historyBtn) {
    historyBtn.addEventListener("click", () => {
      showScreen("student-history");
      onStudentHistoryOpen();
    });
  }
});
