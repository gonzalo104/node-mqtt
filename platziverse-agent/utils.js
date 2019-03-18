'use strict'

function parsepayload (payload){
    if (payload instanceof Buffer) {
       payload = payload.toString('utf8')
    }
    try{
        payload = JSON.parse(payload)
    }catch(e){
        payload = null
    }
    return payload
}

module.exports = {
    parsepayload
}


/**
 * {
        "agent": {
            "uuid": "xxx",
            "name": "Joaquin Araujo",
            "username": "joaquinaraujojs",
            "pid": 123,
            "hostname": "platziMaracaibo"
        },
        "metrics": [{
            "type": "memory",
            "value": "1024"
        }, {
            "type": "temp",
            "value": "34"
        }]
    }
 */