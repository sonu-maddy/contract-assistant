import mongoose from 'mongoose';

// TODO: Define the ExtractedItem schema.
const ExtractedItem = mongoose.model('ExtractedItem', new mongoose.Schema({}, { strict: false, timestamps: true }));

export default ExtractedItem;
