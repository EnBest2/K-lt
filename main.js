"use strict";

// Globális változók és adatok
let db;
let transactions = []; // Tranzakciók listája
let categories = [
  { name: "Egyéb", color: "#000000", icon: "❓" },
  { name: "Étel", color: "#FF5722", icon: "🍔" },
  { name: "Utazás", color: "#3F51B5", icon: "✈️" }
];
let monthlyBudget = 0;
let currentMonthExpenses = 0;
let chart; // Chart.js diagram példány
let localSavingsBalance = 0;

// DOM elemek
const pinModal = document.getElementById("pin-modal");
const pinInput = document.getElementById("pin-input");
const pinSubmitBtn = document.getElementById("pin-submit-btn");
const appContent = document.getElementById("app-content");

const transactionForm = document.getElementById("transaction-form");
const transactionTypeEl = document.getElementById("transaction-type");
const amountInput = document.getElementById("amount");
const descriptionInput = document.getElementById("description");
const transactionList = document.getElementById("transaction-list");
const searchInput = document.getElementById("search-input");

const categorySelect = document.getElementById("category");

const customCategoryForm = document.getElementById("custom-category-form");
const newCategoryInput = document.getElementById("new-category");
const newCategoryColorInput = document.getElementById("new-category-color");
const newCategoryIconInput = document.getElementById("new-category-icon");
const categoryList = document.getElementById("category-list");

const savingsForm = document.getElementById("savings-form");
const savingsBalanceEl = document.getElementById("savings-balance");

const budgetForm = document.getElementById("budget-form");
const monthlyBudgetInput = document.getElementById("monthly-budget");
const monthlyExpensesEl = document.getElementById("monthly-expenses");
const budgetRemainingEl = document.getElementById("budget-remaining");

const exportBtn = document.getElementById("export-btn");
const importFileInput = document.getElementById("import-file");
const importBtn = document.getElementById("import-btn");

const notifyBtn = document.getElementById("notify-btn");

// IndexedDB inicializálás
function initIndexedDB() {
  const request = indexedDB.open("financeDB", 1);
  request.onerror = (event) => {
    console.error("IndexedDB hiba", event);
  };
  request.onsuccess = (event) => {
    db = event.target.result;
    console.log("IndexedDB sikeresen inicializálva");
    loadData();
  };
  request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains("transactions")) {
      db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
    }
    if (!db.objectStoreNames.contains("categories")) {
      db.createObjectStore("categories", { keyPath: "name" });
    }
    if (!db.objectStoreNames.contains("savings")) {
      db.createObjectStore("savings", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("budget")) {
      db.createObjectStore("budget", { keyPath: "id" });
    }
  };
}

// Adatok betöltése az IndexedDB-ből
function loadData() {
  // Kategóriák betöltése
  const catTxn = db.transaction("categories", "readonly");
  const catStore = catTxn.objectStore("categories");
  const catRequest = catStore.getAll();
  catRequest.onsuccess = (event) => {
    if (event.target.result.length > 0) {
      categories = event.target.result;
    } else {
      saveDefaultCategories();
    }
    renderCategoryOptions();
    renderCategoryManagement();
  };

  // Tranzakciók betöltése
  const transTxn = db.transaction("transactions", "readonly");
  const transStore = transTxn.objectStore("transactions");
  const transRequest = transStore.getAll();
  transRequest.onsuccess = (event) => {
    transactions = event.target.result;
    renderTransactions(transactions);
    updateMonthlyExpenses();
    updateChart();
  };

  // Megtakarítás betöltése
  const savingTxn = db.transaction("savings", "readonly");
  const savingStore = savingTxn.objectStore("savings");
  const savingRequest = savingStore.getAll();
  savingRequest.onsuccess = (event) => {
    if (event.target.result.length > 0) {
      localSavingsBalance = event.target.result[0].balance;
      savingsBalanceEl.textContent = localSavingsBalance.toFixed(2);
    }
  };

  // Költségvetés betöltése
  const budgetTxn = db.transaction("budget", "readonly");
  const budgetStore = budgetTxn.objectStore("budget");
  const budgetRequest = budgetStore.getAll();
  budgetRequest.onsuccess = (event) => {
    if (event.target.result.length > 0) {
      monthlyBudget = event.target.result[0].amount;
      monthlyBudgetInput.value = monthlyBudget;
      updateBudgetDisplay();
    }
  };
}

