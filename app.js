var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    mongoose = require('mongoose'),
    users = {}; //אובייקט

server.listen(3000);

mongoose.connect('mongodb://localhost/chat-YT', function (err) {
    if (err) {
        console.log(err);
    } else {
        console.log('Connected to mongodb');
    }
});

var chatSchema = mongoose.Schema({
    nick: String,
    msg: String,
    created: {type: Date, default: Date.now}
});

var Chat = mongoose.model('Message', chatSchema);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
    var query = Chat.find({});
    query.sort('-created').limit(20).exec(function (err, docs) {
        if (err) throw err;
        console.log('Sending old msg.');
        socket.emit('load old msg', docs);
    });
    socket.on('new user', function (data, callback) {
        if (data in users) {//בדיקה אם שם המשתמש החדש שנוצר תפוס
            callback(false);
        }
        else {
            callback(true);
            socket.nickname = data;
            users[socket.nickname] = socket;
            updateNicknames();
            console.log('User ' + socket.nickname + ' connected');
        }
    });

    function updateNicknames() {
        io.sockets.emit('usernames', Object.keys(users));
    }

    socket.on('send message', function (data, callback) {
        var msg = data.trim();
        if (msg.substr(0, 8) === 'private ') {
            msg = msg.substr(8);
            var ind = msg.indexOf(' '); //האינדקס הראשון של התו הריק הוא נמצא בין שם המקבל לבין ההודעה שנשלחת אליו
            if (ind !== -1) {
                var name = msg.substring(0, ind); // מחזיק את שם המקבל בכדי לבדוק בהמשך אם המשתמש הזה נמצא בצ'ט
                var msg = msg.substring(ind + 1);
                if (name in users) {
                    users[name].emit('whisper', {msg: msg, nick: socket.nickname});
                    users[socket.nickname].emit('whisper', {msg: msg, nick: socket.nickname});
                    console.log('Whisper!!!');
                } else {
                    callback('Error: Enter a valid user.');
                }
            } else {
                callback('Error: please enter a message for your whisper.');
            }
        } else {
            var newMsg = new Chat({msg: msg, nick: socket.nickname});
            newMsg.save(function (err) {
                if (err) throw err;
                io.sockets.emit('new message', {msg: msg, nick: socket.nickname});
            });
            //socket.broadcast.emit('new message', data); //לשלוח לכולם חוץ ממני
        }
    });

    socket.on('disconnect', function (data) {
        if (!socket.nickname) return; //אם המשתמש בחר שלא להכניס שם משתמש אז אין צורך להסיר אותו מהרשימה
        delete users[socket.nickname];
        updateNicknames();
        Chat.remove({}, function (err, removed) {

        });
    });
});