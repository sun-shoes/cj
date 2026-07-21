import {
  AnimatedSprite,
  Application,
  Assets,
  Container,
  ContainerChild,
  Sprite,
  Text,
  Texture,
  Ticker,
} from "pixi.js";
import { Sound, sound } from "@pixi/sound";

// clonkjam screen dimensions
const SCREEN_WIDTH = 240;
const SCREEN_HEIGHT = 160;

declare global {
  interface Window {
    enemyDirection: number;
  }
  interface Window {
    restart: (arg: number) => void;
  }
  interface Window {
    triggerRestart: (arg: number) => void;
  }
  interface Window {
    timeSoFar: number;
  }
  interface Window {
    timeSinceEnemyDeath: number;
  }
  interface Window {
    bulletGroup: Container;
  }
  interface Window {
    enemyContainer: Container;
  }
  interface Window {
    enemies: Array<Sprite>;
  }
  interface Window {
    enemyBulletGroup: Container;
  }
  interface Window {
    enemyBulletSpeed: number;
  }
  interface Window {
    music: Sound;
  }
  interface Window {
    bullets: Array<Sprite>;
  }
  interface Window {
    animations: Record<string, Texture[]>;
  }
  interface Window {
    scatterRemaining: number;
  }
  interface Window {
    shakePolarity: number;
  }
  interface Window {
    shakeRate: number;
  }
  interface Window {
    difficulty: number;
  }
  interface Window {
    player: Sprite;
  }
}

interface NumberKeyObject {
  [key: number]: EnemyStat;
}

interface BoundLikeObject {
  x: number;
  y: number;
}

interface EnemyStat {
  alias: string;
  health: number;
  fireRate: number;
}

interface GameState {
  bulletGroup: Container;
  time: Ticker;
  timeSoFar: number;
  timeSinceEnemyDeath: number;
  enemyContainer: Container;
  enemies: Array<ContainerChild>;
  enemyBulletGroup: Container;
  scatterRemaining: number;
  player: Sprite;
  music: Sound;
  animations: Record<string, Texture[]>;
}

// for debugging restart
window.triggerRestart = (difficulty: number) => {
  if (!difficulty) {
    difficulty = 21;
  }

  window.postMessage({ op: "start", difficulty: difficulty });
};

const restart = () => {
  console.log("restarting");
  window.shakePolarity = 1;
  window.shakeRate = 2;

  app.stage.children.forEach((object) => {
    app.stage.removeChild(object);
    object.destroy();
  });

  const background = Sprite.from("background");
  app.stage.addChild(background);
  // need to be globally available, but init after setup
  window.animations = Assets.cache.get("explosion").animations;
  window.enemyContainer = new Container({ label: "enemy" });
  app.stage.addChild(window.enemyContainer);

  window.bulletGroup = new Container({ label: "bullet" });
  app.stage.addChild(window.bulletGroup);

  window.enemyBulletGroup = new Container({ label: "enemy_bullet" });
  app.stage.addChild(window.enemyBulletGroup);

  stillPlaying = true;
  window.enemies = [];

  // x direction: 1 moves right, -1 moves left
  window.enemyDirection = -1;
  window.timeSoFar = 0;
  window.timeSinceEnemyDeath = 0;
  window.scatterRemaining = 2;
  window.player = spawnPlayer();
  sound.removeAll();
  startMusic();
  definePlayerBehavioir();
  currentPlayerDamage = 0;
  currentKills = 0;
  renderUI(); // -> ready()
  spawnEnemy(app, "enemy1", window.enemies);
};

window.restart = restart;

// clonkjam events
function ready() {
  window.addEventListener("message", (ev) => {
    switch (ev.data.op) {
      case "start":
        if (ev.data.difficulty !== undefined && ev.data.difficulty !== null) {
          window.difficulty = ev.data.difficulty;
        }
        if (!stillPlaying) {
          restart();
        }
        window.parent.postMessage({ op: "started", verb: "shoot!" });
        break;
      default:
        console.log(`unknown event: ${ev}`);
        break;
    }
  });
  window.parent.postMessage({ op: "ready" });
  return window.difficulty || 0;
}

function endGame(win: boolean) {
  const path = win ? "public/assets/success.wav" : "public/assets/failure.wav";
  const outcomeSound = Sound.from(path);
  outcomeSound.play({ volume: 0.25 });

  setTimeout(() => {
    outcomeSound.destroy();
    sound.removeAll();
    window.parent.postMessage({ op: "done", win: win });
  }, 3500);
}

