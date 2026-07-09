(function () {
  "use strict";

  const ui = window.CardStockUI;
  const db = window.CardStockDB;
  const imageTools = window.CardStockImage;

  let allCards = [];
  let allCompanies = [];
  let cameraStream = null;
  let pendingCapture = "";
  let customCategories = [];

  function uid(prefix) {
    return crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/株式会社|有限会社|合同会社|\(株\)|（株）|inc\.?|co\.,?\s*ltd\.?|corp\.?|corporation|company|株式会社/g, "")
      .replace(/[\\s　・.,\-ー＿_]/g, "")
      .trim();
  }

  function sortCards(cards) {
    return cards.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  function sortCompanies(companies) {
    return companies.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  function filteredCards() {
    const keyword = normalize(ui.elements.keywordInput.value);
    const category = ui.elements.categoryFilter.value;
    const companyId = ui.elements.companyFilter.value;
    return allCards.filter((card) => {
      const keywordFields = [
        card.company,
        card.name,
        card.department,
        card.position,
        card.phone,
        card.mobile,
        card.email,
        card.address,
        card.website,
        card.memo
      ].map(normalize).join(" ");
      return (!category || card.category === category) &&
        (!companyId || card.companyId === companyId) &&
        (!keyword || keywordFields.includes(keyword));
    });
  }

  function findCompanyCandidates(name) {
    const target = normalize(name);
    if (!target) return [];
    return allCompanies
      .map((company) => {
        const source = company.normalizedName || normalize(company.name);
        const score = source === target ? 3 : source.includes(target) || target.includes(source) ? 2 : commonPrefix(source, target) >= 3 ? 1 : 0;
        return { ...company, score };
      })
      .filter((company) => company.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  function commonPrefix(a, b) {
    let count = 0;
    while (a[count] && a[count] === b[count]) count += 1;
    return count;
  }

  function companyFromCard(card, existingCompany) {
    const now = new Date().toISOString();
    const name = card.company || existingCompany?.name || "";
    return {
      companyId: existingCompany?.companyId || card.companyId || uid("company"),
      name,
      normalizedName: normalize(name),
      phone: existingCompany?.phone || card.phone || "",
      address: existingCompany?.address || card.address || "",
      website: existingCompany?.website || card.website || "",
      memo: existingCompany?.memo || "",
      createdAt: existingCompany?.createdAt || now,
      updatedAt: now
    };
  }

  async function ensureCompanyForCard(card, allowConfirm) {
    const candidates = card.companyId ? allCompanies.filter((company) => company.companyId === card.companyId) : findCompanyCandidates(card.company);
    let company = candidates[0];

    if (!card.companyId && allowConfirm && candidates.length && candidates[0].score < 3) {
      const useExisting = window.confirm(`「${card.company}」は既存の「${candidates[0].name}」に近い会社名です。\n既存の会社に統合しますか？`);
      company = useExisting ? candidates[0] : null;
    }

    const savedCompany = companyFromCard(card, company);
    await db.saveCompany(savedCompany);
    card.companyId = savedCompany.companyId;
    card.company = card.company || savedCompany.name;
    return card;
  }

  async function migrateExistingCards() {
    let changed = false;
    for (const card of allCards) {
      if (!card.companyId && card.company) {
        await ensureCompanyForCard(card, false);
        await db.saveCard(card);
        changed = true;
      }
    }
    if (changed) {
      allCards = sortCards(await db.getAllCards());
      allCompanies = sortCompanies(await db.getAllCompanies());
      await db.setMeta("schemaVersion", 2);
    }
  }

  async function refresh() {
    allCards = sortCards(await db.getAllCards());
    allCompanies = sortCompanies(await db.getAllCompanies());
    await migrateExistingCards();
    ui.populateCompanyOptions(allCompanies, ui.elements.companyCandidateInput.value);
    if (ui.elements.companyList.hidden) {
      ui.renderCards(filteredCards(), allCards.length);
    } else {
      ui.renderCompanies(allCompanies, allCards);
    }
  }

  async function loadCustomCategories() {
    const meta = await db.getMeta("customCategories");
    customCategories = Array.isArray(meta?.value) ? meta.value : [];
    ui.setCategories(customCategories);
  }

  async function saveCustomCategories() {
    customCategories = ui.getCustomCategories();
    await db.setMeta("customCategories", customCategories);
  }

  async function handleImage(input, setter) {
    const file = input.files && input.files[0];
    if (!file) return;
    ui.showError("");
    try {
      const compressed = await imageTools.compressImage(file);
      setter(compressed.dataURL);
      ui.showToast("画像を圧縮しました。");
    } catch (error) {
      ui.showError(error.message || "画像を処理できませんでした。");
    } finally {
      input.value = "";
    }
  }

  function extractOcrFields(rawText) {
    const text = String(rawText || "");
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
    const website = (text.match(/https?:\/\/[^\s]+|www\.[^\s]+/i) || [""])[0];
    const postalCode = (text.match(/〒?\s?\d{3}[-ー]\d{4}/) || [""])[0].replace(/[〒\s]/g, "");
    const phones = Array.from(text.matchAll(/0\d{1,4}[-ー(]?\d{1,4}[-ー)]?\d{3,4}/g)).map((m) => m[0]);
    const mobile = phones.find((phone) => /^0[789]0/.test(phone.replace(/\D/g, ""))) || "";
    const phone = phones.find((phone) => phone !== mobile) || "";
    const address = lines.find((line) => /(都|道|府|県|市|区|町|村|丁目|番地)/.test(line)) || "";
    const company = lines.find((line) => /(株式会社|有限会社|合同会社|\(株\)|（株）|Inc\.|Co\.,?\s*Ltd\.?)/i.test(line)) || guessCompanyFromEmail(email);
    const position = lines.find((line) => /(部長|課長|店長|代表|取締役|マネージャー|Manager|Director|SV|主任)/i.test(line)) || "";
    const name = lines.find((line) => {
      if (line === company || line === position) return false;
      if (/[0-9@:/]/.test(line)) return false;
      return line.length >= 2 && line.length <= 16;
    }) || "";

    return {
      rawText: text,
      company,
      name,
      department: "",
      position,
      phone,
      mobile,
      email,
      postalCode,
      address,
      website,
      memo: text ? `OCR結果:\n${text}` : ""
    };
  }

  function guessCompanyFromEmail(email) {
    if (!email) return "";
    const domain = email.split("@")[1] || "";
    const name = domain.split(".")[0] || "";
    return name && !["gmail", "icloud", "yahoo", "outlook", "hotmail"].includes(name.toLowerCase()) ? name : "";
  }

  async function loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("OCRライブラリを読み込めませんでした。手入力で登録してください。"));
      document.head.append(script);
    });
    return window.Tesseract;
  }

  async function runOcr(dataURL) {
    ui.elements.ocrStatus.hidden = false;
    try {
      const Tesseract = await loadTesseract();
      const canvas = await imageTools.dataURLToPreparedCanvas(dataURL);
      const result = await Tesseract.recognize(canvas, "jpn+eng", {
        logger(message) {
          if (message.status) ui.elements.ocrStatus.textContent = `名刺情報を読み取り中です ${Math.round((message.progress || 0) * 100)}%`;
        }
      });
      return extractOcrFields(result.data.text);
    } catch (error) {
      ui.showToast(error.message || "OCRに失敗しました。手入力で登録できます。");
      return {};
    } finally {
      ui.elements.ocrStatus.hidden = true;
      ui.elements.ocrStatus.textContent = "名刺情報を読み取り中です";
    }
  }

  async function startCamera() {
    ui.showCameraError("");
    pendingCapture = "";
    ui.elements.capturedPreview.hidden = true;
    ui.elements.cameraStage.hidden = false;
    ui.elements.captureButton.hidden = false;
    ui.elements.retakeButton.hidden = true;
    ui.elements.useCaptureButton.hidden = true;
    ui.openDialog(ui.elements.cameraDialog);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      ui.showCameraError("このブラウザではカメラを直接起動できません。画像を選択してください。");
      return;
    }
    try {
      stopCamera();
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 }, height: { ideal: 1000 } },
        audio: false
      });
      ui.elements.cameraVideo.srcObject = cameraStream;
    } catch (error) {
      ui.showCameraError("カメラを起動できませんでした。画像選択で登録できます。");
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    ui.elements.cameraVideo.srcObject = null;
  }

  function showCaptured(dataURL) {
    pendingCapture = dataURL;
    ui.elements.capturedPreview.innerHTML = `<img src="${dataURL}" alt="撮影画像プレビュー">`;
    ui.elements.capturedPreview.hidden = false;
    ui.elements.cameraStage.hidden = true;
    ui.elements.captureButton.hidden = true;
    ui.elements.retakeButton.hidden = false;
    ui.elements.useCaptureButton.hidden = false;
  }

  async function useCapturedImage() {
    if (!pendingCapture) return;
    stopCamera();
    ui.closeDialog(ui.elements.cameraDialog);
    ui.resetForm(null, { frontImage: pendingCapture });
    ui.openDialog(ui.elements.formDialog);
    const ocrData = await runOcr(pendingCapture);
    ui.resetForm(null, { ...ocrData, frontImage: pendingCapture, category: "その他" });
    const candidates = findCompanyCandidates(ocrData.company);
    ui.renderCompanySuggestion(candidates);
    if (candidates[0]?.score === 3) ui.elements.companyCandidateInput.value = candidates[0].companyId;
    ui.showToast("読み取り結果を確認して保存してください。");
  }

  function exportBackup() {
    const backup = {
      app: "Card Stock",
      version: 2,
      exportedAt: new Date().toISOString(),
      customCategories: ui.getCustomCategories(),
      cards: allCards,
      companies: allCompanies
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `card-stock-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    ui.showToast("バックアップを書き出しました。");
  }

  function normalizeImportedCards(cards) {
    const now = new Date().toISOString();
    return cards.map((card) => ({
      id: card.id || uid("card"),
      companyId: card.companyId || "",
      company: card.company || "",
      name: card.name || "",
      department: card.department || "",
      position: card.position || "",
      phone: card.phone || "",
      mobile: card.mobile || "",
      email: card.email || "",
      postalCode: card.postalCode || "",
      address: card.address || "",
      website: card.website || "",
      category: ui.categories.includes(card.category) ? card.category : "その他",
      memo: card.memo || "",
      lastContactDate: card.lastContactDate || "",
      frontImage: card.frontImage || "",
      backImage: card.backImage || "",
      createdAt: card.createdAt || now,
      updatedAt: card.updatedAt || now
    }));
  }

  function normalizeImportedCompanies(companies) {
    const now = new Date().toISOString();
    return companies.map((company) => ({
      companyId: company.companyId || uid("company"),
      name: company.name || "",
      normalizedName: company.normalizedName || normalize(company.name),
      phone: company.phone || "",
      address: company.address || "",
      website: company.website || "",
      memo: company.memo || "",
      createdAt: company.createdAt || now,
      updatedAt: company.updatedAt || now
    }));
  }

  async function importBackup(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      throw new Error("JSONファイルを読み込めませんでした。");
    }
    const cards = Array.isArray(parsed) ? parsed : parsed.cards;
    const companies = Array.isArray(parsed?.companies) ? parsed.companies : [];
    const importedCustomCategories = Array.isArray(parsed?.customCategories) ? parsed.customCategories : [];
    if (!Array.isArray(cards)) throw new Error("Card Stockのバックアップ形式ではありません。");
    const mode = window.confirm("既存データを上書きしますか？\nOK: 上書き復元\nキャンセル: 追加インポート") ? "replace" : "append";
    if (!window.confirm(`${mode === "replace" ? "上書き復元" : "追加インポート"}を実行しますか？`)) return;

    const normalizedCards = normalizeImportedCards(cards);
    const normalizedCompanies = normalizeImportedCompanies(companies);
    if (mode === "replace") await db.replaceAll(normalizedCards, normalizedCompanies);
    else await db.addAll(normalizedCards.map((card) => ({ ...card, id: uid("card") })), normalizedCompanies);
    const mergedCategories = mode === "replace" ? importedCustomCategories : Array.from(new Set(ui.getCustomCategories().concat(importedCustomCategories)));
    ui.setCategories(mergedCategories);
    await saveCustomCategories();
    await refresh();
    ui.showToast("復元が完了しました。");
  }

  function bindEvents() {
    ui.elements.openFormButton.addEventListener("click", () => {
      ui.resetForm();
      ui.openDialog(ui.elements.formDialog);
    });
    ui.elements.openCameraButton.addEventListener("click", startCamera);
    ui.elements.closeCameraButton.addEventListener("click", () => {
      stopCamera();
      ui.closeDialog(ui.elements.cameraDialog);
    });
    ui.elements.cameraFileButton.addEventListener("click", () => ui.elements.cameraFileInput.click());
    ui.elements.cameraFileInput.addEventListener("change", async () => {
      const file = ui.elements.cameraFileInput.files && ui.elements.cameraFileInput.files[0];
      if (!file) return;
      try {
        const image = await imageTools.compressImage(file);
        showCaptured(image.dataURL);
      } catch (error) {
        ui.showCameraError(error.message || "画像を処理できませんでした。");
      } finally {
        ui.elements.cameraFileInput.value = "";
      }
    });
    ui.elements.captureButton.addEventListener("click", () => {
      try {
        const image = imageTools.captureVideoFrame(ui.elements.cameraVideo, true);
        showCaptured(image.dataURL);
      } catch (error) {
        ui.showCameraError("撮影できませんでした。画像を選択してください。");
      }
    });
    ui.elements.retakeButton.addEventListener("click", () => {
      pendingCapture = "";
      ui.elements.capturedPreview.hidden = true;
      ui.elements.cameraStage.hidden = false;
      ui.elements.captureButton.hidden = false;
      ui.elements.retakeButton.hidden = true;
      ui.elements.useCaptureButton.hidden = true;
    });
    ui.elements.useCaptureButton.addEventListener("click", useCapturedImage);

    ui.elements.closeFormButton.addEventListener("click", () => ui.closeDialog(ui.elements.formDialog));
    ui.elements.cancelFormButton.addEventListener("click", () => ui.closeDialog(ui.elements.formDialog));
    ui.elements.closeDetailButton.addEventListener("click", () => ui.closeDialog(ui.elements.detailDialog));
    ui.elements.closeCompanyButton.addEventListener("click", () => ui.closeDialog(ui.elements.companyDialog));
    ui.elements.cancelCompanyButton.addEventListener("click", () => ui.closeDialog(ui.elements.companyDialog));

    ui.elements.frontImageButton.addEventListener("click", () => ui.elements.frontImageInput.click());
    ui.elements.backImageButton.addEventListener("click", () => ui.elements.backImageInput.click());
    ui.elements.frontImageInput.addEventListener("change", () => handleImage(ui.elements.frontImageInput, ui.setFrontImage));
    ui.elements.backImageInput.addEventListener("change", () => handleImage(ui.elements.backImageInput, ui.setBackImage));

    ui.elements.companyInput.addEventListener("input", () => ui.renderCompanySuggestion(findCompanyCandidates(ui.elements.companyInput.value)));
    ui.elements.companySuggestionBox.addEventListener("click", (event) => {
      const button = event.target.closest(".suggestion-button");
      if (!button) return;
      ui.elements.companyCandidateInput.value = button.dataset.companyId;
      const company = allCompanies.find((item) => item.companyId === button.dataset.companyId);
      if (company) ui.elements.companyInput.value = company.name;
      ui.renderCompanySuggestion([]);
    });

    ui.elements.cardForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const card = await ensureCompanyForCard(ui.cardFromForm(), true);
        await db.saveCard(card);
        ui.closeDialog(ui.elements.formDialog);
        await refresh();
        ui.showToast("名刺を保存しました。");
      } catch (error) {
        ui.showError("保存できませんでした。端末の空き容量を確認してください。");
      }
    });

    ui.elements.cardList.addEventListener("click", async (event) => {
      const cardButton = event.target.closest(".business-card");
      if (!cardButton) return;
      const card = await db.getCard(cardButton.dataset.id);
      if (!card) return;
      ui.renderDetail(card);
      ui.openDialog(ui.elements.detailDialog);
    });

    ui.elements.companyList.addEventListener("click", async (event) => {
      const companyButton = event.target.closest(".company-card");
      if (!companyButton) return;
      const company = await db.getCompany(companyButton.dataset.companyId);
      if (!company) return;
      ui.renderCompanyDetail(company, allCards);
      ui.openDialog(ui.elements.companyDialog);
    });

    ui.elements.editButton.addEventListener("click", () => {
      const card = ui.getSelectedCard();
      if (!card) return;
      ui.closeDialog(ui.elements.detailDialog);
      ui.resetForm(card);
      ui.openDialog(ui.elements.formDialog);
    });

    ui.elements.deleteButton.addEventListener("click", async () => {
      const card = ui.getSelectedCard();
      if (!card || !window.confirm("この名刺を削除しますか？")) return;
      await db.deleteCard(card.id);
      ui.closeDialog(ui.elements.detailDialog);
      await refresh();
      ui.showToast("削除しました。");
    });

    ui.elements.companyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const company = ui.companyFromForm();
      company.normalizedName = normalize(company.name);
      await db.saveCompany(company);
      ui.closeDialog(ui.elements.companyDialog);
      await refresh();
      ui.showToast("会社情報を保存しました。");
    });

    [ui.elements.keywordInput, ui.elements.categoryFilter, ui.elements.companyFilter].forEach((element) => {
      element.addEventListener("input", () => ui.renderCards(filteredCards(), allCards.length));
      element.addEventListener("change", () => ui.renderCards(filteredCards(), allCards.length));
    });
    ui.elements.clearSearchButton.addEventListener("click", () => {
      ui.elements.keywordInput.value = "";
      ui.elements.categoryFilter.value = "";
      ui.elements.companyFilter.value = "";
      ui.renderCards(filteredCards(), allCards.length);
    });

    ui.elements.personViewButton.addEventListener("click", () => ui.switchPersonView(filteredCards(), allCards.length));
    ui.elements.companyViewButton.addEventListener("click", () => ui.renderCompanies(allCompanies, allCards));
    ui.elements.showListButton.addEventListener("click", () => {
      ui.showList();
      ui.switchPersonView(filteredCards(), allCards.length);
    });
    ui.elements.showCompaniesButton.addEventListener("click", () => {
      ui.showList();
      ui.setActiveNav(ui.elements.showCompaniesButton);
      ui.renderCompanies(allCompanies, allCards);
    });
    ui.elements.showSearchButton.addEventListener("click", ui.showSearch);
    ui.elements.showSettingsButton.addEventListener("click", () => ui.showSettings(true));
    ui.elements.exportButton.addEventListener("click", exportBackup);
    ui.elements.importButton.addEventListener("click", () => ui.elements.importFileInput.click());
    ui.elements.addCategoryButton.addEventListener("click", async () => {
      const value = ui.elements.customCategoryInput.value.trim();
      if (!value) {
        ui.showToast("カテゴリ名を入力してください。");
        return;
      }
      if (ui.categories.includes(value)) {
        ui.showToast("同じカテゴリがすでにあります。");
        return;
      }
      ui.setCategories(ui.getCustomCategories().concat(value));
      ui.elements.customCategoryInput.value = "";
      await saveCustomCategories();
      ui.showToast("カテゴリを追加しました。");
    });
    ui.elements.categoryList.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-category]");
      if (!button) return;
      const category = button.dataset.category;
      if (!window.confirm(`カテゴリ「${category}」を一覧から削除しますか？\n既存の名刺データのカテゴリ名は変更されません。`)) return;
      ui.setCategories(ui.getCustomCategories().filter((item) => item !== category));
      await saveCustomCategories();
      ui.showToast("カテゴリを削除しました。");
    });
    ui.elements.importFileInput.addEventListener("change", async () => {
      const file = ui.elements.importFileInput.files && ui.elements.importFileInput.files[0];
      if (!file) return;
      try {
        await importBackup(file);
      } catch (error) {
        ui.showToast(error.message || "復元できませんでした。");
      } finally {
        ui.elements.importFileInput.value = "";
      }
    });
  }

  async function init() {
    await loadCustomCategories();
    bindEvents();
    await refresh();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
