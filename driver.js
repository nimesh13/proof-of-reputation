"use strict";

const ReputationFakeNet = require('./fakeNet.js');

const ReputationBlockchain = require('./blockchain.js');

const ReputationClient = require('./client.js');

const ReputationBlock = require('./block.js');

console.log("Starting simulation.  This may take a moment...");

let fakeNet = new ReputationFakeNet();

// Clients
let alice = new ReputationClient({name: "Alice", net: fakeNet});
let bob = new ReputationClient({name: "Bob", net: fakeNet});
let charlie = new ReputationClient({name: "Charlie", net: fakeNet});

let clientArray = [alice, bob, charlie];

// Creating genesis block
let genesis = ReputationBlockchain.makeGenesis({
  blockClass: ReputationBlock,
  clientReputationMap: new Map([
    [alice, 10],
    [bob, 10],
    [charlie, 10]
  ]),
});

function showBalances(client) {
  console.log();
  console.log(`Alice's reputation is ${alice.reputationScore}.`);
  console.log(`Bob's reputation is ${bob.reputationScore}.`);
  console.log(`Charlie's reputation is ${charlie.reputationScore}.`);

  // let a = alice.lastConfirmedBlock.reputations.get(alice.address);
  // alice.lastConfirmedBlock.reputations.set(alice.address, (a + 100));

  client.showAllBalances();
}

// Showing the initial balances from Alice's perspective, for no particular reason.
console.log("Initial Reputation scores:");
showBalances(alice);

fakeNet.register(alice, bob, charlie);

clientArray.forEach(client => {
  client.initialize();
})
// alice.initialize();

// alice.net.broadcast(ReputationBlockchain.PROOF_FOUND, alice.currentBlock);

// // Miners start mining.
// minnie.initialize();
// mickey.initialize();

// // Alice transfers some money to Bob.
// let addr = ulysses.createAddress();
// console.log();
// console.log(`***Alice is transferring 40 gold to Ulysses at address ${addr}`);
// console.log();
// alice.postTransaction([{ amount: 40, address: addr }]);

// setTimeout(() => {
//   let addr = ulysses.createAddress();
//   console.log();
//   console.log(`***Alice is transferring 30 gold to Ulysses at address ${addr}`);
//   console.log();
//   alice.postTransaction([{ amount: 30, address: addr }]);
// }, 2000);


// // Print out the final balances after it has been running for some time.
// setTimeout(() => {
//   console.log();
//   showBalances(alice);

//   process.exit(0);
// }, 5000);

