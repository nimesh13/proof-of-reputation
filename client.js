"use strict";

let { Client } = require('spartan-gold');

let ReputationBlockchain = require('./blockchain.js');

let rand = require('./rand');

let identityCount = 0;

module.exports = class ReputationClient extends Client {

  constructor(...args) {
    super(...args);

    this.identity = identityCount;
    identityCount += 1;

    // Setting up listeners to receive messages from other clients.
    this.on(ReputationBlockchain.VOTE_WINNER, this.receiveVote);
    // this.on(Blockchain.MISSING_BLOCK, this.provideMissingBlock);

  }

  get reputationScore() {
    return this.lastConfirmedBlock.balanceOf(this.address);
  }

  showAllBalances() {
    this.log("Showing reputation scores:");
    for (let [id, reputation] of this.lastConfirmedBlock.reputations) {
      console.log(`    ${id}: ${reputation}`);
    }
  }

  initialize() {

    this.startNewSearch();

    // this.on(ReputationBlockchain.START_MINING, this.findProof);
    // // this.on(ReputationBlockchain.POST_TRANSACTION, this.addTransaction);

    // setTimeout(() => this.emit(ReputationBlockchain.START_MINING), 0);
  }

  startNewSearch() {
    this.currentBlock = ReputationBlockchain.makeBlock(this.address, this.lastBlock);

    this.numPlayers = this.lastConfirmedBlock.reputations.size;

    let number = rand.nextInt(this.numPlayers);

    this.announceProof({ id: this.address, vote: number });
  }

  findProof(oneAndDone = false) {

    let pausePoint = this.currentBlock.proof + this.miningRounds;

    while (this.currentBlock.proof < pausePoint) {
      if (this.currentBlock.hasValidProof()) {
        this.log(`found proof for block ${this.currentBlock.chainLength}: ${this.currentBlock.proof}`);
        this.announceProof();
        // Note: calling receiveBlock triggers a new search.
        this.receiveBlock(this.currentBlock);
        break;
      }
      this.currentBlock.proof++;
    }
    // If we are testing, don't continue the search.
    if (!oneAndDone) {
      // Check if anyone has found a block, and then return to mining.
      setTimeout(() => this.emit(ReputationBlockchain.START_MINING), 0);
    }
  }

  /**
   * Broadcast the block, with a valid proof included.
   */
  announceProof(msg) {
    this.net.broadcast(ReputationBlockchain.VOTE_WINNER, msg);
  }

  receiveVote(msg) {
    this.currentBlock.voteWinnerMap.set(msg.id, msg.vote);

    if (this.currentBlock.voteWinnerMap.size == this.numPlayers) {
      this.determineWinner()
    }
  }

  determineWinner() {
    let sum = 0;
    let voteMap = this.currentBlock.voteWinnerMap;
    voteMap.forEach((share) => {
      sum += share;
    });
    let winnerID = sum % this.numPlayers;
    this.currentBlock.winner = this.getWinnerName(winnerID);
    
    console.log(`${this.name} announces ${this.currentBlock.winner} as the winner`);
  }

  getWinnerName(winnerID) {
    let winnerAddress = this.net.clientIdentities.get(winnerID);

    for (let [_, client] of this.net.clients) {
      if (winnerAddress === client.address) return client.name;
    }
  }
}