function checkCollision(
  sprite1: Sprite | ContainerChild,
  sprite2: Sprite | ContainerChild,
) {
  if (sprite1.destroyed || sprite2.destroyed) {
    return false;
  }
  // get the bounding rectangles of both sprites
  const bounds1 = sprite1.getBounds();
  const bounds2 = sprite2.getBounds();

  // check if rectangles overlap
  return (
    bounds1.x < bounds2.x + bounds2.width &&
    bounds1.x + bounds1.width > bounds2.x &&
    bounds1.y < bounds2.y + bounds2.height &&
    bounds1.y + bounds1.height > bounds2.y
  );
}

function spawnEnemy(app: Application, alias: string, enemies: Sprite[]) {
  const enemy = Sprite.from(alias);
  enemy.anchor = 0.5;
  enemy.scale.set(0.075);
  enemy.x = Math.floor(Math.random() * app.stage.width);
  enemy.y = -enemy.height * Math.random();
  enemy.rotation = Math.PI;

  window.enemyContainer.addChild(enemy);
  enemies.push(enemy);
}

function enemyShoot(
  enemy: Sprite,
  bulletType: string,
  group: Container,
  tint: boolean,
) {
  if (!enemy.destroyed) {
    const bullet = Sprite.from(bulletType);
    if (tint) {
      bullet.tint = "#ff1362";
    }
    group.addChild(bullet);
    bullet.anchor.set(0.5, 0.5);
    bullet.scale.set(0.075);
    bullet.rotation = Math.PI;
    bullet.x = enemy.x;
    bullet.y = enemy.y + enemy.height / 4;
  }
}

function death() {
  const death = Sound.from("public/assets/explosion2.wav");
  death.play({ volume: 3 });
}

function explode(
  animation: Record<string, Texture[]>,
  app: Application,
  bounds: BoundLikeObject,
) {
  const explosion = new AnimatedSprite(animation["explosion"]);
  explosion.animationSpeed = 0.16;
  explosion.loop = false;
  explosion.position.set(bounds.x, bounds.y);
  explosion.play();

  app.stage.addChild(explosion);

  setTimeout(() => {
    explosion.destroy();
  }, 500);
}

function startCooldown(type: number, cooldown: number) {
  if (type == 1) {
    playerOnCooldown = true;
  } else {
    enemyOnCooldown = true;
  }
  setTimeout(() => {
    if (type == 1) {
      playerOnCooldown = false;
    } else {
      enemyOnCooldown = false;
    }
  }, cooldown);
}

function drawLives(app: Application, totalLives: number, alias: string) {
  let livesDrawn = 0;

  while (livesDrawn < totalLives) {
    const playerLife = Sprite.from(alias);
    playerLife.anchor = 0.5;
    playerLife.x = 10 + 15 * livesDrawn;
    playerLife.y = 10;
    playerLife.width = 12.5;
    playerLife.height = 12.5;
    playerLife.label = `live${livesDrawn + 1}`;

    app.stage.addChild(playerLife);

    livesDrawn++;
  }
}

function spawnPlayer() {
  const player = Sprite.from("player");
  player.anchor.set(0.5);
  player.scale.set(0.05);
  player.position.set(app.screen.width / 2, app.screen.height - player.height);

  app.stage.addChild(player);
  return player;
}

function definePlayerBehavioir() {
  // fire bullets
  app.stage.onclick = (event) => {
    if (stillPlaying && !playerOnCooldown) {
      startCooldown(1, playerCooldown);
      const pos = event.global;
      const bullet = Sprite.from("bullet");
      bullet.anchor.set(0.5);
      bullet.scale.set(0.075);
      bullet.x = pos.x;
      bullet.y = pos.y - window.player.height / 4;

      window.bulletGroup.addChild(bullet);
      const shoot = Sound.from("public/assets/shoot.wav");
      shoot.play({ volume: 0.1 });
    }
  };

  // move player
  app.stage.interactive = true;
  app.renderer.events.cursorStyles.default = "none";
  app.stage.on("pointermove", (event) => {
    if (!window.player.destroyed && stillPlaying) {
      const width = window.player.width / 2;
      const height = window.player.height / 2;
      const pos = event.global;
      if (pos.x <= SCREEN_WIDTH - width && pos.x >= width) {
        window.player.x = pos.x;
      }
      if (pos.y <= SCREEN_HEIGHT - height && pos.y >= height) {
        window.player.y = pos.y;
      }
    }
  });
}

