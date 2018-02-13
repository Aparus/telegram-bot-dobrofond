const TelegramBot = require("node-telegram-bot-api");
const config = require("./config");
const ActiveDialogs = require("./activeDialogs");
const { Client } = require("pg");
const fs = require("fs");

var bot = new TelegramBot(config.token, { polling: true });

//dialogs : [ {userId, date, state, messages} ] stores state of active dialogs with users
let dialogs = new ActiveDialogs();

bot.onText(/\/start/, (msg, [source, match]) => {
  const { chat: { id, first_name, last_name }, text } = msg;
  const welcomeMessage = `Здравствуйте, ${first_name}! В этом боте вы можете сообщить о проблеме, с которой вы столкнулись в нашем городе.`;
  const inline_keyboard = [
    [
      {
        text: "Открыть заявку",
        callback_data: "Открыть заявку"
      }
    ]
  ];
  const opts = {
    reply_markup: {
      inline_keyboard
    }
  };
  bot.sendMessage(id, welcomeMessage, opts);
});

// старт заявки - ответ на нажатие инлайн кнопки
bot.on("callback_query", query => {
  // console.log("query", query);
  if (query.data == "Открыть заявку") {
    const userId = query.from.id;
    const id = query.id;
    const date = query.message.date;
    bot.sendMessage(userId, dialogs.scenario[0].question);
    dialogs.createDialog(userId, date);
  }
});

// when user sended message
bot.on("message", msg => {
  const userId = msg.from.id;
  const dialog = dialogs.getDialog(userId);
  if (dialog) {
    dialog.messages.push(msg);
    dialog.state++;
    dialogs.updateDialog(dialog);

    if (dialog.state < dialogs.scenario.length) {
      bot.sendMessage(userId, dialogs.scenario[dialog.state].question);
    }
    if (dialog.state == dialogs.scenario.length) {
      //мы достигли конца сценария, получили все данные, сохраняем их в базу данных и удаляем активный диалог
      const situation = convertDialogToSituation(dialog);
    }
  }
});

bot.on("polling_error", error => {
  console.log("polling_error", error); // => 'EFATAL'
});

// Dialog contains separated messages, we should extract valuable for us data to one "situation" object
// Situation is a row of DB, where we structure and save data from dialog.
// Dialog will be deleted, Situation will be saved to DataBase

function convertDialogToSituation(dialog) {
  const { userId, date, messages } = dialog;
  const situation = { userId, date };
  const downloads = []; // promises to files we should download and save to server
  messages.forEach((msg, index) => {
    //console.log(msg.text, index);
    const field = dialogs.scenario[index].field;
    situation[field] = {};

    if (msg.text) {
      situation[field].text = msg.text;
    } else {
      if (msg.photo) {
        situation[field].id = msg.photo[msg.photo.length - 1].file_id;
      }
      if (msg.voice) {
        situation[field].id = msg.voice.file_id;
      }
      let filePromise = downloadAndRenameFile(situation[field].id);
      filePromise.then(filePath => {
        situation[field].filePath = filePath;
      });
      downloads.push(filePromise);
    }
  });
  console.log("downloads: ", downloads);
  Promise.all(downloads).then(results => {
    console.log("promiseAll", results);
    saveToDB(situation);
  });
  return situation;
}

function saveToDB(situation) {
  const client = new Client({
    connectionString: config.postgresUrl
  });
  client.connect();

  client.query(
    "INSERT INTO situations(fio, phone, text_description, timestamp) VALUES($1, $2, $3, $4)",
    [situation.name, situation.phone, situation.description, situation.date],
    (err, result) => {
      if (err) {
        return console.error("Ошибка при записи в PostgresQL", err);
      }
      dialogs.deleteDialog(situation.userId);
      console.log("В БД была добавлена запись Ситуации");
      bot.sendMessage(situation.userId, "Ваша заявка сохранена");
      //res.render("situations", { situations: result.rows });
      client.end();
    }
  );
}

//downloads and renames file and returns promise
function downloadAndRenameFile(fileId) {
  let promiseFileDownload = bot.downloadFile(fileId, "files"); //promise
  let promiseFileRename = filePath => {
    return new Promise((resolve, reject) => {
      let fileExtention = filePath.split(".")[1] || "ogg";
      let newFilePath = `files/${fileId}.${fileExtention}`;
      fs.rename(filePath, newFilePath, err => {
        if (err) reject(err);
        resolve(newFilePath);
      });
    });
  }; // promise
  return promiseFileDownload.then(promiseFileRename);
}
