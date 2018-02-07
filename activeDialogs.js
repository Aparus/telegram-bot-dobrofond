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

  // Dialog contains separated messages, we should extract valuable for us data to one "situation" object
  // Situation is a row of DB, where we structure and save data from dialog.
  // Dialog will be deleted, Situation will be saved to DataBase

  convertDialogToSituation(dialog) {
    const { userId, date, messages } = dialog;
    const situation = { userId, date };
    const downloads = []; // links to files we should download and save to server
    messages.forEach((msg, index) => {
      //console.log(msg.text, index);
      const field = this.scenario[index].field;
      situation[field] = {};

      if (msg.text) {
        situation[field].text = msg.text;
      } else if (msg.photo) {
        //id of photo
        situation[field].id = msg.photo[msg.photo.length - 1].file_id;
        console.log("msg.photo", msg.photo);
      } else if (msg.voice) {
        situation[field].id = msg.voice.file_id;
      }
    });
    console.log("situation: ", situation);
    return situation;
  }
}

module.exports = ActiveDialogs;
