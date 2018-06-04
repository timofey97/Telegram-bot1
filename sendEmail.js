const exec = require('child_process').exec;
const config = require('./config');

function sendMail(bodyEmail, address, subject) {
    return new Promise((resolve, reject) => {
        exec(`sh mail.sh ${config.sendEmailTo} ${config.email_login} ${config.email_password} ${address} '${subject}' '${bodyEmail}'`, (error, stdout, stderr) => {
            if (error || stderr) {
                reject(`exec error: ${error || 'no'}\nStderr: ${stderr || 'no'}`);
            } else {
                console.log(`Email sent: ${stdout}`);
                resolve(true)
            }
        });
    })
}

module.exports = sendMail;