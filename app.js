var express = require('express');
var handlebars = require('express-handlebars').create({
    defaultLayout: 'main',
    helpers: {
        equals: function (arg1, arg2) {
            return (arg1 === arg2);
        },
        notEquals: function (arg1, arg2) {
            return (arg1 !== arg2);
        },
        or: function(arg1, arg2) {
            return (arg1 || arg2);
        },
        isLoggedIn: function() {
            return (app.locals.username) ? true : false;
        }
    }
});
var mongoose = require('mongoose');
var cookieParser = require('cookie-parser');
var sessions = require('express-session');
var bodyParser = require('body-parser');
var md5 = require('md5');
var credentials = require('./credentials.js');
var User = require('./models/userSchema.js');
var Message = require('./models/messageSchema.js');
var seedDB = require('./models/seed.js')

var app = express();

var connectionString = "mongodb+srv://" + process.env.MONGODB_USERNAME + ":" + process.env.MONGODB_PASSWORD + "@main-n30as.mongodb.net/test?retryWrites=true&w=majority";
mongoose.connect(connectionString, { useNewUrlParser: true });

seedDB.seed(User);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser(credentials.cookieSecret, {
    maxAge: 2592000000
}));
app.use(sessions({
    resave: true,
    saveUninitialized: false,
    secret: credentials.cookieSecret
}));

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

app.use(express.static('public'));

app.use(function (req, res, next) {
    if (!req.cookies.sortorder || !req.cookies.theme) {
        res.cookie('sortorder', 'newest', { maxAge: 2592000000 });
        res.cookie('theme', 'light', { maxAge: 2592000000 });
    }

    app.locals.sortorder = req.cookies.sortorder;
    app.locals.theme = req.cookies.theme;

    next();
});
 
function authorize(req, res, next) {
    if (req.session.username) return next();
    res.redirect(303, '/login');
}

function hasWhiteSpace(string) {
    return string.indexOf(' ') >= 0;
}

function getPostPermission(req) {
    return (req.body.postpermission == 'on' || !req.body.postpermission) ? true : false;
}

// Default route
app.get('/', function (req, res) {
    res.redirect(303, '/messageboard');
});

// Login page
app.get('/login', function (req, res) {
    res.render('login', {
        layout: false
    });
});

// Create user page
app.get('/createaccount', function(req, res) {
    res.render('createaccount', {
        layout: false
    });
});

// Processing the login form
app.post('/processlogin', function (req, res) {
    User.findOne({ username: req.body.username }, function (err, user) {
        if (err) {
            res.render('login', {
                layout: false,
                message: 'Error accessing the database. Please try again.'
            });
        } else if (user && user.password == md5(req.body.password.trim())) {
            req.session.username = app.locals.username = req.body.username;
            res.redirect(303, '/messageboard');
        } else {
            res.render('login', {
                layout: false,
                message: 'We cannot find an account with the following username/password combination. Please try again.'
            });
        }
    });
});

// Message Board page
app.get('/messageboard', function (req, res) {
    Message.find({}).sort({ timestamp: (req.cookies.sortorder === 'newest') ? -1 : 1 }).exec(function (err, posts) {
        res.render('messageboard', {
            posts: posts
        });
    });
});

// Processing the message posting form
app.post('/postmessage', function (req, res) {
    User.findOne({ username: req.session.username }, function (err, user) {
        if (!user) {
            Message.find({}).sort({ timestamp: (req.cookies.sortorder === 'newest') ? -1 : 1 }).exec(function (err, posts) {
                res.render('messageboard', {
                    posts: posts,
                    message: "You must be logged in to post messages to the message board. If you don't have an account, create one "
                });
            });
        } else {
        if (user.postPermission) {
            if (req.body.message.trim().length) {
                var newMessage = new Message({
                    username: req.session.username,
                    message: req.body.message,
                    timestamp: new Date().getTime()
                }).save();

                res.redirect('/messageboard');
            } else {
                Message.find({}).sort({ timestamp: (req.cookies.sortorder === 'newest') ? -1 : 1 }).exec(function (err, posts) {
                    res.render('messageboard', {
                        posts: posts,
                        message: "Messages must contain at least 1 character."
                    });
                });
            }            
        } else {
            Message.find({}).sort({ timestamp: (req.cookies.sortorder === 'newest') ? -1 : 1 }).exec(function (err, posts) {
                res.render('messageboard', {
                    posts: posts,
                    message: "Your account does not have permission to post messages to the message board. Please contact the administrator for further details."
                });
            });
        }
    }
    });
});

