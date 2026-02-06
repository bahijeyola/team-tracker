const mongoose = require('mongoose');

const ZoneSchema = new mongoose.Schema({
    center: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    radius: {
        type: Number, // In meters
        required: true,
        default: 100
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Zone', ZoneSchema);
