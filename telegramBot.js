const TelegramBot = require("node-telegram-bot-api");
const config = require("./config");
const ActiveDialogs = require("./activeDialogs");
const { Client } = require("pg");

const TOKEN = config.token;
var bot = new TelegramBot(TOKEN, { polling: true });

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
      const situation = dialogs.convertDialogToSituation(dialog);
      saveToDB(situation);
    }
  }
});

bot.on("polling_error", error => {
  console.log("polling_error", error); // => 'EFATAL'
});

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

module.exports = bot;
