import mongoose from 'mongoose';

// TODO: Define the ItemEdit schema.
const ItemEdit = mongoose.model('ItemEdit', new mongoose.Schema({}, { strict: false, timestamps: true }));

export default ItemEdit;
