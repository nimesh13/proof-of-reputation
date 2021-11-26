"use strict";

const { Block, utils } = require("spartan-gold");

module.exports = class ReputationBlock extends Block {

   constructor(address, prevBlock) {
      super(address, prevBlock);

      this.prevBlockHash = prevBlock ? prevBlock.hashVal() : null;

      super.reputations = prevBlock ? new Map(prevBlock.reputations) : new Map();
      super.voteWinnerMap = new Map();
      super.winner = '';
      super.votesMap = new Map();
      super.decision = '';
   }

   balanceOf(addr) {
      return this.reputations.get(addr) || 0;
   }

   hashVal() {
      return utils.hash(this.serialize());
   }

   serialize() {
      return JSON.stringify(this);
   }

}
