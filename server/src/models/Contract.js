import mongoose from 'mongoose';

// TODO: Define the Contract schema.
const Contract = mongoose.model('Contract', new mongoose.Schema({}, { strict: false, timestamps: true }));

export default Contract;
