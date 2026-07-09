(function () {
  "use strict";

  const categories = ["業者", "本部", "SV", "修理", "採用", "行政", "取引先", "その他"];

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    totalCount: $("#totalCount"),
    resultCount: $("#resultCount"),
    cardList: $("#cardList"),
    emptyState: $("#emptyState"),
    searchPanel: $("#searchPanel"),
    settingsPanel: $("#settingsPanel"),
    keywordInput: $("#keywordInput"),
    categoryFilter: $("#categoryFilter"),
    clearSearchButton: $("#clearSearchButton"),
    formDialog: $("#formDialog"),
    cardForm: $("#cardForm"),
    formTitle: $("#formTitle"),
    closeFormButton: $("#closeFormButton"),
    cancelFormButton: $("#cancelFormButton"),
    cardId: $("#cardId"),
    companyInput: $("#companyInput"),
    nameInput: $("#nameInput"),
    positionInput: $("#positionInput"),
    phoneInput: $("#phoneInput"),
    emailInput: $("#emailInput"),
    categoryInput: $("#categoryInput"),
    memoInput: $("#memoInput"),
    lastContactDateInput: $("#lastContactDateInput"),
    frontImageButton: $("#frontImageButton"),
    backImageButton: $("#backImageButton"),
    frontImageInput: $("#frontImageInput"),
    backImageInput: $("#backImageInput"),
    frontPreview: $("#frontPreview"),
    backPreview: $("#backPreview"),
    formError: $("#formError"),
    detailDialog: $("#detailDialog"),
    detailName: $("#detailName"),
    detailFrontImage: $("#detailFrontImage"),
    detailBackImage: $("#detailBackImage"),
    detailFields: $("#detailFields"),
    closeDetailButton: $("#closeDetailButton"),
    editButton: $("#editButton"),
    deleteButton: $("#deleteButton"),
    openFormButton: $("#openFormButton"),
    showListButton: $("#showListButton"),
    showSearchButton: $("#showSearchButton"),
    showSettingsButton: $("#showSettingsButton"),
    exportButton: $("#exportButton"),
    importButton: $("#importButton"),
    importFileInput: $("#importFileInput"),
    toast: $("#toast")
  };

  let toastTimer;
  let frontImage = "";
  let backImage = "";
  let selectedCard = null;

  function fallback(value) {
    return value && String(value).trim() ? value : "未登録";
  }

  function escapeText(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function populateCategories() {
    categories.forEach((category) => {
      const filterOption = new Option(category, category);
      const inputOption = new Option(category, category);
      elements.categoryFilter.add(filterOption);
      elements.categoryInput.add(inputOption);
    });
  }

  function setPreview(target, imageData, emptyText) {
    target.innerHTML = "";
    if (imageData) {
      const image = document.createElement("img");
      image.src = imageData;
      image.alt = emptyText;
      target.append(image);
      target.classList.add("has-image");
    } else {
      target.textContent = emptyText;
      target.classList.remove("has-image");
    }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = setTimeout(() => {
      elements.toast.hidden = true;
    }, 3200);
  }

  function showError(message) {
    elements.formError.textContent = message;
    elements.formError.hidden = !message;
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    dialog.close();
  }

  function resetForm(card) {
    selectedCard = card || null;
    elements.formTitle.textContent = card ? "名刺編集" : "名刺登録";
    elements.cardId.value = card ? card.id : "";
    elements.companyInput.value = card ? card.company || "" : "";
    elements.nameInput.value = card ? card.name || "" : "";
    elements.positionInput.value = card ? card.position || "" : "";
    elements.phoneInput.value = card ? card.phone || "" : "";
    elements.emailInput.value = card ? card.email || "" : "";
    elements.categoryInput.value = card ? card.category || "その他" : "その他";
    elements.memoInput.value = card ? card.memo || "" : "";
    elements.lastContactDateInput.value = card ? card.lastContactDate || "" : "";
    frontImage = card ? card.frontImage || "" : "";
    backImage = card ? card.backImage || "" : "";
    elements.frontImageInput.value = "";
    elements.backImageInput.value = "";
    setPreview(elements.frontPreview, frontImage, "表面画像");
    setPreview(elements.backPreview, backImage, "裏面画像");
    showError("");
  }

  function cardFromForm() {
    const now = new Date().toISOString();
    const id = elements.cardId.value || (crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`);
    return {
      id,
      company: elements.companyInput.value.trim(),
      name: elements.nameInput.value.trim(),
      position: elements.positionInput.value.trim(),
      phone: elements.phoneInput.value.trim(),
      email: elements.emailInput.value.trim(),
      category: elements.categoryInput.value || "その他",
      memo: elements.memoInput.value.trim(),
      lastContactDate: elements.lastContactDateInput.value,
      frontImage,
      backImage,
      createdAt: selectedCard ? selectedCard.createdAt : now,
      updatedAt: now
    };
  }

  function renderCards(cards, total) {
    elements.totalCount.textContent = total;
    elements.resultCount.textContent = cards.length;
    elements.cardList.innerHTML = "";
    elements.emptyState.hidden = cards.length !== 0;

    cards.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "business-card";
      button.dataset.id = card.id;
      button.innerHTML = `
        <div class="thumb">${card.frontImage ? `<img src="${card.frontImage}" alt="表面サムネイル">` : "<span>画像なし</span>"}</div>
        <div class="card-copy">
          <div class="card-topline">
            <span>${escapeText(fallback(card.category))}</span>
          </div>
          <h2>${escapeText(fallback(card.company))}</h2>
          <p class="name">${escapeText(fallback(card.name))}</p>
          <p>${escapeText(fallback(card.position))}</p>
          <p>${escapeText(fallback(card.phone))}</p>
        </div>
      `;
      elements.cardList.append(button);
    });
  }

  function renderDetail(card) {
    selectedCard = card;
    elements.detailName.textContent = fallback(card.name);
    setPreview(elements.detailFrontImage, card.frontImage, "表面画像なし");
    setPreview(elements.detailBackImage, card.backImage, "裏面画像なし");
    elements.detailFields.innerHTML = "";

    const fields = [
      ["会社名", fallback(card.company)],
      ["氏名", fallback(card.name)],
      ["役職", fallback(card.position)],
      ["カテゴリ", fallback(card.category)],
      ["電話番号", card.phone ? `<a href="tel:${escapeText(card.phone)}">${escapeText(card.phone)}</a>` : "未登録"],
      ["メール", card.email ? `<a href="mailto:${escapeText(card.email)}">${escapeText(card.email)}</a>` : "未登録"],
      ["最終連絡日", fallback(card.lastContactDate)],
      ["メモ", fallback(card.memo)]
    ];

    fields.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "detail-field";
      item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      elements.detailFields.append(item);
    });
  }

  function setActiveNav(activeButton) {
    [elements.showListButton, elements.showSearchButton, elements.showSettingsButton].forEach((button) => {
      button.classList.toggle("active", button === activeButton);
    });
  }

  function showSettings(show) {
    elements.settingsPanel.hidden = !show;
    elements.searchPanel.hidden = show ? true : false;
    setActiveNav(show ? elements.showSettingsButton : elements.showListButton);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.CardStockUI = {
    categories,
    elements,
    populateCategories,
    fallback,
    renderCards,
    renderDetail,
    resetForm,
    cardFromForm,
    openDialog,
    closeDialog,
    showToast,
    showError,
    setPreview,
    setFrontImage(value) {
      frontImage = value;
      setPreview(elements.frontPreview, frontImage, "表面画像");
    },
    setBackImage(value) {
      backImage = value;
      setPreview(elements.backPreview, backImage, "裏面画像");
    },
    getSelectedCard() {
      return selectedCard;
    },
    showSettings,
    showSearch() {
      elements.settingsPanel.hidden = true;
      elements.searchPanel.hidden = false;
      setActiveNav(elements.showSearchButton);
      elements.keywordInput.focus();
    },
    showList() {
      elements.settingsPanel.hidden = true;
      elements.searchPanel.hidden = false;
      setActiveNav(elements.showListButton);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
})();
