const { Collection } = require("@open-wa/wa-automate/dist/structures/Collector");

const cron = require("node-cron");

const admin = require('firebase-admin');
module.exports = class suapNotification {
    constructor(client) {
        this.client = client;
    }

    async start() {

        cron.schedule("0 0 * * *", () => {
            this.startSemestreLoader();
        });

        this.turmas();

        this.boletim();
        
        const users = await this.client.database.getCollection("users").getAll();

        const tokens = Object.values(users).map(u => u.postToken);
        
        //admin.messaging().sendMulticast({
        //    notification: {
        //        title: `NOVA ATUALIZAÇÃO DISPONÍVEL`,
        //        body:  `Atualize já na PLAY STORE!`
        //    },
        //    tokens
        //})
    };

    async startSemestreLoader() {
        return new Promise(async superRes => {
            const users = await this.client.database.getCollection("users").getAll();

            for (const user of Object.values(users)) {
                await new Promise(async resolve => {
                    const login = await this.client.modules['suap'].login(user.user, user.password);

                    if (!login) {
                        return resolve(false);
                    };

                    user.token = login.access;

                    const periodos = await this.client.modules['suap'].obterPeriodosLetivos(user.token)

                    if (!periodos) {
                        user.save();
                        
                        console.log(`FAILED LOAD PERIODS FOR ` + user.user);
                        
                        resolve(true)
                    } else {
                        semestre: for (const periodo of periodos.reverse()) {
                            const check = await new Promise(async resolve2 => {
                                const boletim = await this.client.modules['suap'].getBoletim(user.token, periodo.ano_letivo, periodo.periodo_letivo);

                                if (boletim.length) {
                                    user.periodo = periodo;

                                    resolve2(true)
                                } else resolve2(false);
                            })

                            if (check) break semestre
                        }

                        user.save();

                        resolve(true);
                    }
                });
            };

            console.log("SEMESTRE LOADER FINISHED!");

            superRes(true);
        })
    }

    async turmas() {
        const turmasCache = new Collection();

        const func = async () => {
            const users = await this.client.database.getCollection("users").getAll()

            for (const user of Object.values(users)) {
                await new Promise(async resolve => {
                    let turmas = await this.client.modules['suap'].minhasTurmas(user.token, user.ano_letivo, user.periodo_letivo);

                    if (!turmas) {
                        const login = await this.client.modules['suap'].login(user.user, user.password);

                        if (!login) {
                            return resolve(false)
                        };

                        user.token = login.access;

                        user.save()

                        turmas = await this.client.modules['suap'].minhasTurmas(login.access, user.ano_letivo, user.periodo_letivo).catch(err => false);

                        if (!turmas || !turmas.length) {

                            return resolve(false);
                        };
                    };
                    turmas?.forEach(t => {
                        if (!turmasCache.get(t.id)) turmasCache.set(t.id, { ...t, usersIn: [user] })
                        else if (!turmasCache.get(t.id).usersIn.find(u => u.user === user.user)) turmasCache.get(t.id).usersIn.push(user);
                    });

                    resolve(true)
                });
            };

            for (const tu of turmasCache.map(t => t)) {

                await new Promise(async resolve => {
                    const turma = await this.client.modules['suap'].getTurma(tu.usersIn[0].token, tu.id);

                    if (!tu.materiais_de_aula?.length) {
                        tu.materiais_de_aula = [...turma.materiais_de_aula || [], 1];

                    }

                    const findMaterial = turma.materiais_de_aula?.filter(material => !tu.materiais_de_aula.find(m => m.url === material.url)) || [];

                    findMaterial.forEach(material => {
                        tu.usersIn.forEach(u => {
                            // this.client.API.postNotification({
                            //     user: u,
                            //     title: `⚠️ ALERTA DE MATERIAIS ⚠️`,
                            //     body: `Foi postado um novo material na disciplina ${turma.componente_curricular.trim().toUpperCase()}`,
                            // })
                        })
                    });

                    if (findMaterial.length) {
                        turmasCache.delete(tu.id);

                        console.log(turmasCache.get(tu.id));

                        turmasCache.set(turma.id, {
                            ...turma,
                            usersIn: tu.usersIn
                        });

                        resolve(true)
                    }
                })
            }
        }

        func();

        setInterval(() => {
            func();
        }, 60000);
    }

    async boletim() {

        const notasCache = new Map();

        const func = async () => {
            const users = await this.client.database.getCollection("users").getAll()

            for (const user of users) {

                await new Promise(async resolve => {
                    let notas = await this.client.modules['suap'].getBoletim(user.token, user.ano_letivo, user.periodo_letivo);

                    if (!notas) {
                        const login = await this.client.modules['suap'].login(user.user, user.password);

                        if (!login) {

                            return resolve(false)
                        };

                        user.token = login.access;

                        user.save();

                        notas = await this.client.modules['suap'].getBoletim(login.access, user.ano_letivo, user.periodo_letivo);

                        if (!notas) {

                            return resolve(false);
                        }
                    };

                    const last = notasCache.get(user.user);

                    if (last) {
                        last.forEach(nota => {

                            if (nota.nota_etapa_1.nota != notas.find(n => n.disciplina == nota.disciplina).nota_etapa_1.nota)
                                this.client.API.postNotification({
                                    user,
                                    title: `⚠️ ALERTA DE BOLETIM ⚠️`,
                                    body: `A nota da disciplina ${nota.disciplina} foi alterada de ${nota.nota_etapa_1.nota || 0} para ${notas.find(n => n.disciplina == nota.disciplina).nota_etapa_1.nota || 0}.`,
                                })

                            if (nota.nota_etapa_2.nota != notas.find(n => n.disciplina == nota.disciplina).nota_etapa_2.nota)
                                this.client.API.postNotification({
                                    user,
                                    title: `⚠️ ALERTA DE BOLETIM ⚠️`,
                                    body: `A nota da disciplina ${nota.disciplina} foi alterada de ${nota.nota_etapa_2.nota || 0} para ${notas.find(n => n.disciplina == nota.disciplina).nota_etapa_2.nota || 0}.`,
                                })

                            if (nota.nota_avaliacao_final?.nota != notas.find(n => n.disciplina == nota.disciplina).nota_avaliacao_final?.nota)
                                this.client.API.postNotification({
                                    user,
                                    title: `⚠️ ALERTA DE BOLETIM ⚠️`,
                                    body: `A nota da avaliação final da ${nota.disciplina} foi alterada de ${nota.nota_etapa_2.nota || 0} para ${notas.find(n => n.disciplina == nota.disciplina).nota_etapa_2.nota || 0}.`,
                                })

                            if (nota.numero_faltas < notas.find(n => n.disciplina == nota.disciplina).numero_faltas) {
                                this.client.API.postNotification({
                                    user,
                                    title: `⚠️ ALERTA DE FALTAS ⚠️`,
                                    body: `Foram adicionadas ${notas.find(n => n.disciplina == nota.disciplina).numero_faltas - nota.numero_faltas} faltas na disciplina ${nota.disciplina}.`,
                                })
                            }
                        });

                        notasCache.set(user.user, notas);

                    } else notasCache.set(user.user, notas);

                    resolve(true);
                })
            }
        };

        func();

        setInterval(() => {
            func();
        }, 60000);
    }
}