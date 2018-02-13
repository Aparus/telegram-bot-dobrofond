const request = require("request");
const fs = require("fs");
const config = require("./config");
// этот модуль хранит информацию об активных диалогах с пользователями, с учетом состояния.
// в зависимости от состояния мы определяем, в какое поле сохранять ответ (тел., имя и т.д.)
// после ответов на все вопросы на основании диалога формируется объект Ситуация, и диалог удаляется
class ActiveDialogs {
  constructor() {
    this.dialogs = [];
    this.scenario = [
      { field: "name", question: "Ваше имя" },
      { field: "phone", question: "Телефон для связи" },
      {
        field: "description",
        question: "Опишите ситуацию текстом или голосом"
      },
      { field: "photo", question: "Добавьте фотографию" }
    ];
  }

  getDialogs() {
    return this.dialogs;
  }

  createDialog(userId, date) {
    this.dialogs.push({ userId, date, state: 0, messages: [] });
  }

  getDialog(userId) {
    return this.dialogs.filter(elem => {
      return elem.userId == userId;
    })[0];
  }

  updateDialog(dialog) {
    return this.dialogs.map(elem => {
      if (elem.userId == dialog.userId) return dialog;
      else return elem;
    });
  }

  deleteDialog(userId) {
    this.dialogs = this.dialogs.filter(elem => {
      return elem.userId != userId;
    });
  }
}

module.exports = ActiveDialogs;
