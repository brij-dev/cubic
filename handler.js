CubeSolver = function() {
  this.phase = 0;
  this.currentState = null;
  this.goalState = null;
};

CubeSolver.prototype.applyMove = function(move, inState) {
  var affectedCubies = [
    [0, 1, 2, 3, 0, 1, 2, 3],
    [4, 7, 6, 5, 4, 5, 6, 7],
    [0, 9, 4, 8, 0, 3, 5, 4],
    [2, 10, 6, 11, 2, 1, 7, 6],
    [3, 11, 7, 9, 3, 2, 6, 5],
    [1, 8, 5, 10, 1, 0, 4, 7]
  ];
  var turns = (move % 3) + 1;
  var face = Math.floor(move / 3);
  var state = inState.slice();
  while (turns-- > 0) {
    var oldState = state.slice();
    for (var i = 0; i < 8; i++) {
      var isCorner = i > 3;
      var target = affectedCubies[face][i] + isCorner * 12;
      var killer =
        affectedCubies[face][(i & 3) == 3 ? i - 3 : i + 1] + isCorner * 12;
      var orientationDelta =
        i < 4 ? face > 1 && face < 4 : face < 2 ? 0 : 2 - (i & 1);
      state[target] = oldState[killer];
      state[target + 20] = oldState[killer + 20] + orientationDelta;
      if (turns == 0) state[target + 20] %= 2 + isCorner;
    }
  }
  return state;
};

CubeSolver.prototype.inverse = function(move) {
  return move + 2 - 2 * (move % 3);
};

CubeSolver.prototype.getId = function(state) {
  if (this.phase < 2) return JSON.stringify(state.slice(20, 32));

  if (this.phase < 3) {
    var result = state.slice(31, 40);
    for (var e = 0; e < 12; e++) result[0] |= Math.floor(state[e] / 8) << e;
    return JSON.stringify(result);
  }

  if (this.phase < 4) {
    var result = [0, 0, 0];
    for (var e = 0; e < 12; e++)
      result[0] |= (state[e] > 7 ? 2 : state[e] & 1) << (2 * e);
    for (var c = 0; c < 8; c++)
      result[1] |= ((state[c + 12] - 12) & 5) << (3 * c);
    for (var i = 12; i < 20; i++)
      for (var j = i + 1; j < 20; j++) result[2] ^= state[i] > state[j];
    return JSON.stringify(result);
  }

  return JSON.stringify(state);
};

CubeSolver.prototype.setState = function(cube) {
  cube = cube.split(" ");
  if (cube.length != 20) {
    this.currentState = "Not enough cubies provided";
    return false;
  }

  var goal = [
    "UF",
    "UR",
    "UB",
    "UL",
    "DF",
    "DR",
    "DB",
    "DL",
    "FR",
    "FL",
    "BR",
    "BL",
    "UFR",
    "URB",
    "UBL",
    "ULF",
    "DRF",
    "DFL",
    "DLB",
    "DBR"
  ];
  this.currentState = new Array(40);
  this.goalState = new Array(40);
  for (var i = 0; i < 40; i++) {
    this.currentState[i] = 0;
    this.goalState[i] = 0;
  }
  for (var i = 0; i < 20; i++) {
    this.goalState[i] = i;

    var cubie = cube[i];
    while ((this.currentState[i] = goal.indexOf(cubie)) == -1) {
      cubie = cubie.substr(1) + cubie[0];
      this.currentState[i + 20]++;
      if (this.currentState[i + 20] > 2) {
        this.currentState = "Cannot solve: Invalid painting of cube.";
        return false;
      }
    }
    goal[goal.indexOf(cubie)] = "";
  }
  return this.verifyState();
};

CubeSolver.prototype.verifyState = function() {
  if (!Array.isArray(this.currentState)) return false;

  var sum = 0;
  this.currentState.slice(20, 32).forEach(function(edge) {
    sum += edge;
  });
  if (sum % 2 != 0) {
    this.currentState = "Cannot solve: Edges not oriented correctly.";
    return false;
  }
  sum = 0;
  this.currentState.slice(32, 40).forEach(function(edge) {
    sum += edge;
  });
  if (sum % 3 != 0) {
    this.currentState = "Cannot solve: Corners not oriented correctly";
    return false;
  }

  var getParity = function(a) {
    var count = 0;
    for (var i = 0; i < a.length; i++) {
      for (var j = 0; j < i; j++) {
        if (a[j] > a[i]) {
          count++;
          var temp = a[i];
          a[i] = a[j];
          a[j] = temp;
        }
      }
    }
    return count;
  };
  sum = 0;
  sum += getParity(this.currentState.slice(0, 12));
  sum += getParity(this.currentState.slice(12, 20));
  if (sum % 2 != 0) {
    this.currentState =
      "Cannot solve: Parity error only one set of corners or edges swapped.";
    return false;
  }

  return true;
};

