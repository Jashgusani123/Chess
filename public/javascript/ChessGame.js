const btn = document.querySelector(".btn");
const message = document.querySelector("input[name='message']");
const send_btn = document.querySelector(".send_btn");
const chess_container = document.querySelector(".chess_container");
const chess_chat = document.querySelector(".chess_chat");
const chat_box = document.querySelector(".chat_box");
const chat_image = document.querySelector(".chat_image");
const search_btn = document.querySelector(".search_btn");
const search_input = document.querySelector("input[name='search']");
const offcanvas_body = document.querySelector(".offcanvas-body");
const btn_friend = document.querySelector(".btn_friend");
const Accept_btn = document.querySelector(".Accept_btn");
const Reject_btn = document.querySelector(".Reject_btn");
const addfriend = document.querySelector(".addfriend");
const username = document.querySelector(".username");
const go_to_game = document.querySelector(".go_to_game");
const waiting_box = document.querySelector(".waiting-box");
const home = document.querySelector(".content-home");
const socket = io();
socket.emit("setUsername", username?.innerText);

// Add Friend
offcanvas_body?.addEventListener("click", async function (e) {
  if (
    e.target &&
    e.target.parentElement.parentElement.classList.value === "btn_friend"
  ) {
    e.preventDefault();
    const friend_username =
      e.target.localName === "path"
        ? e.srcElement.farthestViewportElement.parentElement.parentElement
            .innerText
        : e.srcElement.parentElement.parentElement.innerText;
    const notificationcreate = await fetch(
      `https://chess-t0e4.onrender.com/notificationcreate`,
      {
        method: "POST",
        body: JSON.stringify({ username: friend_username }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (notificationcreate) {
      alert("Notification Sent");
      socket.emit("notificationcreate", friend_username);
    } else {
      alert("Notification Not Sent");
    }
  }
});

socket.on("comingnotification", async function () {
  alert("Notification Received !!");
});

async function AddFriend(e) {
  e.preventDefault();
  const res = await fetch(`https://chess-t0e4.onrender.com/api/v1/set`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: socket.id }), // Assuming socket.id is a variable with the correct value
  });
  const data = await res.json();
  socket.emit(
    "Invite",
    username?.innerText,
    e.target.parentElement.parentElement.children[0].innerText,
    data.data._id
  );
}

socket.on("comenewmessage", function (senderId, message) {
  chat_box.style.display = "flex";
  chat_image.style.display = "none";

  if (senderId === socket.id) {
    chat_box.innerHTML += `<p class="message text-white"><span class="text-yellow-600">You</span> : ${message}</p>`;
  } else {
    chat_box.innerHTML += `<p class="message text-white"><span class="text-red-600">Opposite Player</span> : ${message}</p>`;
  }
});

