const fs = require('fs')
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

module.exports = {
    OWNER: process.env.OWNER_NUMBER || "94786802371",
    PREFIX: process.env.PREFIX || ".",
    USER_NAME: process.env.USER_NAME || "ENTER YOUR USERNAME",//Enter Your UserName (contact Nimesh Piyumal for get username and password +94786802371)
    PASSWORD: process.env.PASSWORD || "ENTER YOUR PASSWORD",//Enter Your Password
}