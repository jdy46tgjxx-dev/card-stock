(function () {
  "use strict";

  const ui = window.CardStockUI;
  const db = window.CardStockDB;
  const imageTools = window.CardStockImage;
  let allCards = [];

  function normalize(value) {
    return String(value || "").toLowerCase();
  }

  function filteredCards() {
    const keyword = normalize(ui.elements.keywordInput.value);
    const category = ui.elements.categoryFilter.value;
    return allCards.filter((card) => {
      const categoryMatch = !category || card.category === category;
      const keywordFields = [card.company, card.name, card.position, card.phone, card.email, card.memo].map(normalize).join(" ");
      return categoryMatch && (!keyword || keywordFields.includes(keyword));
    });
  }

  function sortCards(cards) {
    return cards.slice().sort((a, b) => normalize(b.updatedAt).localeCompare(normalize(a.updatedAt)));
  }

  async function refresh() {
    allCards = sortCards(await db.getAllCards());
    ui.renderCards(filteredCards(), allCards.length);
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

  function exportBackup() {
    const backup = {
      app: "Card Stock",
      version: 1,
      exportedAt: new Date().toISOString(),
      cards: allCards
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `card-stock-backup-${date}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    ui.showToast("バックアップを書き出しました。");
  }

  async function importBackup(file) {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error("JSONファイルを読み込めませんでした。");
    }

    const cards = Array.isArray(parsed) ? parsed : parsed.cards;
    if (!Array.isArray(cards)) {
      throw new Error("Card Stockのバックアップ形式ではありません。");
    }

    const mode = window.confirm("既存データを上書きしますか？\nOK: 上書き復元\nキャンセル: 追加インポート") ? "replace" : "append";
    if (!window.confirm(`${mode === "replace" ? "上書き復元" : "追加インポート"}を実行しますか？`)) return;

    const now = new Date().toISOString();
    const normalized = cards.map((card) => ({
      id: card.id || (crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}-${Math.random()}`),
      company: card.company || "",
      name: card.name || "",
      position: card.position || "",
      phone: card.phone || "",
      email: card.email || "",
      category: ui.categories.includes(card.category) ? card.category : "その他",
      memo: card.memo || "",
      lastContactDate: card.lastContactDate || "",
      frontImage: card.frontImage || "",
      backImage: card.backImage || "",
      createdAt: card.createdAt || now,
      updatedAt: card.updatedAt || now
    }));

    if (mode === "replace") {
      await db.replaceCards(normalized);
    } else {
      await db.addCards(normalized.map((card) => ({ ...card, id: crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}-${Math.random()}` })));
    }
    await refresh();
    ui.showToast("復元が完了しました。");
  }

  function bindEvents() {
    ui.elements.openFormButton.addEventListener("click", () => {
      ui.resetForm();
      ui.openDialog(ui.elements.formDialog);
    });

    ui.elements.closeFormButton.addEventListener("click", () => ui.closeDialog(ui.elements.formDialog));
    ui.elements.cancelFormButton.addEventListener("click", () => ui.closeDialog(ui.elements.formDialog));
    ui.elements.closeDetailButton.addEventListener("click", () => ui.closeDialog(ui.elements.detailDialog));

    ui.elements.frontImageButton.addEventListener("click", () => ui.elements.frontImageInput.click());
    ui.elements.backImageButton.addEventListener("click", () => ui.elements.backImageInput.click());
    ui.elements.frontImageInput.addEventListener("change", () => handleImage(ui.elements.frontImageInput, ui.setFrontImage));
    ui.elements.backImageInput.addEventListener("change", () => handleImage(ui.elements.backImageInput, ui.setBackImage));

    ui.elements.cardForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await db.saveCard(ui.cardFromForm());
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

    ui.elements.keywordInput.addEventListener("input", () => ui.renderCards(filteredCards(), allCards.length));
    ui.elements.categoryFilter.addEventListener("change", () => ui.renderCards(filteredCards(), allCards.length));
    ui.elements.clearSearchButton.addEventListener("click", () => {
      ui.elements.keywordInput.value = "";
      ui.elements.categoryFilter.value = "";
      ui.renderCards(filteredCards(), allCards.length);
    });

    ui.elements.showListButton.addEventListener("click", ui.showList);
    ui.elements.showSearchButton.addEventListener("click", ui.showSearch);
    ui.elements.showSettingsButton.addEventListener("click", () => ui.showSettings(true));
    ui.elements.exportButton.addEventListener("click", exportBackup);
    ui.elements.importButton.addEventListener("click", () => ui.elements.importFileInput.click());
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
    ui.populateCategories();
    bindEvents();
    await refresh();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
