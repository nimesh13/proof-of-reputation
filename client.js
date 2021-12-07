"use strict";

let { Client } = require('spartan-gold');

let ReputationBlockchain = require('./blockchain.js');
let crypto = require('crypto');
let rand = require('./rand');

const HASH_ALG = "SHA256";
let identityCount = 0;

module.exports = class ReputationClient extends Client {

  constructor(...args) {
    super(...args);

    this.identity = identityCount;
    identityCount += 1;
    this.numPlayers = 0;

    this.on(ReputationBlockchain.START_VOTING, this.commitVote);
    this.on(ReputationBlockchain.COMMIT_VOTE, this.handleCommit);
    this.on(ReputationBlockchain.VOTE_WINNER, this.receiveVote);
    this.on(ReputationBlockchain.FOUND_PROOF, this.receiveProof);
    this.on(ReputationBlockchain.VOTE_BLOCK, this.receiveVoteBlock);
  }

  get reputationScore() {
    return this.lastConfirmedBlock.reputationOf(this.address);
  }

  showAllBalances() {
    this.log("Showing reputation scores:");
    for (let [id, reputation] of this.lastConfirmedBlock.reputations) {
      console.log(`    ${id}: ${reputation}`);
    }
  }

  initialize() {

    this.startNewSearch();

    setTimeout(() => this.emit(ReputationBlockchain.START_VOTING), 5000);
  }

  startNewSearch() {

    this.currentBlock = ReputationBlockchain.makeBlock(this.address, this.lastConfirmedBlock);
    console.log(`\n--- ${this.name}'s round ${this.currentBlock.chainLength} ---\n`, );
    this.numPlayers = 0;
  }

  async commitVote() { 
    let number = crypto.randomBytes(4).readUInt32BE(0, true);

    this.chosenNumber = number;
    let nonce = crypto.randomBytes(4).toString('hex');

    let hashed = crypto.createHash(HASH_ALG).update(number.toString() + nonce.toString()).digest('hex');
    this.nonce = nonce;

    this.net.broadcast(ReputationBlockchain.COMMIT_VOTE, { id: this.address, hashedVote: hashed });
    await new Promise(resolve => setTimeout(resolve, 3000));
    this.announceVote();
  }
  handleCommit(o) {
    this.numPlayers++;
    this.currentBlock.committedVotes[o.id] = o.hashedVote;
  }
  /**
   * Broadcast the block, with a valid proof included.
   */
  announceVote() {
    this.net.broadcast(ReputationBlockchain.VOTE_WINNER, { id: this.address, vote: this.chosenNumber, nonce: this.nonce });
  }

  receiveVote(o) {
    // console.log(o);
    this.currentBlock.announcedVotes[o.id] = [o.vote, o.nonce];
    if (Object.keys(this.currentBlock.announcedVotes).length === this.numPlayers) {
      this.determineWinner();
      if (this.currentBlock.winner === this.address) {
        this.announceProof();
      }
    }
  }

  announceProof() {
    let msg = { proof: rand.nextInt(200) };
    this.net.broadcast(ReputationBlockchain.FOUND_PROOF, msg);
  }

  determineWinner() {

    let sum = 0;

    // check for cheaters
    for (let id in this.currentBlock.announcedVotes) {
      let committed = this.currentBlock.committedVotes[id];

      let num = this.currentBlock.announcedVotes[id][0];
      let nonce = this.currentBlock.announcedVotes[id][1];
      let hashed = crypto.createHash(HASH_ALG).update(num.toString() + nonce.toString()).digest('hex');

      if (hashed !== committed) {
        console.log(`${id} is invalid`);
        // don't add to sum

        let repValue = this.currentBlock.reputationOf(id);
        repValue -= 10;
        this.currentBlock.reputations.set(id, repValue);
      }
      else {
        // valid vote, so add to sum
        sum += num;
      }
    }

    let winnerID = sum % this.numPlayers;
    this.currentBlock.winner = this.getClientName(winnerID);

    console.log(`${this.name} announces ${this.currentBlock.winner} as the winner`);
  }

  getClientName(index) {
    let winnerAddress = this.net.clientIdentities.get(index);

    for (let [_, client] of this.net.clients) {
      if (winnerAddress === client.address) return client.address;
    }
  }

  receiveProof(msg) {
    this.currentBlock.proof = msg.proof;
    this.voteBlock();
  }

  voteBlock() {
    if (this.currentBlock.winner !== this.address) {
      let msg = { id: this.address, vote: this.calculateVote() };
      this.net.broadcast(ReputationBlockchain.VOTE_BLOCK, msg);
    }
  }

  calculateVote() {

    //add reputation class and getter to fetch the votes

    let num = rand.nextInt(4);

    //25% success, 75% fail
    if (this.reputationScore < 80){
      if (num < 3) return 'INVALID';
      else return 'VALID';
    }
    //75% success, 25% fail
    else if (this.reputationScore > 120){
      if (num < 3) return 'VALID';
      else return 'INVALID';
    }
    //50% chance each
    else {
      if (num < 2) return 'VALID';
      else return 'INVALID';
    }

  }

  receiveVoteBlock(msg) {

    this.currentBlock.votesMap.set(msg.id, msg.vote);

    if (this.currentBlock.votesMap.size === (this.numPlayers - 1)) {
      this.currentBlock.decision = this.determineBlockStatus();

      this.updateReputation();

      this.updateBlocks();

      this.initialize();

    }
  }

  determineBlockStatus() {
    let status = {
      'VALID': 0,
      'INVALID': 0
    };

    for (let [client, vote] of this.currentBlock.votesMap) {
      let repValue = this.currentBlock.reputations.get(client);
      if (vote == 'VALID') status['VALID'] += repValue;
      else status['INVALID'] += repValue;
    }

    if (status['VALID'] > status['INVALID']) return 'VALID';
    return 'INVALID';
  }

  updateReputation() {
    let decision = this.currentBlock.decision;
    let winner = this.currentBlock.winner;
    let voteMap = this.currentBlock.votesMap;

    for (let [client, vote] of voteMap) {
      let repValue = this.currentBlock.reputationOf(client);
      if (vote === decision) repValue += 10;
      else repValue -= 10;
      this.currentBlock.reputations.set(client, repValue);
    }

    let winnerRepValue = this.currentBlock.reputations.get(winner);
    if (decision === 'VALID') winnerRepValue += 10;
    else winnerRepValue -= 10;

    this.currentBlock.reputations.set(winner, winnerRepValue);

  }

  updateBlocks() {

    let block = this.currentBlock;

    // Storing the block.
    this.blocks.set(block.id, block);

    // If it is a better block than the client currently has, set that
    // as the new currentBlock, and update the lastConfirmedBlock.

    if (this.lastBlock.chainLength < block.chainLength) {
      this.lastBlock = block;
      this.setLastConfirmed();
    }


  }

  setLastConfirmed() {
    let block = this.lastBlock;
    // console.log('Last Block: ', this.lastBlock);

    // let confirmedBlockHeight = block.chainLength - ReputationBlockchain.CONFIRMED_DEPTH;
    // if (confirmedBlockHeight < 0) {
    //   confirmedBlockHeight = 0;
    // }
    // while (block.chainLength > confirmedBlockHeight) {
    //   block = this.blocks.get(block.prevBlockHash);
    // }
    this.lastConfirmedBlock = block;

  }
}