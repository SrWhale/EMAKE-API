const { readdirSync } = require('fs');

const Simpl = require('simpl.db');

const chalk = require('chalk')
const _ = require('lodash')

module.exports = class Client {

    constructor() {
        this.eventsToListen = ['onAnyMessage'];

        this.commands = new Map();

        this.events = new Map();

        this.messageCollectors = new Map();

        this.modules = {};
    }

    log(
        message,
        {
            tags = [],
            bold = false,
            italic = false,
            underline = false,
            reversed = false,
            bgColor = false,
            color = 'white'
        } = {}
    ) {
        const colorFunction = _.get(
            chalk,
            [bold, italic, underline, reversed, bgColor, color].filter(Boolean).join('.')
        )

        console.log(...tags.map(t => chalk.cyan(`[${t}]`)), colorFunction(message))
    }

    async login() {
        return this;
    };

    async loadModules() {
        const modules = readdirSync('src/modules/');

        for (const file of modules) {
            const module = require(`../modules/${file}`);

            this.log(`[MODULES] - Módulo ${file} carregado`, { color: 'yellow' });

            const m = new module(this);

            await m.start();

            this.modules[m.name] = m;
        }
    }

    async connectdatabase() {
        this.database = new Simpl();

        if (!this.database.getCollection('users')) this.database.createCollection('users');

        const firebase = require('firebase');

        firebase.initializeApp({
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID,
            measurementId: process.env.FIREBASE_MESASURE_ID
        });

        this.firebase = firebase.database();

        return this.log(`[Database] - Banco de dados iniciado com sucesso.`, { tags: ['Banco de dados'], color: 'green' })
    };
}