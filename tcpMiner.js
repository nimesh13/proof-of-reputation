const net = require('net');

const { FakeNet } = require('spartan-gold');
const ReputationBlockchain = require('./blockchain.js');
const ReputationBlock = require('./block.js');
const ReputationClient = require('./client.js');
const { readFileSync } = require('fs');

/**
 * This extends the FakeNet class to actually communicate over the network.
 */
class TcpNet extends FakeNet {

    constructor(...args) {
        super(...args);
        this.clientIdentities = new Map();
    }

    sendMessage(address, msg, o) {
        if (typeof o === 'string') o = JSON.parse(o);
        let data = { msg, o };
        const client = this.clients.get(address);
        let clientConnection = net.connect(client.connection, () => {
            clientConnection.write(JSON.stringify(data));
        });
        clientConnection.on('error', () => {
            console.log("Connection closed! Terminating miner....");
            return;
        });
    }
}

/**
 * Provides a command line interface for a SpartanGold miner
 * that will actually communicate over the network.
 */
class TcpMiner extends ReputationClient {
    static get REGISTER() { return "REGISTER"; }

    /**
     * In addition to the usual properties for a miner, the constructor
     * also takes a JSON object for the connection information and sets
     * up a listener to listen for incoming connections.
     */
    constructor({ name, startingBlock, keyPair, connection, identity } = {}) {
        super({ name, net: new TcpNet(), startingBlock, keyPair, identity });

        // Setting up the server to listen for connections
        this.connection = connection;
        this.identity = identity;
        this.srvr = net.createServer();
        this.srvr.on('connection', (client) => {
            this.log('Received connection');
            client.on('data', (data) => {
                let { msg, o } = JSON.parse(data);
                if (msg === TcpMiner.REGISTER) {
                    if (!this.net.recognizes(o)) {
                        this.registerWith(o.connection);
                    }
                    this.log(`Registering ${JSON.stringify(o)}`);
                    this.net.register(o);
                } else {
                    this.emit(msg, o);
                }
            });
        });
    }

    /**
     * Connects with the miner specified using the connection details provided.
     * 
     * @param {Object} minerConnection - The connection information for the other miner.
     */
    registerWith(minerConnection) {
        this.log(`Connection: ${JSON.stringify(minerConnection)}`);

        let conn = net.connect(minerConnection, () => {
            let data = {
                msg: TcpMiner.REGISTER,
                o: {
                    name: this.name,
                    address: this.address,
                    connection: this.connection,
                }
            };
            conn.write(JSON.stringify(data));
        });
    }

    /**
     * Begins mining and registers with any known miners.
     */
    initializeMiners(knownMinerConnections) {
        this.knownMiners = knownMinerConnections;
        super.initialize();
        for (let m of knownMinerConnections) {
            this.registerWith(m);
        }
    }

    register(...clientList) {
        for (const client of clientList) {
            this.net.clients.set(client.address, client);
            this.net.clientIdentities.set(client.identity, client.address);
        }
    }

}

let minnieConfig = JSON.parse(readFileSync('minnie.json'));
let mickieConfig = JSON.parse(readFileSync('mickie.json'));

if (process.argv.length !== 3) {
    console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <config.json>`);
    process.exit();
}

let config = JSON.parse(readFileSync(process.argv[2]));

let knownMiners = config.knownMiners || [];

let startingReputation = config.genesis ? config.genesis.startingReputation : {};

// Creating genesis block
let genesis = ReputationBlockchain.makeGenesis({
    blockClass: ReputationBlock,
    startingReputation: startingReputation
});

console.log(`Starting ${config.name}`);
let minnie = new TcpMiner({ name: config.name, keyPair: config.keyPair, connection: config.connection, startingBlock: genesis, identity: config.identity });

// Silencing the logging messages
minnie.log = function () { };
minnie.register(minnieConfig, mickieConfig);

minnie.srvr.listen(minnie.connection.port);

// Register with known miners and begin mining.
setTimeout(() => {
    console.log('\n----- Initial Balances -----');
    console.log(`\nInitial reputation scores (${minnie.name}'s perspective)`);
    showBalances(minnie);
    console.log();
    minnie.initializeMiners(knownMiners);
}, 8000);

// Print out the final balances after it has been running for some time.
setTimeout(() => {
    console.log('\n----- Final Balances -----');
    console.log(`\n${minnie.name}'s reputation score is ${minnie.reputationScore}.`);
    console.log(`\nFinal reputation scores (${minnie.name}'s perspective)\n`);
    showBalances(minnie);
    console.log();
    
    process.exit(0);
}, 60000);

function showBalances(client) {
    console.log();
    client.showAllBalances();
}