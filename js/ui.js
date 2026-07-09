(function () {
  "use strict";

  const defaultCategories = ["業者", "本部", "SV", "修理", "採用", "行政", "取引先", "同業他社", "その他"];
  let categories = defaultCategories.slice();
  const $ = (selector) => document.querySelector(selector);

  const elements = {
    totalCount: $("#totalCount"),
    resultCount: $("#resultCount"),
    cardList: $("#cardList"),
    companyList: $("#companyList"),
    emptyState: $("#emptyState"),
    searchPanel: $("#searchPanel"),
    settingsPanel: $("#settingsPanel"),
    keywordInput: $("#keywordInput"),
    categoryFilter: $("#categoryFilter"),
    companyFilter: $("#companyFilter"),
    clearSearchButton: $("#clearSearchButton"),
    personViewButton: $("#personViewButton"),
    companyViewButton: $("#companyViewButton"),
    formDialog: $("#formDialog"),
    cardForm: $("#cardForm"),
    formTitle: $("#formTitle"),
    closeFormButton: $("#closeFormButton"),
    cancelFormButton: $("#cancelFormButton"),
    cardId: $("#cardId"),
    companyInput: $("#companyInput"),
    nameInput: $("#nameInput"),
    departmentInput: $("#departmentInput"),
    positionInput: $("#positionInput"),
    phoneInput: $("#phoneInput"),
    mobileInput: $("#mobileInput"),
    emailInput: $("#emailInput"),
    postalCodeInput: $("#postalCodeInput"),
    addressInput: $("#addressInput"),
    websiteInput: $("#websiteInput"),
    categoryInput: $("#categoryInput"),
    companyCandidateInput: $("#companyCandidateInput"),
    companySuggestionBox: $("#companySuggestionBox"),
    memoInput: $("#memoInput"),
    lastContactDateInput: $("#lastContactDateInput"),
    frontImageButton: $("#frontImageButton"),
    backImageButton: $("#backImageButton"),
    frontImageInput: $("#frontImageInput"),
    backImageInput: $("#backImageInput"),
    frontPreview: $("#frontPreview"),
    backPreview: $("#backPreview"),
    formError: $("#formError"),
    cameraDialog: $("#cameraDialog"),
    closeCameraButton: $("#closeCameraButton"),
    cameraVideo: $("#cameraVideo"),
    cameraStage: $("#cameraStage"),
    capturedPreview: $("#capturedPreview"),
    cameraError: $("#cameraError"),
    ocrStatus: $("#ocrStatus"),
    cameraFileButton: $("#cameraFileButton"),
    cameraFileInput: $("#cameraFileInput"),
    captureButton: $("#captureButton"),
    retakeButton: $("#retakeButton"),
    useCaptureButton: $("#useCaptureButton"),
    detailDialog: $("#detailDialog"),
    detailName: $("#detailName"),
    detailFrontImage: $("#detailFrontImage"),
    detailBackImage: $("#detailBackImage"),
    detailFields: $("#detailFields"),
    closeDetailButton: $("#closeDetailButton"),
    editButton: $("#editButton"),
    deleteButton: $("#deleteButton"),
    companyDialog: $("#companyDialog"),
    companyForm: $("#companyForm"),
    closeCompanyButton: $("#closeCompanyButton"),
    cancelCompanyButton: $("#cancelCompanyButton"),
    companyDetailName: $("#companyDetailName"),
    companyIdInput: $("#companyIdInput"),
    companyNameEdit: $("#companyNameEdit"),
    companyPhoneEdit: $("#companyPhoneEdit"),
    companyWebsiteEdit: $("#companyWebsiteEdit"),
    companyAddressEdit: $("#companyAddressEdit"),
    companyMemoEdit: $("#companyMemoEdit"),
    companyPeopleList: $("#companyPeopleList"),
    openFormButton: $("#openFormButton"),
    openCameraButton: $("#openCameraButton"),
    showListButton: $("#showListButton"),
    showCompaniesButton: $("#showCompaniesButton"),
    showSearchButton: $("#showSearchButton"),
    showSettingsButton: $("#showSettingsButton"),
    exportButton: $("#exportButton"),
    importButton: $("#importButton"),
    importFileInput: $("#importFileInput"),
    customCategoryInput: $("#customCategoryInput"),
    addCategoryButton: $("#addCategoryButton"),
    categoryList: $("#categoryList"),
    toast: $("#toast")
  };

  let toastTimer;
  let frontImage = "";
  let backImage = "";
  let selectedCard = null;
  let selectedCompany = null;
  let currentView = "person";

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

  function safeUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return /^https?:\/\//i.test(text) ? text : `https://${text}`;
  }

  function populateCategories() {
    elements.categoryFilter.length = 1;
    elements.categoryInput.length = 0;
    categories.forEach((category) => {
      elements.categoryFilter.add(new Option(category, category));
      elements.categoryInput.add(new Option(category, category));
    });
    renderCategoryList();
  }

  function setCategories(customCategories) {
    const merged = defaultCategories.concat(customCategories || []);
    categories = Array.from(new Set(merged.map((item) => String(item || "").trim()).filter(Boolean)));
    populateCategories();
  }

  function getCustomCategories() {
    return categories.filter((category) => !defaultCategories.includes(category));
  }

  function renderCategoryList() {
    elements.categoryList.innerHTML = "";
    categories.forEach((category) => {
      const item = document.createElement("div");
      item.className = "category-chip-row";
      const isDefault = defaultCategories.includes(category);
      item.innerHTML = `
        <span>${escapeText(category)}${isDefault ? "（標準）" : ""}</span>
        ${isDefault ? "" : `<button class="ghost-button" type="button" data-category="${escapeText(category)}">削除</button>`}
      `;
      elements.categoryList.append(item);
    });
  }

  function populateCompanyOptions(companies, selectedCompanyId) {
    elements.companyFilter.length = 1;
    elements.companyCandidateInput.length = 0;
    elements.companyCandidateInput.add(new Option("新しい会社として保存", ""));
    companies
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"))
      .forEach((company) => {
        elements.companyFilter.add(new Option(company.name || "未登録", company.companyId));
        elements.companyCandidateInput.add(new Option(company.name || "未登録", company.companyId));
      });
    elements.companyCandidateInput.value = selectedCompanyId || "";
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
    }, 3400);
  }

  function showError(message) {
    elements.formError.textContent = message;
    elements.formError.hidden = !message;
  }

  function showCameraError(message) {
    elements.cameraError.textContent = message;
    elements.cameraError.hidden = !message;
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (dialog.open) dialog.close();
  }

  function resetForm(card, ocrData) {
    selectedCard = card || null;
    const data = { ...(card || {}), ...(ocrData || {}) };
    elements.formTitle.textContent = card ? "名刺編集" : "名刺登録";
    elements.cardId.value = card ? card.id : "";
    elements.companyInput.value = data.company || "";
    elements.nameInput.value = data.name || "";
    elements.departmentInput.value = data.department || "";
    elements.positionInput.value = data.position || "";
    elements.phoneInput.value = data.phone || "";
    elements.mobileInput.value = data.mobile || "";
    elements.emailInput.value = data.email || "";
    elements.postalCodeInput.value = data.postalCode || "";
    elements.addressInput.value = data.address || "";
    elements.websiteInput.value = data.website || "";
    elements.categoryInput.value = data.category || "その他";
    elements.companyCandidateInput.value = data.companyId || "";
    elements.memoInput.value = data.memo || "";
    elements.lastContactDateInput.value = data.lastContactDate || "";
    frontImage = data.frontImage || "";
    backImage = data.backImage || "";
    elements.frontImageInput.value = "";
    elements.backImageInput.value = "";
    setPreview(elements.frontPreview, frontImage, "表面画像");
    setPreview(elements.backPreview, backImage, "裏面画像");
    renderCompanySuggestion([]);
    showError("");
  }

  function cardFromForm() {
    const now = new Date().toISOString();
    const id = elements.cardId.value || (crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`);
    return {
      id,
      companyId: elements.companyCandidateInput.value || "",
      company: elements.companyInput.value.trim(),
      name: elements.nameInput.value.trim(),
      department: elements.departmentInput.value.trim(),
      position: elements.positionInput.value.trim(),
      phone: elements.phoneInput.value.trim(),
      mobile: elements.mobileInput.value.trim(),
      email: elements.emailInput.value.trim(),
      postalCode: elements.postalCodeInput.value.trim(),
      address: elements.addressInput.value.trim(),
      website: elements.websiteInput.value.trim(),
      category: elements.categoryInput.value || "その他",
      memo: elements.memoInput.value.trim(),
      lastContactDate: elements.lastContactDateInput.value,
      frontImage,
      backImage,
      createdAt: selectedCard ? selectedCard.createdAt : now,
      updatedAt: now
    };
  }

  function renderCompanySuggestion(candidates) {
    elements.companySuggestionBox.innerHTML = "";
    elements.companySuggestionBox.hidden = !candidates.length;
    candidates.forEach((company) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-button";
      button.dataset.companyId = company.companyId;
      button.textContent = `既存会社候補: ${company.name}`;
      elements.companySuggestionBox.append(button);
    });
  }

  function renderCards(cards, total) {
    elements.totalCount.textContent = total;
    elements.resultCount.textContent = cards.length;
    elements.cardList.innerHTML = "";
    elements.emptyState.hidden = cards.length !== 0;
    elements.cardList.hidden = currentView !== "person";
    elements.companyList.hidden = currentView !== "company";

    cards.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "business-card";
      button.dataset.id = card.id;
      button.innerHTML = `
        <div class="thumb">${card.frontImage ? `<img src="${card.frontImage}" alt="表面サムネイル">` : "<span>画像なし</span>"}</div>
        <div class="card-copy">
          <div class="card-topline"><span>${escapeText(fallback(card.category))}</span></div>
          <h2>${escapeText(fallback(card.company))}</h2>
          <p class="name">${escapeText(fallback(card.name))}</p>
          <p>${escapeText(fallback(card.position || card.department))}</p>
          <p>${escapeText(fallback(card.phone || card.mobile))}</p>
        </div>
      `;
      elements.cardList.append(button);
    });
  }

  function renderCompanies(companies, cards) {
    currentView = "company";
    elements.cardList.hidden = true;
    elements.companyList.hidden = false;
    elements.personViewButton.classList.remove("active");
    elements.companyViewButton.classList.add("active");
    elements.companyList.innerHTML = "";
    elements.resultCount.textContent = companies.length;
    elements.emptyState.hidden = companies.length !== 0;

    companies.forEach((company) => {
      const related = cards.filter((card) => card.companyId === company.companyId);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "company-card";
      button.dataset.companyId = company.companyId;
      button.innerHTML = `
        <div>
          <h2>${escapeText(fallback(company.name))}</h2>
          <p>${related.length}人登録</p>
        </div>
        <div class="company-meta">
          <span>最終登録日: ${escapeText(fallback((company.updatedAt || "").slice(0, 10)))}</span>
          <span>代表電話: ${escapeText(fallback(company.phone))}</span>
          <span>住所: ${escapeText(fallback(company.address))}</span>
          <span>Web: ${escapeText(fallback(company.website))}</span>
        </div>
      `;
      elements.companyList.append(button);
    });
  }

  function switchPersonView(cards, total) {
    currentView = "person";
    elements.personViewButton.classList.add("active");
    elements.companyViewButton.classList.remove("active");
    renderCards(cards, total);
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
      ["部署", fallback(card.department)],
      ["役職", fallback(card.position)],
      ["カテゴリ", fallback(card.category)],
      ["電話番号", card.phone ? `<a href="tel:${escapeText(card.phone)}">${escapeText(card.phone)}</a>` : "未登録"],
      ["携帯番号", card.mobile ? `<a href="tel:${escapeText(card.mobile)}">${escapeText(card.mobile)}</a>` : "未登録"],
      ["メール", card.email ? `<a href="mailto:${escapeText(card.email)}">${escapeText(card.email)}</a>` : "未登録"],
      ["郵便番号", fallback(card.postalCode)],
      ["住所", fallback(card.address)],
      ["Webサイト", card.website ? `<a href="${escapeText(safeUrl(card.website))}" target="_blank" rel="noopener">${escapeText(card.website)}</a>` : "未登録"],
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

  function renderCompanyDetail(company, cards) {
    selectedCompany = company;
    elements.companyIdInput.value = company.companyId;
    elements.companyDetailName.textContent = company.name || "会社詳細";
    elements.companyNameEdit.value = company.name || "";
    elements.companyPhoneEdit.value = company.phone || "";
    elements.companyWebsiteEdit.value = company.website || "";
    elements.companyAddressEdit.value = company.address || "";
    elements.companyMemoEdit.value = company.memo || "";
    elements.companyPeopleList.innerHTML = "";
    cards.filter((card) => card.companyId === company.companyId).forEach((card) => {
      const row = document.createElement("div");
      row.className = "mini-list-row";
      row.innerHTML = `<strong>${escapeText(fallback(card.name))}</strong><span>${escapeText(fallback(card.position || card.department))}</span>`;
      elements.companyPeopleList.append(row);
    });
  }

  function companyFromForm() {
    const now = new Date().toISOString();
    return {
      ...selectedCompany,
      companyId: elements.companyIdInput.value,
      name: elements.companyNameEdit.value.trim(),
      phone: elements.companyPhoneEdit.value.trim(),
      website: elements.companyWebsiteEdit.value.trim(),
      address: elements.companyAddressEdit.value.trim(),
      memo: elements.companyMemoEdit.value.trim(),
      normalizedName: selectedCompany ? selectedCompany.normalizedName : "",
      createdAt: selectedCompany ? selectedCompany.createdAt : now,
      updatedAt: now
    };
  }

  function setActiveNav(activeButton) {
    [elements.showListButton, elements.openCameraButton, elements.showCompaniesButton, elements.showSearchButton, elements.showSettingsButton].forEach((button) => {
      button.classList.toggle("active", button === activeButton);
    });
  }

  function showSettings(show) {
    elements.settingsPanel.hidden = !show;
    elements.searchPanel.hidden = show;
    setActiveNav(show ? elements.showSettingsButton : elements.showListButton);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.CardStockUI = {
    defaultCategories,
    get categories() {
      return categories;
    },
    elements,
    populateCategories,
    setCategories,
    getCustomCategories,
    populateCompanyOptions,
    fallback,
    safeUrl,
    renderCards,
    renderCompanies,
    switchPersonView,
    renderDetail,
    renderCompanyDetail,
    companyFromForm,
    resetForm,
    cardFromForm,
    openDialog,
    closeDialog,
    showToast,
    showError,
    showCameraError,
    renderCompanySuggestion,
    setPreview,
    setFrontImage(value) {
      frontImage = value;
      setPreview(elements.frontPreview, frontImage, "表面画像");
    },
    setBackImage(value) {
      backImage = value;
      setPreview(elements.backPreview, backImage, "裏面画像");
    },
    getSelectedCard: () => selectedCard,
    getSelectedCompany: () => selectedCompany,
    showSettings,
    setActiveNav,
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
