
// Load modules
var express    = require('express'),
    socketIO   = require('socket.io'),
    cassandra  = require('cassandra'),
    xmlrpc     = require('xmlrpc');

var app = module.exports = express.createServer();

// Express configuration
app.configure(function() {
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});

app.configure('development', function() {
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function() {
	app.use(express.errorHandler()); 
});

// Routes
app.get('/', function(req, res) {
	res.render('index', {
		title: 'Express',
	});
});


// ----------------------------------------------------
// connect Cassandra
var casClient = new cassandra.Client('127.0.0.1:9160');
casClient.connect('keyspace1');
var casColumnFamily = casClient.getColumnFamily('users');


// ----------------------------------------------------
// Express server
app.listen(3000);
console.log("Express server listening on port %d in %s mode",
		app.address().port, app.settings.env);


// ----------------------------------------------------
// socketIO server
var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {
	console.log('connection:'+socket.sessionId);

	// svreset:Cassandraのカラムリセット
	socket.on('svreset', function() {
		casColumnFamily.set('test', {
			msg:''
		}, function(err) {
			console.log('reset');
		});
		io.sockets.emit('clreset');
	});

	// svmsg:ブラウザでの発言
	socket.on('svmsg', function(msg) {
		casColumnFamily.get('test', function(err, res) {
			// 受信したメッセージをコロン区切りでおしりにくっつけていくサンプル
			// 処理自体に意味はない
			var svmsg = res.msg + ':' + msg.value;

			io.sockets.emit('clmsg', {value: svmsg});

			casColumnFamily.set('test', {
				msg:svmsg
			}, function(err) {
				console.log('set cassandra:'+svmsg);
			});
		});
	});

	// 切断
	socket.on('disconnect', function() {
		console.log('discoonect'+socket.sessionId);
		casClient.close();
	});
});


// ----------------------------------------------------
// XML-RPC server
var rpc = xmlrpc.createServer({ host: '127.0.0.1', port: 7777}) // 任意のサーバー

rpc.on('rpctest', function (err, params, callback) {
	var param1 = params[0],
		param2 = params[1],
		param3 = params[2];

	var msg = 'rpctest:'+param1+':'+param2+':'+param3;
	console.log(msg);
	io.sockets.emit('clmsg', {value: msg});

	callback(null, 'aResult');
});

// ----------------------------------------------------
// XML-RPC request test
// 適当なRPCをたたく
setTimeout(function () {
	var client = xmlrpc.createClient({ host: '127.0.0.1', port: 8888, path: '/xmlrpc'})

	client.methodCall('ClassName.MethodName', [1, "strtest", 2], function (error, value) {
		console.log('Method response:' + value)
	})

}, 1000);

