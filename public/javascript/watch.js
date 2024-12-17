
const chess = new Chess(); // Chess should be defined now
let moveIndex = 0;

const board = Chessboard("board", {
  position: "start",
  draggable: false
});

function loadMove(index) {
  if (index < 0 || index >= gameMoves.length) return;

  chess.reset();
  for (let i = 0; i <= index; i++) {
    const move = gameMoves[i];
    chess.move({ from: move.from, to: move.to });
  }
  board.position(chess.fen());
}

document.getElementById("nextBtn").addEventListener("click", () => {
  if (moveIndex < gameMoves.length) {
    moveIndex++;
    loadMove(moveIndex - 1);
  }
});

document.getElementById("prevBtn").addEventListener("click", () => {
  if (moveIndex > 0) {
    moveIndex--;
    loadMove(moveIndex - 1);
  }
});

loadMove(-1); // Initialize to start position