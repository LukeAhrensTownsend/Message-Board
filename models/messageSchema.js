var mongoose = require('mongoose');

var messageSchema = mongoose.Schema({
    username: String,
    message: String,
    timestamp: Number
});

var Message = mongoose.model("Message", messageSchema);
module.exports = Message;