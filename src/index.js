import { Router as expressRouter } from 'express';
import { performance } from 'perf_hooks';
import redis from 'redis';

import https from 'https';

const client = redis.createClient();
const router = expressRouter();

exports = module.exports = router;

router.get('/', handleQuery);

async function handleQuery(req, res, next) {

    let result
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).send({ msg: 'query is mandatory' });
    }
    try {
        performance.mark('start');
        
        // get reddit search
        const cache_q = await getCache(q);

        if (!cache_q) {
            console.log('cache: miss');
            result = await searchReddit(q);
            setCache(q, JSON.stringify(result));
        } else {
            console.log('cache: hit');            
            result = JSON.parse(cache_q);
        }

        // Measure perfornace
        performance.mark('end');
        performance.measure('searchReddit', 'start', 'end');
        const measure = performance.getEntriesByName('searchReddit')[0];    
        performance.clearMeasures(); 
        // Send response
        return res.status(200).send({ time: measure.duration, result });
    } catch (e) {
        next(e);
    }
}

function getCache(key) {
    return new Promise((resolve, reject) => {
        client.get(key, (err, val) => {
            return err ? reejct(err) : resolve(val);
        });
    })
}


function setCache(key, val) {
    return new Promise((resolve, reject) => {
        client.set(key, val, (err, val) => {
            return err ? reejct(err) : resolve(val);
        });
    })
}

function searchReddit(q) {
    return new Promise((resolve, reject) => {

        const url = `https://www.reddit.com/search.json?q=${q}&sort=new?callback=?`;

        https.get(url, (res) => {

            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });
 
            res.on('end', () => {
                resolve(JSON.parse(data));
            });

        }).on('error', (e) => {
            reject(e);
        });
    })
}

exports.searchReddit = searchReddit;

client.on('error', (err) => {
    console.log('Error ' + err);
});

client.on('data', () => {
    console.log('redis connected..');    
})