CubeSolver.prototype.solve = function(cube) {
  this.solution = "";
  this.phase = 0;

  if (cube) {
    if (!this.setState(cube)) return false;
  } else if (!this.verifyState()) return false;

  while (++this.phase < 5) {
    this.startPhase();
  }
  this.prepareSolution();
  return this.solution;
};

CubeSolver.prototype.solveAsync = function(cube, callback, progress) {
  this.solution = "";
  this.phase = 1;
  if (cube) {
    if (!this.setState(cube)) {
      callback(false);
      return;
    }
  } else if (!this.verifyState()) {
    callback(false);
    return;
  }

  var nextPhase = function() {
    if (this.phase < 5) {
      this.startPhase();
      progress && progress(this.phase / 5);
      this.phase++;
      setTimeout(nextPhase.bind(this), 0);
    } else {
      progress && progress(1);
      this.prepareSolution();
      callback(this.solution);
    }
  };

  nextPhase.bind(this)();
};

CubeSolver.prototype.startPhase = function() {
  var currentId = this.getId(this.currentState),
    goalId = this.getId(this.goalState);
  if (currentId == goalId) return;

  var q = [];
  q.push(this.currentState);
  q.push(this.goalState);

  var predecessor = {};
  var direction = {},
    lastMove = {};
  direction[currentId] = 1;
  direction[goalId] = 2;

  while (1) {
    var oldState = q.shift();
    var oldId = this.getId(oldState);
    var oldDir = direction[oldId];

    var applicableMoves = [0, 262143, 259263, 74943, 74898];
    for (var move = 0; move < 18; move++) {
      if (applicableMoves[this.phase] & (1 << move)) {
        var newState = this.applyMove(move, oldState);
        var newId = this.getId(newState);
        var newDir = direction[newId];

        if (newDir && newDir != oldDir) {
          if (oldDir > 1) {
            var temp = newId;
            var newId = oldId;
            var oldId = temp;
            move = this.inverse(move);
          }

          var algorithm = [move];
          while (oldId != currentId) {
            algorithm.unshift(lastMove[oldId]);
            oldId = predecessor[oldId];
          }
          while (newId != goalId) {
            algorithm.push(this.inverse(lastMove[newId]));
            newId = predecessor[newId];
          }

          for (var i = 0; i < algorithm.length; i++) {
            for (var j = 0; j < (algorithm[i] % 3) + 1; j++)
              this.solution += "UDFBLR"[Math.floor(algorithm[i] / 3)];
            this.currentState = this.applyMove(algorithm[i], this.currentState);
          }
          return;
        }

        if (!newDir) {
          q.push(newState);
          direction[newId] = direction[oldId];
          lastMove[newId] = move;
          predecessor[newId] = oldId;
        }
      }
    }
  }
};

CubeSolver.prototype.prepareSolution = function() {
  var moves = this.solution.match(/(\w)\1*/g);
  if (!moves) {
    this.solution = "";
    return;
  }
  var opposites = { F: "B", B: "F", T: "D", D: "T", R: "L", L: "R" };
  var result = "";
  for (var i = 0; i < moves.length - 2; i++) {
    if (
      moves[i][0] == moves[i + 2][0] &&
      opposites[moves[i + 1][0]] == moves[i][0]
    ) {
      temp = moves[i + 2];
      moves[i + 2] = moves[i + 1];
      moves[i + 1] = temp;
      i = 0;
    }
  }
  moves = moves.join("").match(/(\w)\1*/g);
  moves.forEach(function(move) {
    if (move.length % 4 == 1) result += move[0];
    else if (move.length % 4 == 2) result += move[0] + "2";
    else if (move.length % 4 == 3) result += move[0] + "'";
    else if (move.length % 4 == 0) return;
    result += " ";
  });
  this.solution = result.trim();
};
