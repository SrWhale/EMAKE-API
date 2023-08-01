const express = require('express');

const puppeteer = require('puppeteer');

const admin = require('firebase-admin');

const https = require('https');

const fs = require("fs");

const { load } = require("cheerio");

const cluster = require('cluster');
const { Collection } = require('@open-wa/wa-automate');

const numCPUs = require('os').cpus().length;

const makeFetchCookie = require("fetch-cookie");
const { default: axios } = require('axios');

const { XMLParser, XMLBuilder, XMLValidator } = require("fast-xml-parser");

admin.initializeApp({
    credential: admin.credential.cert(require("../../service.json")),
});

const app = express();

app.use(express.json());

function zipObject(keys, values) {
    return keys.reduce((acc, key, i) => {
        acc[key] = values[i]
        return acc
    }, {})
}

function chunk(array, n) {
    return array.reduce((acc, val, i) => {
        if (i % n === 0) {
            acc.push([val])
        } else {
            acc[acc.length - 1].push(val)
        }
        return acc
    }, [])
}

module.exports = class API {
    constructor(client) {
        this.client = client;

        this.name = 'api';

        this.launchers = new Collection();
    }

    get launch() {
        return this.launchers.sort((a, b) => a.requests - b.requests).first();
    }

    async start() {

        this.client.API = this;

        for (let i = 0; i < 4; i++) {
            this.launchers.set(i, {
                key: i,
                requests: 0,
                launch: await puppeteer.launch({
                    slowMo: 10,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                }).then(e => {

                    this.client.log(`Puppeteer ${i} iniciado com sucesso`, { tags: ['Puppeteer'], color: 'green' });
                    return e;
                })
            })
        };

        const server = https.createServer({
            key: fs.readFileSync(`/home/container/key.pem`),
            cert: fs.readFileSync(`/home/container/cert.pem`)
        }, app);
        
        server.listen(25566, () => {
            this.client.log(`API iniciada na porta 25566`, { tags: ['API'], color: 'cyan' });
        })

        app.get("/", (req, res) => {

            res.send({
                status: 200,
                cluster: this.client.cluster
            })
        })
        
        app.get("/version", (req, res) => {
            return res.send({
                version: 2
            })
        })

        app.get("/privacidade", async (req, res) => {
            return res.sendFile("politicas.html", {
                root: `/home/container`
            })
        })

        app.get("/calendario", async (req, res) => {
            const { user, password } = req.query;

            const launch = this.launch;

            this.launchers.get(launch.key).requests += 1;

            const initialPage = await launch.launch.newPage();

            await initialPage.goto('https://suap.ifbaiano.edu.br/accounts/login/');

            await initialPage.waitForSelector('#id_username');

            await initialPage.type('#id_username', user);

            await initialPage.type(".password-input", password);

            await initialPage.click("body > div.holder > main > div > div:nth-child(1) > form > div.submit-row > input");

            await initialPage.waitForSelector("body > div > a.toggleSidebar").catch(err => {
                res.json([]);
                
                res.end();
            })

            let $ = load(await initialPage.content());

            const link = $('a:contains(" Calendário Completo")').attr("href")

            if (!link) return res.json([]);

            await initialPage.goto(`https://suap.ifbaiano.edu.br${link}`);

            await initialPage.waitForSelector("#content > div.calendarios-container").catch(err => {
                res.json([]);
                
                res.end();
            })

            const response = [];

            $ = load(await initialPage.content());

            await Promise.all($("#content > div.calendarios-container").map((i, ul) => {
                return Promise.all($(ul).find("div.calendario").map(async (i, div) => {
                    return new Promise(async resolve => {
                        const p = await initialPage.$(`#content > div.calendarios-container > div:nth-child(${i + 1})`);

                        const shot = await p.screenshot({
                            type: "png",
                            encoding: "base64",
                        });

                        response.push({
                            buffer: shot,
                            indice: i
                        });

                        resolve(true)
                    })
                }))
            })).then(e => {

                initialPage.close();

                this.launchers.get(launch.key).requests--;

                return res.json(response)
            })
        })

        app.get("/updateConfig", async (req, res) => {
            let { user, password, data } = req.query;

            data = JSON.parse(data);

            user = user.toLowerCase();

            const Users = this.client.database.getCollection("users");

            const u = Users.get(us => us.user === user && us.password === password)

            if (!u) return res.send({
                status: false
            });

            if (data.notas) u.notas = !u.notas;

            if (data.faltas) u.faltas = !u.faltas;

            if (data.materiais) u.materiais = !u.materiais;

            u.save();

            res.send({
                status: true
            })
        })

        app.get("/config", async (req, res) => {
            let { user, password } = req.query;

            console.log(req.query)
            user = user.toLowerCase();

            const Users = this.client.database.getCollection("users");

            const u = Users.get(us => us.user === user && us.password === password)

            if (!u) return res.send({
                status: false
            });

            res.send({
                materiais: u.materiais,
                faltas: u.faltas,
                notas: u.notas
            })
        })

        app.get("/notificacoes", async (req, res) => {
            const { user, password } = req.query;

            const launch = this.launch;

            this.launchers.get(launch.key).requests++;

            const initialPage = await launch.launch.newPage();

            await initialPage.goto('https://suap.ifbaiano.edu.br/accounts/login/');

            await initialPage.waitForSelector('#id_username');

            await initialPage.type('#id_username', user);

            await initialPage.type(".password-input", password)

            await initialPage.click("body > div.holder > main > div > div:nth-child(1) > form > div.submit-row > input");

            await initialPage.waitForSelector("body > div > a.toggleSidebar");

            await initialPage.goto("https://suap.ifbaiano.edu.br/comum/notificacoes/");

            await initialPage.waitForSelector("#content > div.list-articles > ul", {
                timeout: 5000
            }).then(async () => {
                let $ = load(await initialPage.content());

                const response = [];

                $("#content > div.list-articles > ul").each((i, ul) => {
                    $(ul).find("li").each((i, li) => {
                        const selec = $(li).find("a");

                        const selectP = $(selec).find("p");

                        const selectH = $(selec).find("h4");

                        response.push({
                            titulo: $(selectH).text(),
                            fields: selectP.toArray().map((el) => $(el).text().replace(/\s+/g, " "))
                        })
                    })
                });

                initialPage.close();

                this.launchers.get(launch.key).requests--;

                return res.json(response.filter(r => r.titulo));
            }).catch(err => {
                initialPage.close();

                this.launchers.get(launch.key).requests--;

                return res.json([])
            })
        })

        app.get("/campus", async (req, res) => {
            const { campus } = req.query;
            console.log(campus)
            const format = {
                "TDF": "teixeira",
                "ITA": "itapetinga",
                "ITN": "itaberaba",
                "CAT": "catu",
                "BJL": "lapa",
                "SBF": "bonfim",
                "ALG": "alagoinhas",
                "URU": "urucuca",
                "SER": "serrinha",
                "GBI": "guanambi",
                "VAL": "valenca",
                "CSI": "santaines",
                "XIQ": "xique-xique"
            };

            const selected = format[campus];

            const data = await axios.get(`https://www.ifbaiano.edu.br/unidades/${selected}/feed`);
            if (!data.data) {
                console.log(`INVALIDO`, selected, format[campus])
                return res.json([])
            }

            let $ = new XMLParser().parse(data.data);

            return res.json($.rss.channel.item?.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()).map(e => {
                return {
                    nome: load(e.title)("body").text(),
                    link: load(e['content:encoded'] ? e['content:encoded'] : e.description)('img').attr("src"),
                    site: load(e.link)("body").text()
                }
            }).filter(e => e.link.length && e.site.length) || [])
        })
        app.get("/notas", async (req, res) => {
            const { user, password, ano, periodo, codigo } = req.query;

            const launch = this.launch;

            this.launchers.get(launch.key).requests++

            const initialPage = await launch.launch.newPage();

            await initialPage.goto('https://suap.ifbaiano.edu.br/accounts/login/');

            await initialPage.waitForSelector('#id_username');

            await initialPage.type('#id_username', user);

            await initialPage.type(".password-input", password)

            await initialPage.click("body > div.holder > main > div > div:nth-child(1) > form > div.submit-row > input");

            await initialPage.waitForSelector("body > div > a.toggleSidebar");

            await initialPage.goto(`https://suap.ifbaiano.edu.br/edu/aluno/${user.toUpperCase()}/?tab=boletim&ano_periodo=${ano}_${periodo}`, { waitUntil: 'networkidle2', timeout: 0 });

            let $ = load(await initialPage.content());

            const href = $(`tr:has(> td:contains("${codigo}")) > td > a`).attr(
                "href"
            );

            await initialPage.goto(`https://suap.ifbaiano.edu.br${href}`, { waitUntil: 'networkidle2', timeout: 0 });

            $ = load(await initialPage.content());

            const teachers = $("#content > div:nth-child(3) > div").text()

            const titles = $("#content > div:nth-child(4) > div > h4")
                .toArray()
                .map((el) => $(el).text().replace(/\s+/g, " "))

            const data = $("#content > div:nth-child(4) > div > table")
                .toArray()
                .map((el) => {
                    const $el = $(el)
                    const data = $el
                        .find("td")
                        .toArray()
                        .map((el) => $(el).text())
                    const result = []
                    chunk(data, 5).forEach((chunk) => {
                        result.push({
                            Sigla: chunk[0],
                            Tipo: chunk[1],
                            Descrição: chunk[2],
                            Peso: chunk[3],
                            "Nota Obtida": chunk[4]
                        })
                    })
                    return result
                })

            initialPage.close();

            this.launchers.get(launch.key).requests--;
            return res.send({
                Professores: teachers.trim(),
                "Detalhamento das Notas": zipObject(titles, data)
            })
        });

        app.get("/docs", async (req, res) => {

            const { user, password } = req.query;

            const launch = this.launch;

            try {
                this.launchers.get(launch.key).requests++;

                const initialPage = await launch.launch.newPage();

                await initialPage.goto('https://suap.ifbaiano.edu.br/accounts/login/');

                await initialPage.waitForSelector('#id_username');

                await initialPage.type('#id_username', user);

                await initialPage.type(".password-input", password)

                await initialPage.click("body > div.holder > main > div > div:nth-child(1) > form > div.submit-row > input");

                await initialPage.waitForSelector("body > div > a.toggleSidebar", {
                    timeout: 5000
                }).catch(err => {
                    initialPage.close();

                    this.launchers.get(launch.key).requests--;

                    res.send({
                        status: false,
                        data: []
                    });

                    res.end();
                })

                await initialPage.goto(`https://suap.ifbaiano.edu.br/edu/aluno/${user.toUpperCase()}`);

                const $ = load(await initialPage.content());

                const documents = $(
                    "#content > div.title-container > div.action-bar-container > ul > li:nth-child(2) > ul > li > a"
                ).toArray()
                    .map((el) => {

                        const $el = $(el)
                        return {
                            nome: $el.text(),
                            link: $el.attr("href")
                        }
                    });

                initialPage.close();

                this.launchers.get(launch.key).requests--;

                res.send({
                    status: true,
                    data: documents
                })
            } catch (err) {

                this.launchers.get(launch.key).requests--;

                res.send({
                    status: true,
                    data: []
                })
            }
        })

        app.post('/postToken', async (req, res) => {

            let { user, password, token } = req.body;

            user = user.toLowerCase();

            const Users = this.client.database.getCollection("users");

            let u = Users.get(us => us.user === user) || Users.create({
                user,
                password,
                postToken: token,
                notas: true,
                materiais: true,
                faltas: true
            });

            res.send({
                status: true
            });

            if (u.save) {
                u.password = password;
                u.postToken = token;

                u.save();
            } else {

                const login = await this.client.modules['suap'].login(u.user, u.password);

                u = Users.get(us => us.user === user);

                if (!login) return;

                u.token = login.access;

                const periodos = await this.client.modules['suap'].obterPeriodosLetivos(u.token);

                if (!periodos.length) return;

                semestre: for (const periodo of periodos.reverse()) {
                    const check = await new Promise(async resolve2 => {
                        const boletim = await this.client.modules['suap'].getBoletim(u.token, periodo.ano_letivo, periodo.periodo_letivo);

                        if (boletim.length) {

                            u.periodo = periodo;

                            resolve2(true)
                        } else resolve2(false);
                    })

                    if (check) break semestre
                };

                u.save();
            }
        })


    }

    async postNotification({ user, title, body }) {

        user.user = user.user.toLowerCase();

        const dbUSER = this.client.database.getCollection("users").get(u => u.user === user.user);

        if (!dbUSER.postToken) return;

        const message = {
            notification: {
                title,
                body,
            },
            token: dbUSER.postToken,
        };

        console.log(message)
        return admin.messaging().send(message)
            .then((response) => {
                console.log(`Mensagem enviada com sucesso para ${dbUSER.user}`)
            })
            .catch((error) => {
                console.log(`Não foi possível enviar mensagem para ${dbUSER.user}`)
            });
    }
}