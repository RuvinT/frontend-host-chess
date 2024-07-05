$(document).ready(function() {
    var playerColor = 'white'; // Player plays white by default
    var gameStarted = false; // Flag to track if the game has started

    const whiteSquareGrey = '#a9a9a9'
    const blackSquareGrey = '#696969'

    var board = Chessboard2('board', {
        pieceTheme: 'img/chesspieces/alpha/{piece}.png',
        position: 'start',
        orientation: playerColor,
        draggable: false, // Allow dragging
        onDragStart: onDragStart, // Add onDragStart handler
        onMousedownSquare,
        //onMouseenterSquare
    });

     // Handle window resize to make the board responsive
     window.addEventListener('resize', function() {
        resizeBoard();
    });

    function resizeBoard() {
        var containerWidth = document.getElementById('boardContainer').offsetWidth;
        var containerHeight = document.getElementById('boardContainer').offsetHeight;
        var newSize = Math.min(containerWidth, containerHeight);
        document.getElementById('board').style.width = newSize + 'px';
        document.getElementById('board').style.height = newSize + 'px';
        board.resize();
    }

    resizeBoard(); // Initial resize to set the board size correctly

    let startingSquare = null;
    let tmpArrowId = null;
    var game = new Chess();
    var playerTurn = true; // Flag to track player's turn
    var evaluations = {}; // Object to store evaluations for each move
    var history = []; // Array to store move history for revert and forward moves
    var timerInterval;
    var playerTime, aiTime; // Player and AI times in seconds
    var gameType;
    var moveTimes = {}; // Object to store move times
    var aiMoveEndTime;
    let isPlaying = false;
    var players = {
        "Magnus Carlsen": "./img/magnus.png",
        "Garry Kasparov": "https://example.com/kasparov.jpg",
        "Bobby Fischer": "https://example.com/fischer.jpg",
        "Vishy Anand": "https://example.com/anand.jpg",
        "Hikaru Nakamura": "https://example.com/nakamura.jpg"
    };

    $("#topPlayerImage").attr("src", "./img/magnus.png");
    $("#topPlayerName").text("Magnus Carlsen");
    $("#bottomPlayerImage").attr("src", "./img/player.png");
    $("#bottomPlayerName").text("Player");

    function updatePlayerDetails() {
        var selectedPlayer = $("#grandmaster").val();
        var playerImage = players[selectedPlayer];
        $("#topPlayerImage").attr("src", playerImage);
        $("#topPlayerName").text(selectedPlayer);
    }

    $("#grandmaster").change(function() {
        updatePlayerDetails();
    });

    $('#revertMoveButton').on('click', function() {
        if (history.length > 0) {
            delete evaluations[game.undo().san];
            delete evaluations[game.undo().san];
            board.position(game.fen());
            playerTurn = true;
            updateEvaluationsList();
        }
    });

    $('#moveForwardButton').on('click', function() {
        if (history.length > game.history().length) {
            var nextMove1 = history[history.length - 2];
            var nextMove2 = history[history.length - 1];
            game.move(nextMove1);
            game.move(nextMove2);

            board.position(game.fen());
            getEvaluationFromAPI(function(evaluation) {
                evaluations[nextMove2] = evaluation;
            });
            getEvaluationFromAPI(function(evaluation) {
                evaluations[nextMove1] = evaluation;
            });
            setTimeout(updateEvaluationsList, 250);
        }
    });

    $('#togglePlayButton').on('click', function() {
        if (isPlaying) {
            // Rematch logic here
            resetGame();
            $(this).text('Play');
        } else {
            // Play logic here
            startGame();
            $(this).text('Rematch');
        }
        isPlaying = !isPlaying;
    });

    function startGame() {
        gameStarted = true; // Mark game as started
        gameType = $('input[name="gameType"]:checked').val();
        playerColor = $('input[name="color"]:checked').val(); // Get selected player color
        board.orientation(playerColor); // Set board orientation based on player color
        if (gameType === 'blitz') {
            playerTime = aiTime = 300; // 5 minutes for blitz
        } else if (gameType === 'rapid') {
            playerTime = aiTime = 900; // 15 minutes for rapid
        } else {
            playerTime = aiTime = 0; // No timer for classical
        }
        updateTimers();
        aiMoveEndTime = Date.now();
        board.start(); // Start the chessboard
        if(gameType !== 'classical'){
            startTimer(); // Start the timer
        }
        
        if (playerColor === 'black') {
            playerTurn = false; // It's AI's turn
            setTimeout(makeAIMove, 250); // AI makes the first move
        }
    }

    function resetGame() {
        gameStarted = false;
        game.reset();
        board.position('start');
        evaluations = {};
        history = [];
        moveTimes = {};
        updateEvaluationsList();
        clearInterval(timerInterval);
        $('#bottomTimer').text('00:00');
        $('#topTimer').text('00:00');
    }

    function startTimer() {
        clearInterval(timerInterval); // Clear any existing timer

        timerInterval = setInterval(function() {
            if (playerTurn) {
                playerTime--;
                if (playerTime < 0 ) {
                    clearInterval(timerInterval);
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: 'Player time is up!'
                    });
                }
            } else {
                aiTime--;
                if (aiTime < 0 ) {
                    clearInterval(timerInterval);
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: 'AI time is up!'
                    });
                }
            }
            updateTimers();
        }, 1000);
    }

    function updateTimers() {
        var playerMinutes = Math.floor(playerTime / 60);
        var playerSeconds = playerTime % 60;
        var aiMinutes = Math.floor(aiTime / 60);
        var aiSeconds = aiTime % 60;
        $('#bottomTimer').text(formatTime(playerMinutes, playerSeconds));
        $('#topTimer').text(formatTime(aiMinutes, aiSeconds));
    }

    function formatTime(minutes, seconds) {
        return (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }

    function onDragStart(source, piece, position, orientation) {
        if (!gameStarted) {
            Swal.fire({
                icon: 'info',
                title: 'Please Click Play Button To Start',
            });
            return false; // Prevent piece from being dragged
        }
    }

    function makeAIMove() {
        var moveStartTime = Date.now();

        $.ajax({
            //http://127.0.0.1:5000
            url: 'https://dolphin-app-evjrt.ondigitalocean.app/get_move',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ board: game.fen() }),
            success: function(response) {
                console.log("Received response from API:", response);

                var move = response.move;
                console.log("Move received from API:", move);

                var aiMove = game.move({
                    from: move.slice(0, 2),
                    to: move.slice(2, 4),
                    promotion: 'q'
                });

                aiMoveEndTime = Date.now();
                var moveTime = (aiMoveEndTime - moveStartTime) / 1000; // Time taken in seconds
                moveTimes[aiMove.san] = moveTime;

                board.position(game.fen());
                history.push(aiMove.san);

                getEvaluationFromAPI(function(evaluation) {
                    evaluations[aiMove.san] = evaluation;
                    console.log("AI move evaluation:", evaluations);
                    updateEvaluationsList();
                    playerTurn = true;
                    if (game.game_over()) {
                        setTimeout(function() {
                            Swal.fire({
                                icon: 'info',
                                title: 'Game over checkmate!'
                            });
                        }, 1000);
                    }
                });
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("Error getting AI move:", textStatus, errorThrown);
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: 'Error getting AI move'
                });
            }
        });
    }

    function getEvaluationFromAPI(callback) {
        console.log("Making evaluation ...");
        console.log("Current board FEN:", board.fen());
        $.ajax({
            url: 'https://dolphin-app-evjrt.ondigitalocean.app/get_evaluation',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ board: game.fen() }),
            success: function(response) {
                console.log("Received response from API:", response);
                var evaluation = response.evaluation;
                callback(evaluation);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("Error getting evaluation:", textStatus, errorThrown);
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: 'Error getting evaluation'
                });
            }
        });
    }

    function updateEvaluationsList() {
        $('#evaluationsList').empty();
        for (var move in evaluations) {
            var evaluation = evaluations[move];
            var moveTime = moveTimes[move];
            var listItem = $('<li></li>');
            listItem.append('<span>' + move + '</span>');
            listItem.append('<span>(' + moveTime.toFixed(2) + 's)</span>'); // Add time taken for the move
            var progressContainer = $('<div class="progress-container"></div>');
            var progressBar = $('<div class="progress-bar"></div>').css('width', ((1 - evaluation) * 100) + '%');
            progressBar.append('<span>' + Math.round((1 - evaluation) * 100) + '%</span>'); // Show percentage inside the bar
            progressContainer.append(progressBar);
            listItem.append(progressContainer);
            $('#evaluationsList').prepend(listItem);
        }
    }

    /////////////////////////////////////////////////////////

    function onMousedownSquare (evt, domEvt) {
        // clear any circles that may be on the board
        board.clearCircles()
        console.log("onMousedownSquare",evt,domEvt)
        console.log("start squ",startingSquare)
        console.log("end squ",evt.square)
        // Validate move
        var move = game.move({
            from: startingSquare,
            to: evt.square,
            promotion: 'q' // promote to queen for simplicity
        });
    
        if (move === null && startingSquare!== null) {
            // Illegal move
            console.log("Illegal move");
            playerTurn = true;
            return 'snapback';
        } else if(move !== null && startingSquare!== null) {
            var moveEndTime = Date.now();
            var moveTime = (moveEndTime - aiMoveEndTime) / 1000; // Time taken in seconds
            moveTimes[move.san] = moveTime;
            playerTurn = false;
            history.push(move.san);

            getEvaluationFromAPI(function(evaluation) {
                evaluations[move.san] = evaluation;
                console.log("Player move evaluation:", evaluations);
                updateEvaluationsList();
                if (!playerTurn) {
                    setTimeout(makeAIMove, 250);
                }
            });
        }
    
        // do we have a pending arrow?
        if (startingSquare) {
            // clear the pending and tmp arrows
            startingSquare = null
            //board.removeArrow(tmpArrowId)
            tmpArrowId = null
        } else {
            // store the pending arrow info
            startingSquare = evt.square
            console.log("selected squire",evt.square)
            const moves = game.moves({ square: evt.square })
            console.log("selected moves",moves)
            // exit if there are no moves available for this square
            if (moves.length === 0){
                startingSquare = null
                //board.removeArrow(tmpArrowId)
                tmpArrowId = null
            }else{
                // highlight the possible squares for this piece
                for (let i = 0; i < moves.length; i++) {
                    // Get the last two characters of the move string
                    const lastTwoCharacters = moves[i].slice(-2);
                    // Assuming board.addCircle expects the position in the format "e4" etc.
                    board.addCircle(lastTwoCharacters);
                }
                // put a circle on the starting square
                board.addCircle(evt.square)
            }
        }
    }
    /*
    function onMouseenterSquare (evt, domEvt) {
        // do nothing if we are not pending an Arrow
        if (!startingSquare) return
        // remove the existing tmp arrow if necessary
        if (tmpArrowId) {
            board.removeArrow(tmpArrowId)
        }
        // add a tmp arrow to the board
        tmpArrowId = board.addArrow({
            start: startingSquare,
            end: evt.square
        })
    }
*/
$('#board').on('touchstart', { passive: true }, function(e) {
    var touch = e.originalEvent.touches[0];
    var square = getSquareFromTouch(touch.pageX, touch.pageY);
    if (square) {
        onMousedownSquare({ square: square }, e);
    }
});







function getSquareFromTouch(x, y) {
    var boardElement = $('#board');
    var boardOffset = boardElement.offset();
    var boardSize = boardElement.width(); // Assumes square board
    var squareSize = boardSize / 8;

    var relativeX = x - boardOffset.left;
    var relativeY = y - boardOffset.top;

    if (relativeX < 0 || relativeX > boardSize || relativeY < 0 || relativeY > boardSize) {
        return null; // Outside of the board
    }

    var file = Math.floor(relativeX / squareSize);
    var rank = 7 - Math.floor(relativeY / squareSize); // Reverse y-coordinate for ranks

    var files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    return files[file] + (rank + 1);
}


    
});
