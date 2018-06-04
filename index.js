const Telegram = require('node-telegram-bot-api');
const sendEmail = require('./sendEmail');
const TOKEN = require('./config').token;

const bot = new Telegram(TOKEN, {polling: true});
const isEmail = (email) => /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
let tickets = {};

function actionToText(text) {
    switch (text) {
        case 'Support': return 'Техническая поддержка';
        case 'developers': return 'Разработчики';
	case 'lowPriority': return 'Низкий';
        case 'middlePriority': return 'Нормальный';
        case 'topPriority': return 'Срочный';
        default: return 'what?'
    }
}

bot.on('callback_query', query => {
    let action = query.data;
    let userFrom = query.message.chat.id;
    let msgId = query.message.message_id;

    if(action === 'newTicker') {
        tickets[userFrom] = {};

        let opts = {
            chat_id: userFrom,
            message_id: msgId,
            reply_markup: {
                inline_keyboard: [[{
                    text: 'Техническая поддержка',
                    callback_data: 'Support'
                }],[{
                    text: 'Разработчики',
                    callback_data: 'developers'
                }]]
            }
        };
        bot.editMessageText('Выберите тип заявки', opts)
    } else if(action === 'Support' || action === 'developers') {
        tickets[userFrom].whom = actionToText(action);

        let opts = {
            chat_id: userFrom,
            message_id: msgId,
            reply_markup: {
                inline_keyboard: [[{
		            text: 'Низкий',
                    callback_data: 'lowPriority'
                }],[{
                    text: 'Нормальный',
                    callback_data: 'middlePriority'
                }],[{
                    text: 'Срочный',
                    callback_data: 'topPriority'
                }]]
            }
        };
        bot.editMessageText('Выберите приоритет заявки', opts)
    } else if(action === 'lowPriority' || action === 'middlePriority' || action === 'topPriority') {
        tickets[userFrom].priority = actionToText(action);
        let opts = {
            chat_id: userFrom,
            message_id: msgId,
        };
        bot.editMessageText('Опишите тему обращения в двух словах:', opts)
    } else if(action === 'yes' || action === 'no') {

        let opts = {
            chat_id: userFrom,
            message_id: msgId,
            reply_markup: {
                inline_keyboard: [[{
                    text: 'Обратиться снова',
                    callback_data: 'newTicker'
                }]]
            }
        };

        if(action === 'yes') {
            let username = query.from.username;
            if(!username) { // if undefined
                username = query.from.first_name || query.from.last_name;
            } else {
                username = '@' + username  // place @ before username
            }

            let text = `<html><b>От кого:</b> ${username} [${query.from.id}]<br>`;
            text += `<b>Кому:</b> ${tickets[userFrom].whom}<br>`;
            text += `<b>Приоритет:</b> ${tickets[userFrom].priority}<br><br>`;
            text += `——————————<br><br></html>`;
            text += `${tickets[userFrom].issue}`;

            sendEmail(text, tickets[userFrom].email, tickets[userFrom].subject)
                .then(() => {
                    delete tickets[userFrom];
                    bot.editMessageText('Заявка отправлена', opts)
                })
                .catch(err => {
                    delete tickets[userFrom];
                    console.log(err);
                    bot.editMessageText('Заявка не была отправлена по техническим причинам. Повторите позже.', opts)
                })

        } else {
            bot.editMessageText('Заявка не была отправлена', opts)
        }
    }
});

bot.on('message', msg => {
    let userFrom = msg.chat.id;
    if(msg.text === '\/start') {
        if(tickets[userFrom]) delete tickets[userFrom];
        let opts = {
            reply_markup: {
                inline_keyboard: [[{
                    text: 'Новая заявка',
                    callback_data: 'newTicker'
                }]]
            }
        };
        bot.sendMessage(userFrom, 'Меню', opts)
    } else {
        if(!tickets[userFrom].subject) {
            if(msg.text.length > 40) {
                bot.sendMessage(userFrom, `Слишком длинная тема обращения. Покороче, пожалуйста. Повторите попытку:`)
            } else {
                tickets[userFrom].subject = msg.text;
                bot.sendMessage(userFrom, `Теперь подробно опишите вашу проблему`)
            }
        } else if(!tickets[userFrom].issue) {
            tickets[userFrom].issue = msg.text;
            bot.sendMessage(userFrom, `Теперь введите свой email`)
        } else if(!tickets[userFrom].email) {
            if(isEmail(msg.text) === false) {
                bot.sendMessage(userFrom, `Введен некорректный email. Повторите.`)
            } else {
                tickets[userFrom].email = msg.text;
                let text = 'Подтвердите:\n\n';
                text += `Кому: ${tickets[userFrom].whom}\n`;
                text += `Приоритет: ${tickets[userFrom].priority}\n`;
                text += `Тема: ${tickets[userFrom].subject}\n`;
                text += `Проблема: ${tickets[userFrom].issue}\n`;
                text += `Email: ${tickets[userFrom].email}`;

                let opts = {
                    reply_markup: {
                        inline_keyboard: [[{
                            text: 'Да',
                            callback_data: 'yes'
                        },{
                            text: 'Нет',
                            callback_data: 'no'
                        }]]
                    }
                };
                bot.sendMessage(userFrom, text, opts)
            }
        } else {
            bot.sendMessage(userFrom, 'Надо нажать на кнопку.')
        }
    }
});

bot.on('polling_error', err => {
    console.log(`[tgError] ${new Date().toString().slice(16, -9)}: ${err.message}`)
});
