const axios = require('axios');

const puppeteer = require('puppeteer');

module.exports = class SUAPModule {
    constructor(client) {
        this.name = 'suap';

        this.client = client;

        this.defaultURL = 'https://suap.ifbaiano.edu.br/api/v2';
    }

    async start() {
    }

    async login(user, password) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            instance.post(
                '/autenticacao/token/?format=json',
                {
                    username: user.toLowerCase(),
                    password: password
                }).then(res => {
                    resolve(res.data);
                }, (err) => {
                    resolve(false);
                })
        })
    };

    async refreshToken(refresh) {

        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            instance.post(
                '/autenticacao/token/refresh/',
                {
                    refresh
                }).then(res => {
                    console.log(res.data.refresh)
                    resolve(res.data);
                }, (err) => {
                    console.log(err)
                    resolve(false);
                })
        })
    }

    async meusDados(token) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            instance.get("/minhas-informacoes/meus-dados/").then(e => {
                resolve(e.data)
            }, (err) => resolve(false))
        })
    }

    async getBoletim(token, ano = 2022, semestre = 1) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            instance.get(`/minhas-informacoes/boletim/${ano}/${semestre}/`).then(e => {

                resolve(e.data)
            }, (err) => resolve(false))
        })
    }

    async minhasTurmas(token, ano = 2022, semestre = 1) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            instance.get(`/minhas-informacoes/turmas-virtuais/${ano}/${semestre}/`).then(e => {
                resolve(e.data)
            }, (err) => resolve(false))
        })
    }

    async getTurma(token, id) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            instance.get(`/minhas-informacoes/turma-virtual/${id}`).then(e => {
                resolve(e.data)
            }, (err) => resolve(false))
        })
    }

    async obterPeriodosLetivos(token) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            instance.get(`minhas-informacoes/meus-periodos-letivos/`).then(e => {
                resolve(e.data)
            }, (err) => {
                resolve(false);

                console.log(err)
            })
        })
    }
}