function enemyHorizontalMovement(enemy: ContainerChild) {
  const currentDirection = window.enemyDirection;
  let newDirection = currentDirection;
  // on right side, moving right
  if (enemy.x >= app.screen.width - enemy.width / 2 && currentDirection == 1) {
    newDirection = -1;
    // on right side, moving left
  } else if (enemy.x >= app.screen.width && currentDirection == -1) {
    newDirection = -1;
    // on left side, moving right
  } else if (enemy.x <= app.screen.width && currentDirection == 1) {
    newDirection = 1;
    // on left side, moving left
  } else if (enemy.x <= 15 && currentDirection == -1) {
    newDirection = 1;
  }
  enemy.x += newDirection;
  return newDirection;
}

// Calls ready()
function renderUI() {
  const enemyLife1 = Sprite.from("wave");
  enemyLife1.anchor = 0.5;
  enemyLife1.x = SCREEN_WIDTH - 10;
  enemyLife1.y = 10;
  enemyLife1.width = 12.5;
  enemyLife1.height = 12.5;
  enemyLife1.label = "enemyLife1";

  const enemyLife2 = Sprite.from("wave");
  enemyLife2.anchor = 0.5;
  enemyLife2.x = SCREEN_WIDTH - 25;
  enemyLife2.y = 10;
  enemyLife2.width = 12.5;
  enemyLife2.height = 12.5;
  enemyLife2.label = "enemyLife2";

  const enemyLife3 = Sprite.from("wave");
  enemyLife3.anchor = 0.5;
  enemyLife3.x = SCREEN_WIDTH - 40;
  enemyLife3.y = 10;
  enemyLife3.width = 12.5;
  enemyLife3.height = 12.5;
  enemyLife3.label = "enemyLife3";

  app.stage.addChild(enemyLife1);
  app.stage.addChild(enemyLife2);
  app.stage.addChild(enemyLife3);

  // manage difficulty
  const difficulty = ready();
  const rank = determineRank(difficulty);
  switch (true) {
    case difficulty > 0 && difficulty < 10:
      lives = 3;
      break;
    case difficulty >= 10 && difficulty < 20:
      lives = 3;
      enemyBulletSpeed = 15;
      break;
    case difficulty >= 20 && difficulty < 30:
      enemyBulletSpeed = 17.5;
      lives = 2;
      break;
    case difficulty >= 30:
      enemyBulletSpeed = 17.5;
      lives = 1;
      break;
    default:
      break;
  }

  drawLives(app, lives, "life");

  const danger = new Text({
    text: `Rank:${rank}`,
    style: {
      fontSize: 10,
      fontFamily: "bungeespice",
    },
    anchor: 0.5,
  });
  danger.y = SCREEN_HEIGHT - danger.height;
  danger.x = danger.width / 2 + 5;
  app.stage.addChild(danger);
}

function startMusic() {
  sound.removeAll();
  if (window.music) {
    window.music.stop();
    window.music.destroy();
  }
  window.music = Sound.from("public/assets/loop1.wav");
  window.music.play({ loop: true, volume: 0.25 });
}

function renderOutcomeText(text: string) {
  const outcomeText = new Text({
    text: text,
    style: {
      fill: "#ffffff",
      fontSize: 36,
      fontFamily: "silkscreen",
    },
    anchor: 0.5,
  });

  outcomeText.x = app.screen.width / 2;
  outcomeText.y = app.screen.height / 2;
  outcomeText.label = "outcome";

  outcome = outcomeText;
  return outcome;
}

function takeDamage(player: Sprite, animations: Record<string, Texture[]>) {
  const playerBounds = player.getBounds();
  const bounds = { x: playerBounds.x, y: playerBounds.y };
  currentPlayerDamage++;

  const playerLife1 = app.stage.getChildByLabel("live1");
  const playerLife2 = app.stage.getChildByLabel("live2");
  const playerLife3 = app.stage.getChildByLabel("live3");

  // player losing life
  if (playerLife3 !== null && !playerLife3.destroyed) {
    playerLife3.destroy();
    const hit = Sound.from("public/assets/pain_jack_02.wav");
    hit.play({ volume: 1 });
  } else if (playerLife2 !== null && !playerLife2.destroyed) {
    playerLife2.destroy();
    const hit = Sound.from("public/assets/pain_jack_03.wav");
    hit.play({ volume: 1 });
  } else if (playerLife1 !== null) {
    const hit = Sound.from("public/assets/pain_jack_01.wav");
    hit.play({ volume: 1 });
    playerLife1.destroy();
  }

  // player death
  if (currentPlayerDamage >= lives) {
    player.destroy();
    death();
    explode(animations, app, bounds);
    window.music.stop();
    sound.removeAll();
    endGame(false);
    renderOutcomeText("YOU LOSE!");
    // Debug testing restart after game over
    // setTimeout(() => {
    //   window.triggerRestart(window.difficulty + 10)
    // }, 5000);
    stillPlaying = false;
  }
}

