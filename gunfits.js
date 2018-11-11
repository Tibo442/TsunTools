const fs = require('fs'),
    { Client } = require('pg'),
    read = require('readline-sync');

global.currentDir = __dirname;

if (!fs.existsSync(`${global.currentDir}/config/dblogin.json`)) {
    console.error(`Missing database login information, 'config/dblogin.json' doesn't exist!
Set contents to:
{
  "user": "xxx",
  "host": "xxx",
  "database": "xxx",
  "password": "xxx",
  "port": 1234
}`);
    return;
}

if (!fs.existsSync(`${global.currentDir}/config/gunfits.json`)) {
    console.error("Missing `config/gunfits.json`");
    return;
}

const dblogin = require(`${global.currentDir}/config/dblogin.json`);
const tests = require(`${global.currentDir}/config/gunfits.json`);

function checkTest() {
    if(testId == undefined)
        return false;
    try {
        if(parseInt(testId) < tests.length) {
            if(parseInt(testId) < 0) {
                process.exit(0)
                return false;
            }

            test = tests[parseInt(testId)];
            return true;
        }
    } catch (e) {}
    
    if(test = tests.find((t) => t.testName.toLowerCase() == testId.toLowerCase()))
        return true;
    return false;
}

function bounds(s, n) {
    let p = s/n;
    let k = error(p, n);
    return [p - k, p + k];
}
function error(p, n) {
    return Math.sqrt(p * (1 - p) / n);
}
function percentage(p, d = 3) {
    return `${(p * 100).toFixed(d)}%`
}
const getMoraleMod = morale => {
    const key = [19,33,49,100].findIndex(foo => morale <= foo);
    return [0.5,0.8,1,1.2][key];
}



if(process.argv.length <= 2) {
    console.log("Quick usage: node gunfits <test name OR id> <time: Day/Night> (morale: red/orange/green/sparkled)");
    console.log("Example: node gunfit 1 Day orange");
}

var testId = (process.argv.length > 2) ? process.argv[2] : undefined, test;

while(!checkTest())
    testId = read.keyInSelect(tests.map((t) => `${t.testName}${t.active?" \x1b[32m[ACTIVE]\x1b[0m":""}`), "Test ");

const time = (process.argv.length > 3) ? process.argv[2] : ["Day", "Night"][read.keyInSelect(["Day", "Night"], "Time: ")];
if(["Day", "Night"].indexOf(time) < 0) return;
const morale = (process.argv.length > 4) ? process.argv[3] : ["red", "orange", "green", "sparkled"][read.keyInSelect(["Red", "Orange", "Green", "Sparkled"], "Morale: ")];

const checkNum = {
    red: [0, 19],
    orange: [20, 32],
    green: [33, 49],
    sparkled: [50, 100]
}[morale];
const checkMorale = (morale, checkNum) => morale >= checkNum[0] && morale <= checkNum[1];

testId = tests.indexOf(test);
console.log(`Looking up information of test #${testId}: ${test.testName}...`);

const client = new Client(dblogin);
client.connect();

let startTime = new Date();
client.query(`SELECT * FROM gunfit WHERE testid = $1 ORDER BY id`, [testId], (err, data) => {
    let endTime = new Date();
    if(err) {
        console.log(err);
        client.end();
        return;
    }
    let cl = [0, 0, 0];
    
    let entries = data.rows;
    console.log(`${entries.length} entries loaded in ${endTime.getTime() - startTime.getTime()}ms`)
    
    // TODO calc equipAcc
    let equipAcc = 0;
    let avgBaseAcc = 0;
    for(let entry of entries) {
        const shipMorale = entry.ship.morale
        if ((morale && !checkMorale(shipMorale, checkNum)) || time != entry.time) { continue; }
        
        cl[entry.api_cl]++;
        enemy[entry.enemy] = (enemy[entry.enemy] || 0) + 1;
        const moraleMod = getMoraleMod(shipMorale);
        
        let lvl = entry.ship.lv, luck = entry.ship.luck;
        let baseAcc = Math.floor((90 + 1.5 * Math.sqrt(luck) + 2 * Math.sqrt(lvl) + equipAcc) * moraleMod);
        avgBaseAcc += baseAcc;
    }

    let samples = cl.reduce((a, b) => a + b), hit = cl[1] + cl[2];
    avgBaseAcc /= samples;

    const evas = {
        "1501": 15,
        "1502": 16,
        "1503": 17,
        "1505": 16,
        "1506": 16
    }
    let averageEvas = Object.keys(enemy).map((id) => { evas[id] * enemy[id] }) / samples;
    
    let predictedAcc = (avgBaseAcc - averageEvas + 1) / 100;

    console.log()
    console.log(`==== Accuracy summary of test ${test.testName}${!morale ? '' : ` in ${morale} morale`} ====`);
    console.log()
    console.log(`Base rate: ${avgBaseAcc}, avg. evas: ${averageEvas.toFixed(1)}, predicted rate: ${percentage(predictedAcc, 2)}`);
    console.log()
    console.log(`Found ${samples} samples, CL0/CL1/CL2: ${cl.join("/")}`);
    console.log(`Hit rate ${percentage(hit / samples)}, std. error ${percentage(error(hit/samples, samples))}`);
    console.log()
    console.log(`Bounds: ${bounds(hit, samples).map(percentage).join(" ~ ")}`);
    console.log(`Theoretical difference: ${percentage((hit / samples) - predictedAcc, 2)} (Error bounds: ${bounds(hit, samples).reverse().map((p) => percentage(p - predictedAcc, 1)).join(" ~ ")})`);
});
