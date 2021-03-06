"use strict";

let { Blockchain } = require('spartan-gold');

const VOTE_WINNER = 'VOTE_WINNER';
const COMMIT_VOTE = 'COMMIT_VOTE';
const START_VOTING = 'START_VOTING';
const FOUND_PROOF = 'FOUND_PROOF';
const VOTE_BLOCK = 'VOTE_BLOCK';

module.exports = class ReputationBlockchain extends Blockchain {

    static get VOTE_WINNER() { return VOTE_WINNER; }
    static get COMMIT_VOTE() { return COMMIT_VOTE; }
    static get START_VOTING() { return START_VOTING; }
    static get FOUND_PROOF() { return FOUND_PROOF; }
    static get VOTE_BLOCK() { return VOTE_BLOCK; }

    static makeGenesis({
        blockClass,
        startingReputation,
        clientReputationMap
    }) {

        // Setting blockchain configuration
        Blockchain.cfg = { blockClass };

        // If startingReputation was specified, we initialize our balances to that object.
        let reputations = startingReputation || {};

        // If clientReputationMap was initialized instead, we copy over those values.
        if (clientReputationMap !== undefined) {
            for (let [client, reputation] of clientReputationMap.entries()) {
                reputations[client.address] = reputation;
            }
        }

        let g = this.makeBlock();

        // Initializing starting reputations in the genesis block.
        Object.keys(reputations).forEach((addr) => {
            g.reputations.set(addr, reputations[addr]);
        });

        // If clientReputationMap was specified, we set the genesis block for every client.
        if (clientReputationMap) {
            for (let client of clientReputationMap.keys()) {
                client.setGenesisBlock(g);
            }
        }

        return g;
    }

    static makeBlock(...args) {
        return new ReputationBlockchain.cfg.blockClass(...args);
    }

}