function gameLogic(state: GameState) {
  const { animations, player, time } = state;

  const enemyStats: NumberKeyObject = {
    1: {
      alias: "enemy",
      health: 2,
      fireRate: 2500,
    },
    2: {
      alias: "enemy2",
      health: 4,
      fireRate: 2500,
    },
    3: {
      alias: "enemy3",
      health: 6,
      fireRate: 2500,
    },
  };

  // const bulletInfo: NumberKeyObject = {
  //   1: {
  //     alias: "bullet",
  //     behavior: "normal",
  //     speed: 1,
  //   },
  //   2: {
  //     alias: "bullet1",
  //     behavior: "scatter",
  //     speed: 1,
  //   },
  //   3: {
  //     alias: "bullet2",
  //     behavior: "grow",
  //     speed: 1,
  //   },
  // };
  const bullets = window.bulletGroup.children;

  // timeSoFar += time.elapsedMS;
  window.timeSoFar = (window.timeSoFar || 0) + time.elapsedMS;

  const enemyMarker1 = app.stage.getChildByLabel("enemyLife1");
  const enemyMarker2 = app.stage.getChildByLabel("enemyLife2");
  const enemyMarker3 = app.stage.getChildByLabel("enemyLife3");

  let shakePolarityChanged = false;
  if (currentPlayerDamage == lives - 1) {
    const playerLife1 = app.stage.getChildByLabel("live1");
    if (window.shakeRate % 30 == 0 && playerLife1) {
      window.shakePolarity *= -1;
      shakePolarityChanged = true;
      playerLife1.rotation = 0.5 * window.shakePolarity * time.deltaTime;
      playerLife1.x = playerLife1.x + window.shakePolarity * 2;
    }
  }

  if (currentKills == 2) {
    const enemyLife1 = app.stage.getChildByLabel("enemyLife1");
    if (window.shakeRate % 30 == 0 && enemyLife1) {
      if (!shakePolarityChanged) {
        window.shakePolarity *= -1;
      }
      enemyLife1.y = enemyLife1.y + window.shakePolarity * 2;
    }
  }

  if (
    window.timeSinceEnemyDeath != 0 &&
    window.timeSoFar - window.timeSinceEnemyDeath > 1500
  ) {
    const sprite = ["enemy1", "enemy2", "enemy3"][currentKills];
    currentEnemyHealth = enemyStats[currentKills].health;
    spawnEnemy(app, sprite, window.enemies);
    window.timeSinceEnemyDeath = 0;
  }

  if (
    !enemyOnCooldown &&
    window.enemies[0] !== undefined &&
    !window.enemies[0].destroyed &&
    window.enemies[0].y > 0
  ) {
    startCooldown(2, enemyCooldown);
    const bulletType = ["bullet", "bullet1", "bullet2"][currentKills];
    if (window.enemies[0] !== undefined) {
      enemyShoot(
        window.enemies[0] as Sprite,
        bulletType,
        window.enemyBulletGroup,
        bulletType == "bullet",
      );
    }
    let sound = "sound1";
    if (currentKills == 1) {
      sound = "enemyShoot1";
    } else {
      sound = "enemyShoot";
    }
    const shoot = Sound.from(`public/assets/${sound}.wav`);
    let volume = 0.1;
    if (sound == "enemyShoot1") {
      volume = 0.25;
    }
    shoot.play({ volume: volume });
  }

  // enemy movement
  const currentEnemy = window.enemies[0];
  // ignore if enemy was just destroyed
  if (currentEnemy !== undefined && !currentEnemy.destroyed) {
    if (currentEnemy.y < 25) {
      currentEnemy.y += 1;
    } else {
      window.enemyDirection = enemyHorizontalMovement(currentEnemy);
    }
    if (checkCollision(currentEnemy, player)) {
      takeDamage(player, animations);
    }
  }

  // player bullets
  for (let index = 0; index < bullets.length; index++) {
    const activePlayerBullet = bullets[index];
    activePlayerBullet.y -= bulletSpeed * time.deltaTime;

    const bulletCoords = activePlayerBullet.getBounds();

    // cleanup player bullets that OOB
    if (bulletCoords.y < -(activePlayerBullet.height / 2)) {
      activePlayerBullet.destroy();
    }

    // player bullets hitting enemy
    if (window.enemyContainer.children.length > 0) {
      const enemy = window.enemyContainer.getChildAt(0);
      if (enemy !== undefined && checkCollision(activePlayerBullet, enemy)) {
        currentEnemyHealth--;
        activePlayerBullet.destroy();

        if (currentEnemyHealth <= 0) {
          const enemyBounds = enemy.getBounds();
          const bounds = { x: enemyBounds.x, y: enemyBounds.y };
          enemy.destroy();
          death();
          explode(animations, app, bounds);
          if (enemyMarker3 !== null) {
            enemyMarker3.destroy();
          } else if (enemyMarker2 !== null) {
            enemyMarker2.destroy();
          } else if (enemyMarker1 !== null) {
            enemyMarker1.destroy();
          }

          // remove from array
          window.enemies = window.enemies.filter(
            (destroyedEnemy) => destroyedEnemy !== enemy,
          );

          currentKills++;
          window.timeSinceEnemyDeath = window.timeSoFar;
          if (currentKills == winCondition) {
            window.music.stop();
            sound.removeAll();
            endGame(true);
            renderOutcomeText("YOU WIN!");
            stillPlaying = false;
            // Debug testing restart after game over
            // setTimeout(() => {
            //   window.triggerRestart(window.difficulty + 10)
            // }, 5000);
          }
        } else {
          // enemy take damage sfx
          const hit = Sound.from("public/assets/hit.wav");
          hit.play({ volume: 3 });
        }
      }
    }
  }

  // enemy bullets
  for (
    let index = 0;
    index < window.enemyBulletGroup.children.length;
    index++
  ) {
    const activeEnemyBullet: Sprite = window.enemyBulletGroup.getChildAt(index);
    activeEnemyBullet.y += enemyBulletSpeed * time.deltaTime * 0.1;

    if (activeEnemyBullet.texture == Sprite.from("bullet2").texture) {
      if (activeEnemyBullet.label == "right") {
        activeEnemyBullet.rotation += -0.5 * time.deltaTime;
      } else {
        activeEnemyBullet.rotation += 0.5 * time.deltaTime;
      }
      if (
        activeEnemyBullet.getBounds().y >= SCREEN_HEIGHT / 2 &&
        activeEnemyBullet.getBounds().y <= SCREEN_HEIGHT / 2 + 5
      ) {
        // spawn two additional bullets of same type that spread-out
        if (
          window.scatterRemaining > 0 &&
          activeEnemyBullet.label !== "right"
        ) {
          const bullet = new Sprite(activeEnemyBullet.texture);
          window.enemyBulletGroup.addChild(bullet);
          const shoot = Sound.from(`public/assets/enemyShoot.wav`);
          shoot.play({ volume: 0.1 });
          window.scatterRemaining--;

          bullet.anchor.set(0.5);
          bullet.scale.set(0.075);
          if (window.scatterRemaining > 0) {
            bullet.x = activeEnemyBullet.getBounds().x + bullet.width / 3;
            bullet.rotation = -Math.PI / 2;
            bullet.label = "right";
            bullet.alpha = 0.5;
          } else {
            bullet.rotation = Math.PI / 2;
            bullet.label = "left";
            bullet.alpha = 0.5;
            bullet.x = activeEnemyBullet.getBounds().x - bullet.width / 3;
          }
          bullet.y = activeEnemyBullet.getBounds().y;
        }
      }

      const lefts = window.enemyBulletGroup.getChildrenByLabel("left");
      const rights = window.enemyBulletGroup.getChildrenByLabel("right");

      let scatterSpeed = 0.05;
      if (window.difficulty > 20) {
        scatterSpeed += 0.1;
      }
      for (const b of lefts) {
        b.x -= scatterSpeed * time.deltaTime;
      }
      for (const b of rights) {
        b.x += scatterSpeed * time.deltaTime;
      }
    } else if (activeEnemyBullet.texture == Sprite.from("bullet1").texture) {
      activeEnemyBullet.width += 0.2 * time.deltaTime;
      activeEnemyBullet.height += 0.2 * time.deltaTime;
    }

    if (player !== undefined && checkCollision(activeEnemyBullet, player)) {
      activeEnemyBullet.destroy();
      takeDamage(player, animations);
    }

    // cleanup enemy bullets that go OOB
    if (!activeEnemyBullet.destroyed) {
      const bulletCoords = activeEnemyBullet.getBounds();
      if (bulletCoords.y > app.screen.height) {
        if (activeEnemyBullet.texture == Sprite.from("bullet2").texture) {
          // reset scatter shot
          window.scatterRemaining = 2;
        }
        activeEnemyBullet.destroy();
      }
    }
  }
}

