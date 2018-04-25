const TelegramBot = require("node-telegram-bot-api");
const Agent = require("socks5-https-client/lib/Agent");
const config = require("./config");
const ActiveDialogs = require("./activeDialogs");
const { Client } = require("pg");
const fs = require("fs");
var request = require("request");
const auth1C =
  "Basic " +
  new Buffer(config.api1C_login + ":" + config.api1C_password).toString(
    "base64"
  );

var bot = new TelegramBot(config.token, {
  polling: true,
  request: {
    agentClass: Agent,
    agentOptions: {
      socksHost: "tp.grishka.me",
      socksPort: "1080",
      // If authorization is needed:
      socksUsername: "tgproxy",
      socksPassword: "fuckrkn"
    }
  }
});
//https://195.201.137.246:1080
//dialogs : [ {userId, date, state, messages} ] stores state of active dialogs with users
let dialogs = new ActiveDialogs();

bot.onText(/\/start/, (msg, [source, match]) => {
  const {
    chat: { id, first_name, last_name },
    text
  } = msg;
  const welcomeMessage = `Здравствуйте, ${first_name}! В этом боте вы можете сообщить о проблеме.`;
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
  const situation = { userId, date, files: [] };
  const downloads = []; // promises to files we should download and save to server
  console.log("sit before", situation);
  messages.forEach((msg, index) => {
    //console.log(msg.text, index);
    const field = dialogs.scenario[index].field;

    //если сообщение текстовое - один алгоритм
    if (msg.text) {
      situation[field] = msg.text;
      //если сообщение файловое - другой алгоритм
    } else {
      let fileId = "";
      if (msg.photo) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
      }
      if (msg.voice) {
        fileId = msg.voice.file_id;
      }
      let filePromise = downloadAndRenameFile(fileId);
      filePromise.then(fileName => {
        let data = fs.readFileSync(`files/${fileName}`, { encoding: "base64" });
        situation.files.push({ name: fileName, data });
      });
      downloads.push(filePromise);
    }
  });

  // console.log("downloads: ", downloads);
  Promise.all(downloads).then(results => {
    console.log("promiseAll", results);
    console.log("situation", situation);
    fs.writeFileSync("tmp/situation.txt", JSON.stringify(situation));
    //saveToDB(situation);
    //write data to 1C
    console.log("config.api1C_host", config.api1C_host);
    request(
      {
        method: "POST",
        url: config.api1C_host,
        headers: {
          Authorization: auth1C
        },
        body: JSON.stringify(situation)
      },
      function(error, response, body) {
        console.log("response from 1C", error, response, body);
        const nikolayId = "121042827";
        const rustamId = "131455605";
        bot.sendMessage(
          nikolayId,
          "responce from 1C:\n" + JSON.stringify(response, null, 2)
        );
      }
    );
    dialogs.deleteDialog(situation.userId);
  });
  return situation;
}

function saveToDB(situation) {
  const client = new Client({
    connectionString: config.postgresUrl
  });
  client.connect();

  client.query(
    "INSERT INTO situations(user_id, fio, phone, text, voice, photo, timestamp) VALUES($1, $2, $3, $4, $5, $6, $7)",
    [
      situation.userId,
      situation.name.text,
      situation.phone.text,
      situation.description.text,
      situation.description.filePath,
      situation.photo.filePath,
      situation.date
    ],
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
  let promiseFileDownload = bot.downloadFile(fileId, "files");
  //promise
  let promiseFileRename = filePath => {
    return new Promise((resolve, reject) => {
      let fileExtention = filePath.split(".")[1] || "ogg";
      let newFilePath = `${fileId}.${fileExtention}`;
      fs.rename(filePath, `files/${newFilePath}`, err => {
        if (err) reject(err);
        resolve(newFilePath);
      });
    });
  };
  // promise
  return promiseFileDownload.then(promiseFileRename);
}

/* 
const sitExample = {
  userId: "123456",
  name: "Рустам",
  tel: "79111124522",
  text: "Текст Заявки",
  files: [
    {
      name: "ИмяФайла1.pdf",
      data: "/9j/4AAQSkZJRgABAQEBLAEsAAD/2wB"
    }
  ]
};
 */
