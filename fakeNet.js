"use strict";

let { FakeNet } = require('spartan-gold');

module.exports = class ReputationFakeNet extends FakeNet {
  constructor(...args) {
    super(...args);

    this.clientIdentities = new Map();
  }

  register(...clientList) {
    for (const client of clientList) {
      this.clients.set(client.address, client);
      this.clientIdentities.set(client.identity, client.address);
    }
  }
};