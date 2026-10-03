import mongoose from 'mongoose';

// TODO: Define the ContractVersion schema.
const ContractVersion = mongoose.model('ContractVersion', new mongoose.Schema({}, { strict: false, timestamps: true }));

export default ContractVersion;