socket?.on("Invite", async (sender, gameId) => {
  let finish = false;

  socket.on("gamefinsh", async (gameId, tag) => {
    finish = tag;
    
     await fetch(`https://chess-t0e4.onrender.com/api/v1/deleteinobj`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: gameId }), // Assuming socket.id is a variable with the correct value
    });
    
    window.location.href = "/";
  });

  socket.on("cometogame", async () => {
    waiting_box.style.display = "none";
    home.style.display = "flex";
  });
  
  socket.on("waiting", () => {
    waiting_box.style.display = "flex";
    home.style.display = "none";
  });

  const userResponse = window.confirm(`${sender} invited you to a game!`);
  
  if (userResponse === true) {
    const res = await fetch(`https://chess-t0e4.onrender.com/api/v1/setwithfriend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: gameId, socketId: socket.id }), // Assuming socket.id is a variable with the correct value
    });
    const data = await res.json();

    socket.emit("getSocketId", sender, function (err, socketId) {
      if (err) {
        console.error(err);
      } else {
        socket.emit(
          "InviteAccepted",
          sender,
          username?.innerText,
          data.data._id,
          data.data.players
        );
        socket.emit("gamestart", data.data._id, data.data.players);
      }
    });

    const chess = new Chess(); // Initialize chess.js
    const boardElement = document.querySelector(".chessboard");
    const chessandchat = document.querySelector(".chessandchat");
    const first_container = document.querySelector(".first_container");
    let draggedPiece = null;
    let sourceSquare = null;
    let playerRole = null; // Track if the player is "w", "b", or null (spectator)

    const renderBoard = () => {
      const board = chess.board();
      boardElement.innerHTML = ""; // Clear existing board
      first_container.style.display = "none";
      boardElement.style.display = "grid";
      chess_chat.style.display = "flex";
      chessandchat.style.display = "flex";
      chess_container.style.display = "flex";
      document.querySelector("body").classList.add("body");

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
        socket.emit("move", gameId, move);

        // Check game-over conditions
        if (chess.in_checkmate()) {
          const winner = chess.turn() === "w" ? "Black" : "White";
          alert(`${winner} wins by checkmate!`);
          socket.emit("gameOver", { winner, gameId: gameId });
        } else if (
          chess.in_stalemate() ||
          chess.in_draw() ||
          chess.insufficient_material()
        ) {
          alert("Game is a draw!");
          socket.emit("gameOver", { winner: null, gameId: gameId });
        }

        renderBoard();
      } else {
        alert("Invalid move! Try again.");
      }
    };

    const getPieceUnicode = (piece) => {
      const unicodePieces = {
        p: "♙",
        r: "♜",
        n: "♞",
        b: "♝",
        q: "♛",
        k: "♚", // Black pieces
        P: "♙",
        R: "♖",
        N: "♘",
        B: "♗",
        Q: "♕",
        K: "♔", // White pieces
      };
      return unicodePieces[piece.type] || "";
    };

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

    socket.on("sendRecording", (game_id, type) => {
      window.location.href = `/game/${game_id}?type=${type}`;
    });
    // Initial board render
    renderBoard();
  } else {
    alert("You rejected the invitation");
  }
});

socket?.on("InviteAccepted", async (me, gameId, Players) => {
  let finish = false;
  socket.on("gamefinsh", async (gameId, tag) => {
    finish = tag;
    
     await fetch(`https://chess-t0e4.onrender.com/api/v1/deleteinobj`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: gameId }), // Assuming socket.id is a variable with the correct value
    });
    
    window.location.href = "/";
  });

  socket.on("cometogame", async () => {
    waiting_box.style.display = "none";
    home.style.display = "flex";
    
  });

  socket.on("waiting", () => {
    waiting_box.style.display = "flex";
    home.style.display = "none";
  });

  socket.emit("gamestart", gameId, Players);


  const chess = new Chess(); // Initialize chess.js
  const boardElement = document.querySelector(".chessboard");
  const chessandchat = document.querySelector(".chessandchat");
  const first_container = document.querySelector(".first_container");
  let draggedPiece = null;
  let sourceSquare = null;
  let playerRole = null; // Track if the player is "w", "b", or null (spectator)

  const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = ""; // Clear existing board
    first_container.style.display = "none";
    boardElement.style.display = "grid";
    chess_chat.style.display = "flex";
    chessandchat.style.display = "flex";
    chess_container.style.display = "flex";
    document.querySelector("body").classList.add("body");

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
      socket.emit("move", gameId, move);

      // Check game-over conditions
      if (chess.in_checkmate()) {
        const winner = chess.turn() === "w" ? "Black" : "White";
        alert(`${winner} wins by checkmate!`);
        socket.emit("gameOver", { winner, gameId });
      } else if (
        chess.in_stalemate() ||
        chess.in_draw() ||
        chess.insufficient_material()
      ) {
        alert("Game is a draw!");
        socket.emit("gameOver", { winner: null, gameId });
      }

      renderBoard();
    } else {
      alert("Invalid move! Try again.");
    }
  };

  const getPieceUnicode = (piece) => {
    const unicodePieces = {
      p: "♙",
      r: "♜",
      n: "♞",
      b: "♝",
      q: "♛",
      k: "♚", // Black pieces
      P: "♙",
      R: "♖",
      N: "♘",
      B: "♗",
      Q: "♕",
      K: "♔", // White pieces
    };
    return unicodePieces[piece.type] || "";
  };

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
  socket.on("sendRecording", (game_id, type) => {
    window.location.href = `/game/${game_id}?type=${type}`;
  });
  // Initial board render
  renderBoard();
});