function saveDefaultCategories() {
  const txn = db.transaction("categories", "readwrite");
  const store = txn.objectStore("categories");
  categories.forEach((cat) => {
    store.put(cat);
  });
}

// Adatok mentése IndexedDB-be
function addTransactionToDB(txData, callback) {
  const txn = db.transaction("transactions", "readwrite");
  const store = txn.objectStore("transactions");
  const request = store.add(txData);
  request.onsuccess = (event) => {
    callback(event.target.result);
  };
}

function addSavingsToDB(newBalance) {
  const txn = db.transaction("savings", "readwrite");
  const store = txn.objectStore("savings");
  store.clear().onsuccess = () => {
    store.add({ id: 1, balance: newBalance });
  };
}

function addBudgetToDB(amount) {
  const txn = db.transaction("budget", "readwrite");
  const store = txn.objectStore("budget");
  store.clear().onsuccess = () => {
    store.add({ id: 1, amount: amount });
  };
}

function addCategoryToDB(category) {
  const txn = db.transaction("categories", "readwrite");
  const store = txn.objectStore("categories");
  store.put(category);
  txn.oncomplete = () => {
    renderCategoryOptions();
    renderCategoryManagement();
  };
}

function deleteCategoryFromDB(categoryName) {
  const txn = db.transaction("categories", "readwrite");
  const store = txn.objectStore("categories");
  store.delete(categoryName).onsuccess = () => {
    categories = categories.filter((cat) => cat.name !== categoryName);
    renderCategoryOptions();
    renderCategoryManagement();
  };
}

// UI frissítések
function renderCategoryOptions() {
  categorySelect.innerHTML = "";
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat.name;
    option.textContent = `${cat.icon} ${cat.name}`;
    categorySelect.appendChild(option);
  });
}

function renderCategoryManagement() {
  categoryList.innerHTML = "";
  categories.forEach((cat) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    const colorIcon = document.createElement("div");
    colorIcon.classList.add("category-color-icon");
    colorIcon.style.backgroundColor = cat.color;
    span.appendChild(colorIcon);
    const text = document.createTextNode(` ${cat.icon} ${cat.name}`);
    span.appendChild(text);
    li.appendChild(span);

    const editBtn = document.createElement("button");
    editBtn.textContent = "Szerkesztés";
    editBtn.addEventListener("click", () => editCategory(cat));
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Törlés";
    deleteBtn.addEventListener("click", () => {
      if (confirm(`Biztos törlöd a(z) ${cat.name} kategóriát?`)) {
        deleteCategoryFromDB(cat.name);
      }
    });
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    categoryList.appendChild(li);
  });
}

function editCategory(cat) {
  const newName = prompt("Új név:", cat.name);
  if (newName && newName.trim() !== "") {
    const newColor = prompt("Új szín (hex kód pl.: #FF5722):", cat.color);
    const newIcon = prompt("Új ikon (emoji):", cat.icon);
    if (newName !== cat.name) {
      deleteCategoryFromDB(cat.name);
      const updatedCat = {
        name: newName,
        color: newColor || cat.color,
        icon: newIcon || cat.icon,
      };
      categories.push(updatedCat);
      addCategoryToDB(updatedCat);
    } else {
      const updatedCat = { name: cat.name, color: newColor || cat.color, icon: newIcon || cat.icon };
      addCategoryToDB(updatedCat);
      categories = categories.map((c) => (c.name === cat.name ? updatedCat : c));
      renderCategoryOptions();
      renderCategoryManagement();
    }
  }
}

