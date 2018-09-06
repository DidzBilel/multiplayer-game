'use strict';

//chargement des modules (dont le module HTTP.)
const http = require('http');
const express = require('express');
const app = express();
const SocketIo = require('socket.io');
const MongoClient = require('mongodb').MongoClient;
const url = process.env.MONGODB_URI;

//Création du server HTTP.
let httpServer = http.createServer(app);
let connectionTable = [];
let foodTable = [];
let foodInterval;
let food;
let squares = {};
let squareInterval;
const userMap = {};

app.set('view engine', 'pug');
app.use('/css', express.static('css'));
app.use('/js', express.static('js'));
app.use('/img', express.static('img'));
app.use('/node_modules', express.static('node_modules'));
app.use('/semantic', express.static('semantic'));

app.get('/', function (req, res, next) {
  res.render('index');
});

// nouvelle instance de 'serveur' websocket
let socketIo = new SocketIo(httpServer);

/****************************************** TOUTES LE FONCTIONS *********************************************/
/******************************************   SONT REPERTORIEES *****************************************/
/******************************************          ICI        ********************************************/
function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
};

function getShade() {
  return Math.floor(Math.random() * 256);
};

function getRandomColor() {
  return `rgb(${getShade()}, ${getShade()}, ${getShade()})`;
};

function movingSquare(square, mouse) {
  clearInterval(squareInterval);
  squareInterval = setInterval(function () {

    if (parseFloat(square.y) > (mouse.y - parseFloat(square.height) / 2)) {
      if (parseFloat(square.y) <= 0) {
        square.y = (parseFloat(square.y) - 0) + 'px';
      } else {
        square.y = (parseFloat(square.y) - 2) + 'px';
      }
    } else {
      if (parseFloat(square.y) < (mouse.y - parseFloat(square.height) / 2)) {
        if (parseFloat(square.y) >= 411) {
          square.y = (parseFloat(square.y) + 0) + 'px';
        } else {
          square.y = (parseFloat(square.y) + 2) + 'px';
        }

      }
    }

    if (parseFloat(square.x) > (mouse.x - parseFloat(square.width) / 2)) {
      if (parseFloat(square.x) <= 0) {
        square.x = (parseFloat(square.x) - 0) + 'px';
      } else {
        square.x = (parseFloat(square.x) - 2) + 'px';
      }
    } else {
      if (parseFloat(square.x) < (mouse.x - parseFloat(square.width) / 2)) {
        if (parseFloat(square.x) >= 1222) {
          square.x = (parseFloat(square.x) + 0) + 'px';
        } else {
          square.x = (parseFloat(square.x) + 2) + 'px';
        }

      }
    }
  }, 10);
};

function scoreIncrement(user) {
  user.score = user.score + 10;
};

// Constructeur de Square
var Square = function () {
  this.x = '0px';
  this.y = '0px';
  this.id = 'square' + getRandomInt(50000000000);
  this.color = getRandomColor();
  this.height = '40px';
  this.width = '40px';

  this.collisionDetection = function (food) {
    if (parseFloat(food.x) > parseFloat(this.x) + parseFloat(this.width) ||
      parseFloat(food.x) < parseFloat(this.x) - parseFloat(food.width) ||
      parseFloat(food.y) > parseFloat(this.y) + parseFloat(this.height) ||
      parseFloat(food.y) < parseFloat(this.y) - parseFloat(food.height)) {
      return false;
    } else {
      return true;
    }
  }.bind(this);
};

// Constructeur de Food.
var Food = function () {
  this.x = getRandomInt(1222) + 'px';
  this.y = getRandomInt(412) + 'px';
  this.id = 'food' + getRandomInt(500000000);
  this.color = getRandomColor();
  this.width = '8px';
  this.height = '8px';
};

function canStartGame(userMap) {

  var keysTable = Object.keys(userMap);
  if (keysTable.length < 2) {
    return false;
  }

  const areAllPlayersReady = keysTable.reduce(function (accumulator, currentKey) {
    const user = userMap[currentKey];
    return !accumulator ? accumulator : user.ready;
  }, true)
  console.log('y\'all Ready ? ', areAllPlayersReady);
  return areAllPlayersReady;

};

