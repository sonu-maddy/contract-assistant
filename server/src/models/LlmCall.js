import mongoose from 'mongoose';

// TODO: Define the LlmCall schema.
const LlmCall = mongoose.model('LlmCall', new mongoose.Schema({}, { strict: false, timestamps: true }));

export default LlmCall;