function determineRank(difficulty: number) {
  const rankings = ["C", "B", "A", "S"];
  const index = Math.round(difficulty / 10);
  return rankings[Math.min(index, 3)];
}

let currentKills = 0;
const winCondition = 3;
let stillPlaying = true;
let currentEnemyHealth = 0;
let currentPlayerDamage = 0;
const playerCooldown = 250;
let playerOnCooldown = false;
const enemyCooldown = 500;
let enemyOnCooldown = false;
const bulletSpeed = 10;
// variables controlled by difficulty
let enemyBulletSpeed = 10;
let lives = 3;
let outcome = new Text();

const app = new Application();

// define/reset constant values.
async function setup() {
  await app.init({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    background: "#1e1e1f",
  });

  document.getElementById("pixi-container")!.appendChild(app.canvas);
  const background = Sprite.from("background");
  app.stage.addChild(background);
}

async function preload() {
  const assets = [
    { alias: "background", src: "/assets/bg.png" },
    { alias: "player", src: "/assets/player.png" },
    { alias: "bullet", src: "/assets/bullet.png" },
    { alias: "bullet1", src: "/assets/enemy-bullet-1.png" },
    { alias: "bullet2", src: "/assets/enemy-bullet-2.png" },
    { alias: "enemy1", src: "/assets/enemy.png" },
    { alias: "enemy2", src: "/assets/enemy2.png" },
    { alias: "enemy3", src: "/assets/enemy3.png" },
    { alias: "life", src: "/assets/mrgreen.png" },
    { alias: "wave", src: "/assets/mrred.png" },
    { alias: "explosion", src: "/assets/explosion.json" },
    {
      alias: "silkscreen",
      src: "/assets/silkscreen_regular.ttf",
      data: { family: "silkscreen" },
    },
    {
      alias: "bungeespice",
      src: "/assets/bungeespice.ttf",
      data: { family: "bungeespice" },
    },
  ];

  await Assets.load(assets);
}

