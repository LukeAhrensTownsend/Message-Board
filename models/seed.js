var md5 = require('md5');

var seed = function(User) {
    User.find({ username: "Administrator" }, function(err, users) {
        if (users.length) return;

        var admin = new User({
            username: "Administrator",
            password: md5(process.env.MONGODB_PASSWORD),
            postPermission: true
        }).save();
    });
};

module.exports = {
    seed: seed
}