window.addEventListener('DOMContentLoaded', function () {
    var foodInterval;
    var connectionTableFront;
    var socketIo = io('http://localhost:8888');
    //var socketIo = io('158.50.163.198:8888')
    var userInFront = {};
    var foodTableFront = [];
    var scoresTable = [];

    var allPlayerScores = document.getElementById('allPlayerScores');
    var allPlayerNames = document.getElementById('allPlayerNames');

    var playerTable = [{
            name: document.getElementById('player1'),
            score: document.getElementById('scoreP1')
        },
        {
            name: document.getElementById('player2'),
            score: document.getElementById('scoreP2')
        }
    ];
    var gameFrame = document.getElementById('gameFrame');
    var pseudoInput = document.getElementById('pseudoInput');
    var submitButton = document.getElementById('submitButton');

    function getRandomInt(max) {
        return Math.floor(Math.random() * Math.floor(max));
    };

    socketIo.on('connectionTable', function (connectionTable) {
        console.log('connectionTable', connectionTable);
        connectionTableFront = connectionTable;
    });

    var getScores = document.getElementById('getScores');
    getScores.addEventListener('click', function () {
        socketIo.emit('getScores', scoresTable);
        socketIo.on('getScores', function (scoresTable) {
            console.log('scoresTable', scoresTable);
            for (var i = 0; i < 10; i++) {
                var pName = document.getElementById('pName' + getRandomInt(10));
                var pScore = document.getElementById('pScore' + getRandomInt(10));
                if (!pName && !pScore) {
                    pName = document.createElement('p');
                    pScore = document.createElement('p');
                    pName.id = 'pName' + scoresTable[i] + i
                    pScore.id = 'pScore' + scoresTable[i] + i
                    allPlayerNames.appendChild(pName);
                    allPlayerScores.appendChild(pScore);
                }
                pName.innerHTML = scoresTable[i].name;
                pScore.innerHTML = scoresTable[i].score;
            }
        })
    });

    var launch = document.getElementById('launch');
    launch.addEventListener('click', function () {
        socketIo.emit('userReady', true);
        socketIo.on('startGame', function (doubleStart) {
            game();
        });
    });

    submitButton.addEventListener('click', function (event) {
        userInFront.name = pseudoInput.value;
        socketIo.emit('newUser', userInFront.name);
        var registerForm = document.getElementById('registerForm');
        registerForm.style.display = 'none';
    });

    socketIo.on('user', function (userMap) {
        var keysTable = Object.keys(userMap);
        for (var j = 0; j < keysTable.length; j++) {
            playerTable[j].name.innerHTML = userMap[keysTable[j]].name;
            playerTable[j].score.innerHTML = 'score : ' + userMap[keysTable[j]].score;
            if (userMap[keysTable[j]].score === 450) {
                socketIo.emit('gameOver', userMap, true);
            }
        }
    });

    socketIo.on('gameOver', function (isOver) {
        gameFrame.style.display = 'none';
        window.removeEventListener('mousemove', mouseMoving);
        socketIo.emit('gameOver', true);
    });


    var mouseMoving = function (event) {
        // Objet contenant les déplacements de la souris pour être envoyés au Back.
        var mouse = {
            y: event.clientY,
            x: event.clientX
        }

        // A chaque déplacement de souris on envoi les coordonnées au back.
        socketIo.emit('movingMouse', mouse);
    };
    var game = function () {
        window.addEventListener('mousemove', mouseMoving);

        // Reception des données nécéssaires pour déssiner un square.
        socketIo.on('drawSquare', function (square) {
            var playerSquare = document.getElementById(square.id);
            if (!playerSquare) {
                playerSquare = document.createElement('div');
                playerSquare.id = square.id;
                gameFrame.appendChild(playerSquare);
            };
            playerSquare.style.left = square.x;
            playerSquare.style.top = square.y;
            playerSquare.style.position = 'absolute';
            playerSquare.style.width = '40px';
            playerSquare.style.height = '40px';
            playerSquare.style.border = '1px solid black';
            playerSquare.style.backgroundColor = square.color;
        });

        // Réception des données nécéssaire pour déssiner la food
        socketIo.on('drawFood', function (food) {
            var divFood = document.getElementById(food.id);
            if (divFood === null) {
                divFood = document.createElement('div');
                divFood.id = food.id;
                foodTableFront.push(food);
            };
            divFood.style.position = 'absolute';
            divFood.style.border = '1px solid black';
            divFood.style.width = food.width;
            divFood.style.height = food.height;
            divFood.style.borderRadius = '5px';
            divFood.style.backgroundColor = food.color;
            divFood.style.top = food.y;
            divFood.style.left = food.x;
            gameFrame.appendChild(divFood);

        });
        socketIo.on('removeFood', function (food) {
            for (var i = 0; i < foodTableFront.length; i++) {
                if (food.id === foodTableFront[i].id) {
                    var divFoodToRemove = document.getElementById(foodTableFront[i].id);
                    divFoodToRemove.remove();
                    socketIo.emit('removeFood', foodTableFront[i]);
                    foodTableFront.splice(i, 1);
                }
            }
        });

        var disconnect = document.getElementById('disconnect');
        disconnect.addEventListener('click', function (event) {
            socketIo.disconnect();
        });

        socketIo.on('removeConnection', function (square) {
            for(var i = 0; i <= 2; i++){
                playerTable[i].name.innerHTML = '';
                playerTable[i].score.innerHTML = '';
            }
        });
    };

});