"use strict";

const { Block, utils } = require("spartan-gold");

module.exports = class ReputationBlock extends Block {

   constructor(address, prevBlock) {
      super(address, prevBlock);

      this.prevBlockHash = prevBlock ? prevBlock.hashVal() : null;

      this.reputations = prevBlock ? new Map(prevBlock.reputations) : new Map();
      this.voteWinnerMap = new Map();
      this.winner = '';
      this.votesMap = new Map();
      this.decision = '';
      this.announcedVotes = {};
      this.committedVotes = {};
   }

   reputationOf(addr) {
      return this.reputations.get(addr) || 0;
   }

   hashVal() {
      return utils.hash(this.serialize());
   }

   serialize() {
      return JSON.stringify(this);
   }

}
