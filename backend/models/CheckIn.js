const mongoose = require('mongoose');

const CheckInSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    coords: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    photo: {
        type: String, // Base64 or URL
        default: ''
    },
    status: {
        type: String,
        enum: ['in_zone', 'out_of_zone'],
        required: true
    }
});

module.exports = mongoose.model('CheckIn', CheckInSchema);
