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

    this.on(ReputationBlockchain.START_VOTING, this.voteWinner);
    this.on(ReputationBlockchain.VOTE_WINNER, this.receiveVote);

    setTimeout(() => this.emit(ReputationBlockchain.START_VOTING), 0);
  }

  startNewSearch() {
    this.currentBlock = ReputationBlockchain.makeBlock(this.address, this.lastBlock);
  }

  voteWinner() {
    this.numPlayers = this.lastConfirmedBlock.reputations.size;

    let number = rand.nextInt(this.numPlayers);

    this.announceProof({ id: this.address, vote: number });
  }

  /**
   * Broadcast the block, with a valid proof included.
   */
  announceProof(msg) {
    // console.log('Message: ', msg);
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