function generateFood(foodTable, foodInterval, food) {
  foodInterval = setInterval(function () {
    if (foodTable.length >= 100) {
      clearInterval(foodInterval);
    } else {
      food = new Food();
      foodTable.push(food);
      socketIo.emit('drawFood', food);
    }
  }, 80);
};

socketIo.on('connection', function (websocketConnection) {
  console.log('A new user connected');
  connectionTable.push(websocketConnection.id);
  socketIo.emit('connectionTable', connectionTable);

  let square = new Square();
  squares[square.id] = square;
  userMap[websocketConnection.id] = {
    score: 0,
    ready: false
  };

  // Gestion nouvel utilisateur
  websocketConnection.on('newUser', function (userName) {
    userMap[websocketConnection.id].name = userName;

    MongoClient.connect(url, function (err, db) {
      const user = userMap[websocketConnection.id]
      if (err) throw err;
      var dbo = db.db('heroku_nk5l3zlf');
      dbo.collection('users').insertOne({
        name: user.name,
        score: user.score
      }, function (err, obj) {
        if (err){ throw err; console.log('error Insert ! ', err); };
        console.log('1 user inserted');
        socketIo.emit('user', userMap);
      });
    });
  });

  // Gestion du lancement du jeu
  websocketConnection.on('userReady', function (isUserReady) {
    userMap[websocketConnection.id].ready = true;
    if (canStartGame(userMap)) {
      generateFood(foodTable, foodInterval, food);
      socketIo.emit('startGame', true);
    }

  });

  // Cet event permet de récupérer la liste des users/scores pour les avoir au Front.
  websocketConnection.on('getScores', function (scoresTable) {
    MongoClient.connect(url, function (err, db) {
      if (err) throw err;
      var dbo = db.db('heroku_nk5l3zlf');
      dbo.collection('users').find({}, {
        _id: 0
      }).toArray(function (err, result) {
        if (err) throw err;
        console.log('result', result);
        scoresTable = result;
        socketIo.emit('getScores', scoresTable);
      });
    });
  });

  // Envoi du square et de la food coté client.
  socketIo.emit('drawSquare', square);

  // Event gérant les mouvements de la souris / square avec les collisions.
  websocketConnection.on('movingMouse', function (mouse) {
    // - Cette fonction créée plus haut sert à faire bouger le square en fonction des mouvements de la souris.
    movingSquare(square, mouse);

    // - Parcours du tableau de food pour gérer les collisions avec la méthode collisionDetection codée plus haut.
    // - Incrémentation du score.
    for (let i = 0; i < foodTable.length; i++) {
      if (squares[square.id].collisionDetection(foodTable[i])) {
        socketIo.emit('removeFood', foodTable[i]);
        scoreIncrement(userMap[websocketConnection.id]);
        socketIo.emit('user', userMap);
      }
    };

    // - Quand une food est mangée on la retire du tableau coté back.
    websocketConnection.on('removeFood', function (foodFromClient) {
      for (let i = 0; i < foodTable.length; i++) {
        if (foodFromClient.id === foodTable[i].id) {
          foodTable.splice(i, 1);
        }
      }
    });
    // Envoi à tous, des coordonnées du carré à jour.
    socketIo.emit('drawSquare', square);
  });

  // Event gérant la déconnexion du server.
  websocketConnection.on('disconnect', function (square) {
    console.log('Event Disconnect reçu');
    delete squares[square.id];
    for (let i = 0; i < connectionTable.length; i++) {
      if (connectionTable[i] === websocketConnection.id) {
        console.log('Cette connection est terminée', connectionTable[i]);
        connectionTable.splice(i, 1);
      };
    };
    socketIo.emit('removeConnection', square);
  });

  // Event gérant la fin du jeu. et la MàJ du score en BDD
  websocketConnection.on('gameOver', function (userMap, isOver) {
    if (isOver === true || isOver !== undefined) {
      MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        var dbo = db.db('heroku_nk5l3zlf');
        var query = {
          _id: userMap[websocketConnection.id]._id
        };
        var newValues = {
          $set: {
            score: userMap[websocketConnection.id].score
          }
        }
        dbo.collection('users').updateOne(query, newValues, function (err, res) {
          if (err) throw err;
          console.log('1 user updated', userMap[websocketConnection.id].name + ' ' + userMap[websocketConnection.id].score);
          socketIo.emit('gameOver', isOver);
        });
      });
    }
  });
});

httpServer.listen(process.env.PORT || 8888);