function renderTransactions(transList) {
  transactionList.innerHTML = "";
  transList.forEach((tx) => {
    const li = document.createElement("li");
    const date = new Date(tx.timestamp).toLocaleDateString("hu-HU");
    li.innerHTML = `[${date}] ${tx.type.toUpperCase()} - ${tx.amount.toFixed(2)} Ft - ${tx.category} - ${tx.description} `;
    
    // Törlés gomb hozzáadása
    const delBtn = document.createElement("button");
    delBtn.textContent = "Törlés";
    delBtn.addEventListener("click", () => deleteTransaction(tx.id));
    li.appendChild(delBtn);
    
    transactionList.appendChild(li);
  });
}

function deleteTransaction(id) {
  const txn = db.transaction("transactions", "readwrite");
  const store = txn.objectStore("transactions");
  const request = store.delete(id);
  request.onsuccess = () => {
    transactions = transactions.filter((tx) => tx.id !== id);
    renderTransactions(transactions);
    updateMonthlyExpenses();
    updateChart();
  };
}

function updateMonthlyExpenses() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let expenses = 0;
  transactions.forEach((tx) => {
    const txDate = new Date(tx.timestamp);
    if (tx.type === "kiadás" && txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
      expenses += tx.amount;
    }
  });
  currentMonthExpenses = expenses;
  monthlyExpensesEl.textContent = expenses.toFixed(2);
  updateBudgetDisplay();
  if (monthlyBudget && expenses > monthlyBudget) {
    sendNotification(
      "Költségvetési figyelmeztetés",
      "A havi kiadások meghaladták a beállított költségvetést!"
    );
  }
}

function updateBudgetDisplay() {
  if (monthlyBudget) {
    const remaining = monthlyBudget - currentMonthExpenses;
    budgetRemainingEl.textContent = remaining.toFixed(2);
  }
}

// Modern kördiagram: Chart.js + DataLabels pluginnal
function updateChart() {
  const expensePerCategory = {};
  transactions.forEach((tx) => {
    if (tx.type === "kiadás") {
      expensePerCategory[tx.category] = (expensePerCategory[tx.category] || 0) + tx.amount;
    }
  });
  
  const labels = Object.keys(expensePerCategory);
  const data = Object.values(expensePerCategory);
  
  const ctx = document.getElementById("transactions-chart").getContext("2d");
  if (chart) {
    chart.destroy();
  }
  
  // Regisztráljuk a ChartDataLabels plugint
  Chart.register(ChartDataLabels);
  
  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        label: "Kiadások kategóriánként",
        data: data,
        backgroundColor: labels.map((catName) => {
          const cat = categories.find((c) => c.name === catName);
          return cat ? cat.color : "#ccc";
        }),
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
              const currentValue = context.parsed;
              const percentage = total ? ((currentValue / total) * 100).toFixed(2) : 0;
              return context.label + ": " + percentage + "% (" + currentValue.toFixed(2) + " Ft)";
            }
          }
        },
        datalabels: {
          formatter: (value, ctx) => {
            const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const percentage = total ? ((value / total) * 100).toFixed(2) + "%" : "0%";
            return percentage;
          },
          color: "#fff",
          font: {
            weight: 'bold'
          }
        }
      }
    }
  });
}

// Push értesítés küldése
function sendNotification(title, body) {
  if (!("Notification" in window)) {
    alert("Ez a böngésző nem támogatja az értesítéseket.");
    return;
  }
  if (Notification.permission === "granted") {
    new Notification(title, { body: body });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, { body: body });
      }
    });
  }
}

if (Notification.permission !== "granted") {
  Notification.requestPermission();
}

// PIN kód kezelés
function checkPIN() {
  pinModal.style.display = "block";
}

pinSubmitBtn.addEventListener("click", () => {
  const enteredPIN = pinInput.value;
  const storedPIN = localStorage.getItem("appPIN");
  if (storedPIN === null) {
    if (enteredPIN.length === 4 && !isNaN(enteredPIN)) {
      localStorage.setItem("appPIN", enteredPIN);
      pinModal.style.display = "none";
      appContent.style.display = "block";
    } else {
      alert("PIN kódnak 4 számjegynek kell lennie.");
    }
  } else {
    if (enteredPIN === storedPIN) {
      pinModal.style.display = "none";
      appContent.style.display = "block";
    } else {
      alert("Helytelen PIN kód.");
    }
  }
});

