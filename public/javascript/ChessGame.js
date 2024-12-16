const btn = document.querySelector(".btn");

btn.addEventListener("click", function (e) {
  // Disable button to prevent multiple initializations
  e.preventDefault()
  btn.disabled = true;


  const socket = io();
  const chess = new Chess(); // Initialize chess.js
  const boardElement = document.querySelector(".chessboard");
  const first_container = document.querySelector(".first_container");
  let draggedPiece = null;
  let sourceSquare = null;
  let playerRole = null; // Track if the player is "w", "b", or null (spectator)

  const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = ""; // Clear existing board
    first_container.style.display = "none"
    boardElement.style.display = "grid"
    document.querySelector("body").classList.add("body")

    board.forEach((row, rowIndex) => {
      row.forEach((square, squareIndex) => {
        const squareElement = document.createElement("div");
        squareElement.classList.add(
          "square",
          (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark"
        );
        squareElement.dataset.row = rowIndex;
        squareElement.dataset.col = squareIndex;

        // Add chess piece if present
        if (square) {
          const pieceElement = document.createElement("div");
          pieceElement.classList.add(
            "piece",
            square.color === "w" ? "white" : "black"
          );
          pieceElement.innerText = getPieceUnicode(square);

          // Enable dragging for the player's pieces
          pieceElement.draggable = playerRole === square.color;

          pieceElement.addEventListener("dragstart", (e) => {
            if (pieceElement.draggable) {
              draggedPiece = pieceElement;
              sourceSquare = { row: rowIndex, col: squareIndex };
              e.dataTransfer.setData("text/plain", "");
            }
          });

          pieceElement.addEventListener("dragend", () => {
            draggedPiece = null;
            sourceSquare = null;
          });

          squareElement.appendChild(pieceElement); // Append piece to square
        }

        // Allow dropping on squares
        squareElement.addEventListener("dragover", (e) => e.preventDefault());

        squareElement.addEventListener("drop", (e) => {
          e.preventDefault();
          if (draggedPiece) {
            const targetSquare = {
              row: parseInt(squareElement.dataset.row),
              col: parseInt(squareElement.dataset.col),
            };
            handleMove(sourceSquare, targetSquare);
          }
        });

        boardElement.appendChild(squareElement); // Append square to board
      });
    });

    // Flip the board for Black player
    if (playerRole === "b") {
      boardElement.classList.add("flipped");
    } else {
      boardElement.classList.remove("flipped");
    }
  };

  const handleMove = (source, target) => {
    const move = {
      from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
      to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
      promotion: "q", // Always promote to queen
    };

    // Attempt the move locally
    const moveResult = chess.move(move);
    if (moveResult) {
      socket.emit("move", move);

      // Check game-over conditions
      if (chess.in_checkmate()) {
        const winner = chess.turn() === "w" ? "Black" : "White";
        alert(`${winner} wins by checkmate!`);
        socket.emit("gameOver", { winner });
      } else if (chess.in_stalemate() || chess.in_draw() || chess.insufficient_material()) {
        alert("Game is a draw!");
        socket.emit("gameOver", { winner: null });
      }

      renderBoard();
    } else {
      alert("Invalid move! Try again.");
    }
  };

  const getPieceUnicode = (piece) => {
    const unicodePieces = {
      p: "♙", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", // Black pieces
      P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔", // White pieces
    };
    return unicodePieces[piece.type] || "";
  };

  // Socket event listeners
  socket.on("playerRole", (role) => {
    playerRole = role;
    renderBoard();
  });

  socket.on("spectatorRole", () => {
    playerRole = null;
    renderBoard();
  });

  socket.on("boardState", (fen) => {
    chess.load(fen);
    renderBoard();
  });

  socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
  });

  socket.on("reset", (winner) => {
    alert(`${winner} wins! The game has been reset.`);
    chess.reset();
    renderBoard();
  });

  // Initial board render
  renderBoard();
});
