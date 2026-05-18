// REBUILD REQUIRED: run 'circom circuits/driverIdentity.circom --r1cs --wasm --sym -o circuits/ && snarkjs groth16 setup ...'
pragma circom 2.0.0;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/poseidon.circom";

template DriverIdentity() {
    // Private inputs — never leave the client device
    signal input licenseHash;
    signal input birthYear;
    signal input salt;

    // Public input — passed by the client, verifiable by anyone
    signal input currentYear;

    // Public outputs
    signal output commitment;
    signal output ageValid;

    // Commitment: Poseidon(licenseHash, birthYear, salt)
    component hasher = Poseidon(3);
    hasher.inputs[0] <== licenseHash;
    hasher.inputs[1] <== birthYear;
    hasher.inputs[2] <== salt;
    commitment <== hasher.out;

    // Age verification: currentYear - birthYear >= 21
    signal age;
    age <== currentYear - birthYear;

    component ageCheck = GreaterEqThan(8);
    ageCheck.in[0] <== age;
    ageCheck.in[1] <== 21;
    ageValid <== ageCheck.out;
}

component main { public [currentYear] } = DriverIdentity();