(async () => {
  await preload();
  await setup();

  // need to be globally available, but init after setup
  const animations = Assets.cache.get("explosion").animations;
  const enemyContainer = new Container({ label: "enemy" });
  window.shakePolarity = 1;
  window.shakeRate = 2;

  window.enemyContainer = enemyContainer;
  app.stage.addChild(enemyContainer);

  const bulletGroup = new Container({ label: "bullet" });
  window.bulletGroup = bulletGroup;
  app.stage.addChild(bulletGroup);

  const enemyBulletGroup = new Container({ label: "enemy_bullet" });
  window.enemyBulletGroup = enemyBulletGroup;
  app.stage.addChild(enemyBulletGroup);

  stillPlaying = true;
  const enemies: Sprite[] = [];
  window.enemies = enemies;
  window.enemyDirection = 1;
  window.timeSoFar = 0;
  window.timeSinceEnemyDeath = 0;
  window.scatterRemaining = 2;

  window.player = spawnPlayer();
  startMusic();
  definePlayerBehavioir();

  renderUI();
  setTimeout(() => {
    spawnEnemy(app, "enemy1", window.enemies);
  }, 1000);

  app.ticker.add((time) => {
    window.shakeRate += 1;

    const state: GameState = {
      bulletGroup: bulletGroup,
      time: time,
      timeSoFar: window.timeSoFar,
      timeSinceEnemyDeath: window.timeSinceEnemyDeath,
      enemyContainer: enemyContainer,
      enemies: enemies,
      enemyBulletGroup: enemyBulletGroup,
      scatterRemaining: window.scatterRemaining,
      player: window.player,
      music: window.music,
      animations: animations,
    };

    if (stillPlaying) {
      gameLogic(state);
      if (app.stage.getChildByLabel("outcome") !== undefined) {
        app.stage.removeChild(outcome);
      }
    } else {
      app.stage.addChild(outcome);
    }
  });
})();
