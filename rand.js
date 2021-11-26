"use strict";

let crypto = require('crypto');

const MAX_RANGE = 256;

// Returns a random number between 0 and 255.
function sample() {
  return crypto.randomBytes(1).readUInt8();
}

exports.nextInt = function(range) {
  if (range > MAX_RANGE) {
    throw new Error(`Sorry, range cannot be more than ${MAX_RANGE}`);
  }
  let ur = Math.floor(MAX_RANGE / 250) * 250;
  let num = sample();
  while (num > ur) {
    num = sample();
  }

  return num % range;
}