// Tranzakció rögzítése
transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const type = transactionTypeEl.value;
  const amount = parseFloat(amountInput.value);
  const cat = categorySelect.value;
  const description = descriptionInput.value;
  if (isNaN(amount)) {
    alert("Kérlek, adj meg egy érvényes összeget.");
    return;
  }
  const newTransaction = {
    type: type,
    amount: amount,
    category: cat,
    description: description,
    timestamp: new Date().toISOString()
  };
  addTransactionToDB(newTransaction, function(id) {
    newTransaction.id = id;
    transactions.push(newTransaction);
    renderTransactions(transactions);
    updateMonthlyExpenses();
    updateChart();
    transactionForm.reset();
  });
});

// Keresés a tranzakciók között
searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  const filtered = transactions.filter(
    (tx) =>
      tx.category.toLowerCase().includes(query) ||
      tx.description.toLowerCase().includes(query)
  );
  renderTransactions(filtered);
});

// Saját kategória hozzáadása
customCategoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const newCatName = newCategoryInput.value.trim();
  const newCatColor = newCategoryColorInput.value;
  const newCatIcon = newCategoryIconInput.value.trim() || "❓";
  if (newCatName === "") {
    alert("Kérlek, adj meg egy kategória nevet.");
    return;
  }
  if (categories.some((cat) => cat.name.toLowerCase() === newCatName.toLowerCase())) {
    alert("Ez a kategória már létezik.");
    return;
  }
  const newCat = { name: newCatName, color: newCatColor, icon: newCatIcon };
  categories.push(newCat);
  addCategoryToDB(newCat);
  customCategoryForm.reset();
});

// Megtakarítások kezelése
savingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = parseFloat(document.getElementById("savings-amount").value);
  const opType = document.getElementById("savings-type").value;
  if (isNaN(amount)) {
    alert("Kérlek, adj meg érvényes összeget.");
    return;
  }
  if (opType === "befizetés") {
    localSavingsBalance += amount;
  } else if (opType === "kivonás") {
    localSavingsBalance -= amount;
  }
  savingsBalanceEl.textContent = localSavingsBalance.toFixed(2);
  addSavingsToDB(localSavingsBalance);
  savingsForm.reset();
});

// Költségvetés beállítása
budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  monthlyBudget = parseFloat(monthlyBudgetInput.value);
  if (isNaN(monthlyBudget)) {
    alert("Kérlek, adj meg érvényes költségvetést.");
    return;
  }
  addBudgetToDB(monthlyBudget);
  updateBudgetDisplay();
  budgetForm.reset();
});

// Adatok exportálása CSV-be
exportBtn.addEventListener("click", () => {
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "type,amount,category,description,timestamp\n";
  transactions.forEach((tx) => {
    const row = `${tx.type},${tx.amount},${tx.category},${tx.description},${tx.timestamp}`;
    csvContent += row + "\n";
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "transactions.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// Adatok importálása CSV-ből
importBtn.addEventListener("click", () => {
  const file = importFileInput.files[0];
  if (!file) {
    alert("Kérlek, válassz egy CSV fájlt.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split("\n").slice(1);
    lines.forEach((line) => {
      if (line.trim() !== "") {
        const parts = line.split(",");
        const [type, amount, category, description, timestamp] = parts;
        const newTx = {
          type: type,
          amount: parseFloat(amount),
          category: category,
          description: description,
          timestamp: timestamp,
        };
        addTransactionToDB(newTx, function(id) {
          newTx.id = id;
          transactions.push(newTx);
          renderTransactions(transactions);
          updateMonthlyExpenses();
          updateChart();
        });
      }
    });
  };
  reader.readAsText(file);
});

// Teszt értesítés
notifyBtn.addEventListener("click", () => {
  sendNotification("Teszt Értesítés", "Ez egy teszt push értesítés.");
});

// Inicializálás az oldal betöltésekor
window.addEventListener("load", () => {
  initIndexedDB();
  appContent.style.display = "none";
  checkPIN();
});