// Processing deletion of a post
app.post('/deletepost', function (req, res) {
    Message.findByIdAndDelete(req.query.postid, function (err, post) { });
    res.redirect(303, '/' + req.query.origin);
});

// My Posts page
app.get('/myposts', authorize, function (req, res) {
    Message.find({ username: req.session.username }).sort({ 
        timestamp: (req.cookies.sortorder === 'newest') ? -1 : 1 }).exec(function (err, posts) {
        res.render('myposts', {
            posts: posts
        });
    });
});

// Users page (admin only)
app.get('/users', authorize, function (req, res) {
    if (req.session.username === "Administrator") {
        User.find(function (err, users) {
            res.render('users', {
                users: users
            });
        });
    } else {
        res.redirect(401, '/login');
    }
});

// Processing user post-permission toggle (admin only)
app.post('/togglepermission', function (req, res) {
    User.findOne({ username: req.query.user }, function (err, user) {
        if (err) {
            res.render('users', {
                message: 'Error accessing the database. Please try again.'
            });
        } else {
            User.findOneAndUpdate({ username: req.query.user }, { $set: { postPermission: !user.postPermission } }, { useFindAndModify: false }, function (err, user) {
                if (err) {
                    res.render('users', {
                        message: 'Error accessing the database. Please try again.'
                    });
                } else {
                    res.redirect(303, '/users');
                }
            });
        }
    });
});

// Processing deletion of a user (admin only)
app.post('/deleteuser', function (req, res) {
    User.findOneAndDelete({ username: req.query.user }, function (err, user) {
        if (err) {
            res.render('users', {
                message: 'Error accessing the database. Please try again.'
            });
        } else {
            res.redirect(303, '/users');
        }
    });
});

// Create User page
app.get('/createuser', authorize, function (req, res) {
        if (req.session.username === "Administrator") {
            res.render('createuser');
        } else {
            res.redirect(401, '/messageboard');
        }
});

// Processing user registration (admin only)
app.post('/registeruser', function (req, res) {
    User.find({ username: req.body.username }, function (err, user) {
        if (err) {
            res.render(req.query.origin, {
                message: 'Error accessing the database. Please try again.',
                layout: (req.query.origin === 'createaccount') ? false : 'main'
            });
        } else if (hasWhiteSpace(req.body.username) || hasWhiteSpace(req.body.password1)) {
            res.render(req.query.origin, {
                message: "Both username & password cannot contain any spaces.",
                layout: (req.query.origin === 'createaccount') ? false : 'main'
            });
        } else if (req.body.username.trim().length < 5 || req.body.password1.trim().length < 5) {
            res.render(req.query.origin, {
                message: "Both username & password must contain at least 5 characters.",
                layout: (req.query.origin === 'createaccount') ? false : 'main'
            });
        } else if (user.length) {
            res.render(req.query.origin, {
                message: "A user named \"" + req.body.username + "\" already exists.",
                layout: (req.query.origin === 'createaccount') ? false : 'main'
            });
        } else if (req.body.password1 !== req.body.password2) {
            res.render(req.query.origin, {
                message: 'Passwords do not match.',
                layout: (req.query.origin === 'createaccount') ? false : 'main'
            });
        } else {
            var newUser = new User({
                username: req.body.username,
                password: md5(req.body.password1),
                postPermission: getPostPermission(req)
            }).save();

            if (req.query.origin === 'createaccount') {
                res.render('login', {
                    message: "Account created successfully.",
                    layout: false
                });
            } else {
                res.redirect('/users');
            }           
        }
    });
});

// Settings page
app.get('/settings', authorize, function (req, res) {
        res.render('settings');
});

// Processing changes made on settings page
app.post('/confirmsettings', function (req, res) {
    res.cookie('sortorder', req.body.sortorder, { maxAge: 2592000000 });
    res.cookie('theme', req.body.theme, { maxAge: 2592000000 });

    app.locals.sortorder = req.body.sortorder;
    app.locals.theme = req.body.theme;

    res.render('settings', {
        message: "Changes made successfully!"
    });
});

// Logout duties
app.get('/logout', authorize, function (req, res) {
        delete req.session.username;
        delete app.locals.username;

        res.redirect(303, '/');
});

// 404 catch-all handler
app.use(function (req, res, next) {
    res.status(404);
    res.render('notfound', {
        layout: false
    });
});

// 500 error handler
app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500);
    res.render('error', {
        layout: false
    });
});

app.listen(process.env.PORT || 5000, function() {
    console.log("Server is running...");
});

process.on('unhandledRejection', error => {
    console.log('Unhandled Rejection: ', error.message);
});