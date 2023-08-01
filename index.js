require("dotenv/config");

const { Client } = require('./src/index.js');

const client = new Client();

client.login().then(() => {
    client.connectdatabase();

    client.loadModules();
});

process.on("uncaughtException", console.log)

process.on("unhandledRejection", console.log)