search_btn?.addEventListener("click", async function (e) {
  e.preventDefault();
  const response = await fetch(`https://chess-t0e4.onrender.com/search`, {
    method: "POST",
    body: JSON.stringify({ username: search_input.value }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  search_input.value = "Searching...";
  if (data.success) {
    const user = data.users[0];
    const friend_list_item = document.createElement("div");
    friend_list_item.style.display = "flex";
    friend_list_item.style.justifyContent = "space-between";
    friend_list_item.style.alignItems = "center";
    friend_list_item.style.gap = "2";
    friend_list_item.style.backgroundColor = "#18181b";
    friend_list_item.style.borderRadius = "13px";
    friend_list_item.style.padding = "2px";
    const first_con = document.createElement("div");
    first_con.style.display = "flex";
    first_con.style.justifyContent = "space-between";
    first_con.style.alignItems = "center";
    first_con.style.gap = "10px";
    first_con.innerHTML = `<img src="${user.avatar}" alt="Avatar" class="w-[50px] h-[50px] rounded-full">
    <p class="text-white">${user.username}</p>`;
    friend_list_item.appendChild(first_con);
    let button = document.createElement("button");
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg>`;
    button.classList.add("btn_friend");
    friend_list_item.appendChild(button);
    offcanvas_body.appendChild(friend_list_item);
  } else if (data.type === "friend") {
    const user = data.users[0];
    const friend_list_item = document.createElement("div");
    friend_list_item.style.display = "flex";
    friend_list_item.style.justifyContent = "space-between";
    friend_list_item.style.alignItems = "center";
    friend_list_item.style.gap = "2";
    friend_list_item.style.backgroundColor = "#18181b";
    friend_list_item.style.borderRadius = "13px";
    friend_list_item.style.padding = "2px";
    const first_con = document.createElement("div");
    first_con.style.display = "flex";
    first_con.style.justifyContent = "space-between";
    first_con.style.alignItems = "center";
    first_con.style.gap = "10px";
    first_con.innerHTML = `<img src="${user.avatar}" alt="Avatar" class="w-[50px] h-[50px] rounded-full">
    <p class="text-white">${user.username}</p>`;
    friend_list_item.appendChild(first_con);
    let button = document.createElement("button");
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M500-482q29-32 44.5-73t15.5-85q0-44-15.5-85T500-798q60 8 100 53t40 105q0 60-40 105t-100 53Zm220 322v-120q0-36-16-68.5T662-406q51 18 94.5 46.5T800-280v120h-80Zm80-280v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80Zm-480-40q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM0-160v-112q0-34 17.5-62.5T64-378q62-31 126-46.5T320-440q66 0 130 15.5T576-378q29 15 46.5 43.5T640-272v112H0Zm320-400q33 0 56.5-23.5T400-640q0-33-23.5-56.5T320-720q-33 0-56.5 23.5T240-640q0 33 23.5 56.5T320-560ZM80-240h480v-32q0-11-5.5-20T540-306q-54-27-109-40.5T320-360q-56 0-111 13.5T100-306q-9 5-14.5 14T80-272v32Zm240-400Zm0 400Z"/></svg>`;
    button.classList.add("addfriend");
    button.addEventListener("click", AddFriend);
    friend_list_item.appendChild(button);
    offcanvas_body.appendChild(friend_list_item);
  } else {
    alert("No user found...");
  }
  search_input.value = "";
});

Accept_btn?.addEventListener("click", async function (e) {
  e.preventDefault();
  const notification = await fetch(`https://chess-t0e4.onrender.com/notificationaccept`, {
    method: "POST",
    body: JSON.stringify({
      senderusername:
        e.target.parentElement.parentElement.children[0].innerText,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  await notification.json();
  if (notification.status === 200) {
    window.location.href = "/";
    alert("Notification Accepted");
  } else {
    window.location.href = "/";
    alert("Notification Not Accepted");
  }
});

Reject_btn?.addEventListener("click", async function (e) {
  e.preventDefault();
  const notification = await fetch(`https://chess-t0e4.onrender.com/notificationreject`, {
    method: "POST",
    body: JSON.stringify({
      senderusername:
        e.target.parentElement.parentElement.children[0].innerText,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  await notification.json();
});

send_btn?.addEventListener("click", async (e) => {
  e.preventDefault();
  if (socket) {
    const res = await fetch(`https://chess-t0e4.onrender.com/api/v1/give`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ socketId: socket.id }), // Assuming socket.id is a variable with the correct value
    });
    const data = await res.json();

    socket.emit("newmessage", {
      message: message.value,
      gameId: data.data._id,
    });
    message.value = "";
  }
});

// Chess Board Render
btn?.addEventListener("click", async (e) => {
  // Disable button to prevent multiple initializations
  e.preventDefault();
  btn.disabled = true;
  let finish = false;
  const res = await fetch(`https://chess-t0e4.onrender.com/api/v1/set`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: socket.id }), // Assuming socket.id is a variable with the correct value
  });
  let data = await res.json();
  socket.on("gamefinsh", async (gameId, tag) => {
    finish = tag;
    
    await fetch(`https://chess-t0e4.onrender.com/api/v1/deleteinobj`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: gameId }), // Assuming socket.id is a variable with the correct value
    });
    
    window.location.href = "/";
  });
  socket?.on("Your_Opponent_disconected", async (gameId) => {
    window.location.href = "/";
    if (!finish) {
      alert("You Win !! ( Your Opponent Is Disconnected )");
    }

     await fetch(`https://chess-t0e4.onrender.com/api/v1/deleteinobj`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: gameId }), // Assuming socket.id is a variable with the correct value
    });
  });

  socket.on("cometogame", async () => {
    waiting_box.style.display = "none";
    home.style.display = "flex";
    const res = await fetch(`https://chess-t0e4.onrender.com/api/v1/give`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: data.data._id }), // Assuming socket.id is a variable with the correct value
    });
    data = await res.json();
  });

  socket.on("waiting", () => {
    waiting_box.style.display = "flex";
    home.style.display = "none";
  });

  const role = data.data.players.white === socket.id ? "w" : "b";
  socket.emit("gamestart", data.data._id, data.data.players, role);

  const chess = new Chess(); // Initialize chess.js
  const boardElement = document.querySelector(".chessboard");
  const chessandchat = document.querySelector(".chessandchat");
  const first_container = document.querySelector(".first_container");
  let draggedPiece = null;
  let sourceSquare = null;
  let playerRole = null; // Track if the player is "w", "b", or null (spectator)

  const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = ""; // Clear existing board
    first_container.style.display = "none";
    boardElement.style.display = "grid";
    chess_chat.style.display = "flex";
    chessandchat.style.display = "flex";
    chess_container.style.display = "flex";
    document.querySelector("body").classList.add("body");

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

      socket.emit("move", data.data._id, move);

      // Check game-over conditions
      if (chess.in_checkmate()) {
        const winner = chess.turn() === "w" ? "Black" : "White";
        alert(`${winner} wins by checkmate!`);
        socket.emit("gameOver", { winner, gameId: data.data._id });
      } else if (
        chess.in_stalemate() ||
        chess.in_draw() ||
        chess.insufficient_material()
      ) {
        alert("Game is a draw!");
        socket.emit("gameOver", { winner: null, gameId: data.data._id });
      }

      renderBoard();
    } else {
      alert("Invalid move! Try again.");
    }
  };

  const getPieceUnicode = (piece) => {
    const unicodePieces = {
      p: "♙",
      r: "♜",
      n: "♞",
      b: "♝",
      q: "♛",
      k: "♚", // Black pieces
      P: "♙",
      R: "♖",
      N: "♘",
      B: "♗",
      Q: "♕",
      K: "♔", // White pieces
    };
    return unicodePieces[piece.type] || "";
  };

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
  socket.on("sendRecording", (game_id, type) => {
    window.location.href = `/game/${game_id}?type=${type}`;
  });
  // Initial board render
  renderBoard();
});
