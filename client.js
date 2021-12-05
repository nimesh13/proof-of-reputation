"use strict";

let { Client } = require('spartan-gold');

let ReputationBlockchain = require('./blockchain.js');
let crypto = require('crypto');
let rand = require('./rand');
const { finished } = require('stream');

const HASH_ALG = "SHA256";
let identityCount = 0;
let numRounds = 0;

module.exports = class ReputationClient extends Client {

  constructor(...args) {
    super(...args);

    this.identity = identityCount;
    identityCount += 1;

    this.on(ReputationBlockchain.START_VOTING, this.commitVote);
    this.on(ReputationBlockchain.COMMIT_VOTE, this.handleCommit);
    this.on(ReputationBlockchain.VOTE_WINNER, this.receiveVote);
    this.on(ReputationBlockchain.PROOF_FOUND1, this.receiveProof);
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

    // if (numRounds == 7) process.exit(0);

    this.startNewSearch();

    setTimeout(() => this.emit(ReputationBlockchain.START_VOTING), 0);
  }

  startNewSearch() {

    this.currentBlock = ReputationBlockchain.makeBlock(this.address, this.lastConfirmedBlock);
    // if (numRounds === 5) console.log('Current block', this.currentBlock);
    // console.log(this.name, 'Starting new search');
  }

  // voteWinner() {
  //   this.numPlayers = this.currentBlock.reputations.size;

  //   let number = rand.nextInt(this.numPlayers);
    
  //   this.announceVote({ id: this.address, vote: number });
  // }

  async commitVote() {
    //this.numPlayers = this.currentBlock.reputations.size;
    this.numPlayers = 0;
    let number = crypto.randomBytes(4).readUInt32BE(0, true);

    this.chosenNumber = number;
    this.committedVotes = {};

    let hashed = crypto.createHash(HASH_ALG).update(number.toString()).digest('hex');
    let nonce = crypto.randomBytes(2).toString('hex');
    this.nonce = nonce;

    this.net.broadcast(ReputationBlockchain.COMMIT_VOTE, { id: this.address, hashedVote: hashed+nonce});
    await new Promise(resolve => setTimeout(resolve, 3000));
    this.announceVote();
  }
  handleCommit(o){
    this.numPlayers++;
    this.committedVotes[o.id] = o.hashedVote;
    // if (Object.keys(this.committedVotes).length === this.numPlayers){
    //   this.announceVote();
    // }
  }
  /**
   * Broadcast the block, with a valid proof included.
   */
  announceVote() {
    this.announcedVotes = {};
    this.net.broadcast(ReputationBlockchain.VOTE_WINNER, {id: this.address, vote: this.chosenNumber, nonce: this.nonce});
  }

  receiveVote(o) {
    console.log(o);
    this.announcedVotes[o.id] = [o.vote, o.nonce];
    if (Object.keys(this.announcedVotes).length === this.numPlayers){
      this.determineWinner();
      if (this.currentBlock.winner === this.address) {
        this.announceProof();
      }
    }
    //this.currentBlock.voteWinnerMap.set(msg.id, msg.vote);

    // if (this.currentBlock.voteWinnerMap.size === this.numPlayers) {
    //   this.determineWinner();
    //   if (this.currentBlock.winner === this.address) {
    //     this.announceProof();
    //   }
    // }
  }

  announceProof() {
    let msg = { proof: rand.nextInt(200) };
    this.net.broadcast(ReputationBlockchain.PROOF_FOUND1, msg);
  }

  determineWinner() {
    //let sum = 0;
    //let voteMap = this.currentBlock.voteWinnerMap;
    // voteMap.forEach((share) => {
    //   sum += share;
    // });
    
    let sum = 0;

    // check for cheaters
    for (let id in this.announcedVotes){
      let committed = this.committedVotes[id];

      console.log(this.announcedVotes[id]);
      
      let num = this.announcedVotes[id][0];
      let nonce = this.announcedVotes[id][1]; 
      let hashed = crypto.createHash(HASH_ALG).update(num.toString()).digest('hex');

      if (hashed+nonce !== committed){
        console.log(`${id} is invalid`);
        // don't add to sum
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
    let num = rand.nextInt(2);

    if (num) return 'VALID';
    return 'INVALID';
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