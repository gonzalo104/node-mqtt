'use strict'

const debug = require('debug')('platziverse:mqtt')
const mosca = require('mosca')
const redis = require('redis')
const chalk = require('chalk')
const db = require('platziverse-db')
const {parsepayload} = require('./utils')

const backend = {
    type: 'redis',
    redis,
    return_buffers: true
}

const settings = {
    port:1883,
    backend
}

const config = {
    database: process.env.DB_NAME || 'platziverse',
    username: process.env.DB_USER || 'platzi',
    password: process.env.DB_PASS || 'platzi',
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    logging: s => debug(s),    
  }

const server = new mosca.Server(settings)
const clients = new Map()

let Agent, Metric

server.on('clientConnected', client => {
    debug(`Cliente Connected: ${client.id}`)
    clients.set(client.id,null)
});

server.on('clientDisconnected', async(client) => {
    debug(`Cliente Disconnected: ${client.id}`)
    const agent = clients.get(client.id)
    if (agent) {
        //mark agent as Disconnected
        agent.connected = false
        try {
            await Agent.createOrUpdate(agent)
        } catch (e) {
            return handleError(e)    
        }
        // delete Agent from Clients List
        clients.delete(client.id)

        server.publish({
            topic: 'agent/disconnected',
            payload: JSON.stringify({
                uuid: agent.uuid
            })
        })    
        debug(`Client (${client.id}) assocaited to agent (${agent.uuid}) marked as disconnected`)    
    }
});

server.on('published', async (packet, client) => {
    debug(`Recived: ${packet.topic}`)
    switch (packet.topic) {
        case 'agent/connected':            
        case 'agent/disconnected':
            debug(`Payload: ${packet.payload}`)        
            break
        case 'agent/message':            
            const payload = parsepayload(packet.payload)
            if (payload) {
                payload.agent.connected = true
                let agent
                try {
                    agent = await Agent.createOrUpdate(payload.agent)
                } catch (error) {
                    return handleError(e)
                }
                debug(`Agent ${agent.uuid} saved`)

                //notify Agent is connected
                if (!clients.get(client.id)) {
                    clients.set(client.id, agent)
                    server.publish({
                        topic: 'agent/connected',
                        payload: JSON.stringify({
                            uuid: agent.uuid,
                            name: agent.name,
                            hostname: agent.hostname,
                            pid: agent.pid,
                            connected: agent.connected
                        })
                    })
                }

                // Store Metrics
                for (let metric of payload.metrics) {
                   let m
                   
                   try {
                       m = await Metric.create(agent.uuid,metric)
                   } catch (e) {
                        return handleError(e)
                   }

                   debug(`Metric ${m.id} saved on agent ${agent.uuid}`)
                }

            }
            break
    }    

});

server.on('ready', async () =>{
    const services = await db(config).catch(handleFatalError)
    Agent = services.Agent
    Metric = services.Metric
    console.log(`${chalk.green('[platziverse-mqtt]')} server is running`)
})

server.on('error', handleFatalError)

function handleFatalError(err){
    console.log(`${chalk.red('[falta error]')} ${err.message}`)
    console.log(err.stack)
    process.exit(1);
}

function handleError(err){
    console.log(`${chalk.red('[error]')} ${err.message}`)
    console.log(err.stack)
}

process.on('uncaughtException', handleFatalError)
process.on('unhandledRejection', handleFatalError)