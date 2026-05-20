/**
 * Optimized Flappy Bird Engine - Pure HTML5 Canvas & Javascript
 * Featuring Delta-Time Physics, Web Audio Synth, and Parallax Backgrounds
 */

// --- 8-BIT RETRO SYNTHESIZER (Web Audio API) ---
class GameAudio {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, startGain, endGain, time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(startGain, time);
    gain.gain.exponentialRampToValueAtTime(endGain, time + duration);
    
    osc.start(time);
    osc.stop(time + duration);
    return { osc, gain };
  }

  playJump() {
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);
    
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playScore() {
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    // Beautiful vintage golden-ratio chime
    this.playTone(523.25, 'square', 0.08, 0.06, 0.001, now); // C5
    this.playTone(659.25, 'square', 0.14, 0.06, 0.001, now + 0.08); // E5
  }

  playHit() {
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    
    // 1. Low Pitch Downward Slide
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.35);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.36);
    
    // 2. Synthesized Noise Burst for Impact
    const bufferSize = this.ctx.sampleRate * 0.18; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.18);
    
    const noiseGain = this.ctx.createGain();
    
    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.18);
  }

  playMedal() {
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    // Short celebration retro arpeggio
    const chord = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4 -> E4 -> G4 -> C5 -> E5
    chord.forEach((freq, i) => {
      this.playTone(freq, 'triangle', 0.15, 0.08, 0.01, now + i * 0.08);
    });
  }
}

const audio = new GameAudio();

// --- GAME DEFINITION ---
const STATES = {
  START: 0,
  PLAYING: 1,
  GAMEOVER: 2
};

const SKINS = {
  classic: {
    name: 'Cyber Classic',
    primary: '#00f2fe',
    secondary: '#0072ff',
    wing: '#ffde17',
    beak: '#ff9900',
    eye: '#ffffff',
    glow: 'rgba(0, 242, 254, 0.8)',
    trail: '#00f2fe'
  },
  neon: {
    name: 'Neon Pink',
    primary: '#fd2678',
    secondary: '#9c27b0',
    wing: '#39ff14',
    beak: '#ff007f',
    eye: '#ffffff',
    glow: 'rgba(253, 38, 120, 0.8)',
    trail: '#fd2678'
  },
  gold: {
    name: 'Royal Gold',
    primary: '#ffde17',
    secondary: '#e65100',
    wing: '#ffffff',
    beak: '#ff3300',
    eye: '#000000',
    glow: 'rgba(255, 222, 23, 0.9)',
    trail: '#ffde17'
  }
};

class Bird {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 34;
    this.height = 24;
    this.x = 80;
    this.y = canvas.height / 2;
    
    // Physics constants (adjusted for Delta-time)
    this.gravity = 1450;       // Pixels per second^2
    this.jumpStrength = -420;  // Upward velocity
    this.velocity = 0;
    this.rotation = 0;
    this.targetRotation = 0;
    
    // Wing flapping animation
    this.flapTimer = 0;
    this.wingOffset = 0;
  }

  jump() {
    this.velocity = this.jumpStrength;
    this.targetRotation = -0.4; // Tilt up slightly
    audio.playJump();
  }

  update(dt, state) {
    if (state === STATES.PLAYING) {
      // Apply gravity
      this.velocity += this.gravity * dt;
      this.y += this.velocity * dt;
      
      // Control rotation based on velocity
      if (this.velocity > 150) {
        this.targetRotation = Math.min(Math.PI / 2, this.targetRotation + 5 * dt); // Nose dive
      } else if (this.velocity < 0) {
        this.targetRotation = -0.3; // Ascending tilt
      }
      
      // Flapping logic
      this.flapTimer += dt * 15;
      this.wingOffset = Math.sin(this.flapTimer) * 6;
    } else if (state === STATES.START) {
      // Floating animation on home screen
      this.y = (this.canvas.height / 2 - 20) + Math.sin(performance.now() / 200) * 12;
      this.wingOffset = Math.sin(performance.now() / 100) * 4;
      this.rotation = 0;
    }
    
    // Interpolate rotation for smooth transitions
    this.rotation += (this.targetRotation - this.rotation) * 12 * dt;
  }

  draw(ctx, skin) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    const config = SKINS[skin] || SKINS.classic;

    // Glowing aura
    ctx.shadowBlur = 15;
    ctx.shadowColor = config.glow;

    // Body Gradient
    const bodyGrad = ctx.createLinearGradient(-15, -10, 15, 10);
    bodyGrad.addColorStop(0, config.primary);
    bodyGrad.addColorStop(1, config.secondary);

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    // Rounded futuristic tear-drop shape
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow for details
    ctx.shadowBlur = 0;

    // Beak
    ctx.fillStyle = config.beak;
    ctx.beginPath();
    ctx.moveTo(11, -3);
    ctx.lineTo(21, 1);
    ctx.lineTo(11, 5);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = config.eye;
    ctx.beginPath();
    ctx.arc(6, -4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(7.5, -4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = config.wing;
    ctx.beginPath();
    ctx.ellipse(-5, 2 + this.wingOffset / 3, 9, 6 + Math.abs(this.wingOffset / 2), Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Wing highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }
}

class Pipe {
  constructor(canvas, xPos) {
    this.canvas = canvas;
    this.width = 62;
    this.gap = 135; // Size of gap between top/bottom pipes
    this.x = xPos;
    this.passed = false;
    
    const minHeight = 60;
    const maxHeight = canvas.height - 150 - this.gap - minHeight;
    this.topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
    this.bottomHeight = canvas.height - 120 - this.topHeight - this.gap;
  }

  update(dt, speed) {
    this.x -= speed * dt;
  }

  draw(ctx) {
    ctx.save();
    
    // 1. TOP PIPE
    this.drawSinglePipe(ctx, this.x, 0, this.width, this.topHeight, true);

    // 2. BOTTOM PIPE
    const bottomY = this.canvas.height - 120 - this.bottomHeight;
    this.drawSinglePipe(ctx, this.x, bottomY, this.width, this.bottomHeight, false);
    
    ctx.restore();
  }

  drawSinglePipe(ctx, x, y, width, height, isTop) {
    // Elegant Cyberpunk Pipe Design with gradient & neon border
    const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, '#151b33');
    gradient.addColorStop(0.3, '#2a3b66');
    gradient.addColorStop(0.7, '#1b2447');
    gradient.addColorStop(1, '#0e1224');

    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.45)';
    ctx.lineWidth = 2;

    // Main Pipe shaft
    ctx.beginPath();
    ctx.rect(x + 3, y, width - 6, height);
    ctx.fill();
    ctx.stroke();

    // Pipe Lip (rim at the edge)
    const lipHeight = 22;
    const lipX = x;
    const lipY = isTop ? (y + height - lipHeight) : y;
    
    const lipGrad = ctx.createLinearGradient(lipX, 0, lipX + width, 0);
    lipGrad.addColorStop(0, '#00f2fe');
    lipGrad.addColorStop(0.3, '#ffffff');
    lipGrad.addColorStop(0.7, '#00c6ff');
    lipGrad.addColorStop(1, '#0072ff');

    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(253, 38, 120, 0.6)'; // Pink accent for lips
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(lipX, lipY, width, lipHeight, 4);
    ctx.fill();
    ctx.stroke();

    // Inner neon energy glow line down the center
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + width / 2, isTop ? y : y + lipHeight);
    ctx.lineTo(x + width / 2, isTop ? y + height - lipHeight : y + height);
    ctx.stroke();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = -80 - Math.random() * 80;
    this.vy = (Math.random() * 2 - 1) * 40;
    this.size = Math.random() * 4 + 2;
    this.color = color;
    this.alpha = 1;
    this.decay = Math.random() * 1.5 + 1.2; // Opacity reduction rate
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.alpha = Math.max(0, this.alpha - this.decay * dt);
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.setupCanvas();
    
    this.state = STATES.START;
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('flappy_cyber_best') || '0', 10);
    this.selectedSkin = localStorage.getItem('flappy_cyber_skin') || 'classic';
    
    // Physics config
    this.speed = 135; // Pipe travel speed (pixels per second)
    this.pipes = [];
    this.particles = [];
    
    // Starfield Parallax layer
    this.stars = [];
    this.createStars();

    // Dynamic objects
    this.bird = new Bird(this.canvas);
    this.pipeSpawnTimer = 0;
    this.pipeSpawnInterval = 2.4; // Spawn an obstacle every 2.4 seconds

    // Multi-layer parallax scroll position
    this.cityScroll = 0;
    this.groundScroll = 0;

    // Viewport shake mechanics
    this.viewportElement = document.querySelector('.game-viewport');

    this.bindEvents();
    this.updateSkinsUI();
    this.updateBestBadge();
    
    // Initialize Game loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  setupCanvas() {
    // Fixed conceptual aspect ratio (400x600)
    this.canvas.width = 400;
    this.canvas.height = 600;
  }

  createStars() {
    this.stars = [];
    for (let i = 0; i < 40; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * (this.canvas.height - 150),
        size: Math.random() * 1.5 + 0.5,
        twinkleSpeed: Math.random() * 3 + 1,
        alpha: Math.random()
      });
    }
  }

  bindEvents() {
    const handleAction = () => {
      if (this.state === STATES.START) {
        this.startGame();
      } else if (this.state === STATES.PLAYING) {
        this.bird.jump();
      } else if (this.state === STATES.GAMEOVER) {
        // Can reload or click restart button
      }
    };

    // Global Key Bindings
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleAction();
      }
    });

    // Touch/Mouse bindings on Viewport
    this.canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      handleAction();
    });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleAction();
    }, { passive: false });

    // Buttons bindings
    document.getElementById('btn-play').addEventListener('click', (e) => {
      e.stopPropagation();
      this.startGame();
    });

    document.getElementById('btn-restart').addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetGame();
      this.startGame();
    });

    document.getElementById('btn-menu').addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetGame();
      this.state = STATES.START;
      document.getElementById('screen-gameover').classList.add('hidden');
      document.getElementById('screen-start').classList.remove('hidden');
    });

    // Skin Card Selector Bindings
    const cards = document.querySelectorAll('.skin-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedSkin = card.getAttribute('data-skin');
        localStorage.setItem('flappy_cyber_skin', this.selectedSkin);
        this.updateSkinsUI();
        
        // Short synth chime to confirm selection
        audio.playScore();
      });
    });
  }

  updateSkinsUI() {
    const cards = document.querySelectorAll('.skin-card');
    cards.forEach(card => {
      if (card.getAttribute('data-skin') === this.selectedSkin) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  updateBestBadge() {
    const badges = document.querySelectorAll('.best-val');
    badges.forEach(badge => {
      badge.textContent = this.bestScore;
    });
  }

  startGame() {
    audio.init();
    this.state = STATES.PLAYING;
    document.getElementById('screen-start').classList.add('hidden');
    document.getElementById('screen-gameover').classList.add('hidden');
    this.bird.jump();
  }

  resetGame() {
    this.bird = new Bird(this.canvas);
    this.pipes = [];
    this.particles = [];
    this.score = 0;
    this.pipeSpawnTimer = 0;
    document.getElementById('current-score').textContent = '0';
  }

  triggerScreenShake() {
    this.viewportElement.classList.remove('shake');
    void this.viewportElement.offsetWidth; // Force CSS reflow
    this.viewportElement.classList.add('shake');
  }

  gameOver() {
    this.state = STATES.GAMEOVER;
    audio.playHit();
    this.triggerScreenShake();

    // Check high scores
    let isNewBest = false;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('flappy_cyber_best', this.bestScore);
      this.updateBestBadge();
      isNewBest = true;
    }

    // Determine Medals
    const medalIcon = document.getElementById('medal-icon');
    const medalName = document.getElementById('medal-name');
    const medalDesc = document.getElementById('medal-desc');
    
    let medalColor = '';
    let medalTitle = 'No Medal';
    let medalCaption = 'Get 10 points to unlock!';
    
    if (this.score >= 40) {
      medalColor = '#00f2fe'; // Cyber Platinum Cyan
      medalTitle = 'Platinum Cyber';
      medalCaption = 'You are a legendary flyer!';
    } else if (this.score >= 20) {
      medalColor = '#ffde17'; // Neon Gold Yellow
      medalTitle = 'Neon Gold';
      medalCaption = 'Spectacular agility demonstrated.';
    } else if (this.score >= 10) {
      medalColor = '#e2e2e8'; // Quantum Silver
      medalTitle = 'Quantum Silver';
      medalCaption = 'A highly respected achievement!';
    }

    // Ensure the medal image display is turned on for all cases
    medalIcon.style.display = 'block';

    if (this.score >= 10) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${medalColor}">
        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="6" fill="rgba(255,255,255,0.25)"/>
        <path d="M12 6l1.5 3.5h3.5l-2.8 2.2 1.1 3.8-3.3-2.3-3.3 2.3 1.1-3.8-2.8-2.2h3.5z" fill="white" opacity="0.9"/>
      </svg>`;
      medalIcon.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      medalName.textContent = medalTitle;
      medalDesc.textContent = medalCaption;
      
      // Play extra celebratory melody
      setTimeout(() => audio.playMedal(), 400);
    } else {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(255,255,255,0.1)">
        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
        <path d="M12 8v8M8 12h8" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
      medalIcon.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      medalName.textContent = 'No Medal';
      medalDesc.textContent = medalCaption;
    }

    // Set stats text
    document.getElementById('final-score').textContent = this.score;
    document.getElementById('final-best').textContent = this.bestScore;
    
    const congrats = document.getElementById('congrats-text');
    if (isNewBest) {
      congrats.textContent = 'NEW RECORD! FANTASTIC!';
      congrats.style.color = 'var(--neon-yellow)';
    } else {
      congrats.textContent = 'GAME OVER';
      congrats.style.color = 'var(--neon-pink)';
    }

    // Reset congrats animation to bounce-in with full impact every time
    congrats.style.animation = 'none';
    void congrats.offsetHeight; // force reflow
    congrats.style.animation = '';

    // Show Overlay
    document.getElementById('screen-gameover').classList.remove('hidden');
  }

  loop(time) {
    let dt = (time - this.lastTime) / 1000; // time delta in seconds
    if (dt > 0.1) dt = 0.1; // clamp to prevent physics bugs during window tabs switching
    this.lastTime = time;

    this.update(dt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    // 1. Background elements Parallax updates
    if (this.state !== STATES.GAMEOVER) {
      // Stars twinkle
      this.stars.forEach(star => {
        star.alpha += Math.sin(performance.now() * 0.001 * star.twinkleSpeed) * 0.02;
        star.alpha = Math.max(0.1, Math.min(1, star.alpha));
      });

      // Scrolling city & ground
      this.cityScroll = (this.cityScroll + 12 * dt) % this.canvas.width;
      this.groundScroll = (this.groundScroll + this.speed * dt) % 24;
    }

    // 2. Bird updates
    this.bird.update(dt, this.state);

    if (this.state === STATES.PLAYING) {
      // Spawn trail particles behind the bird (increased density for a premium jet-trail feel)
      const config = SKINS[this.selectedSkin] || SKINS.classic;
      if (Math.random() < 0.6) {
        this.particles.push(new Particle(this.bird.x - 14, this.bird.y + (Math.random() * 6 - 3), config.trail));
      }

      // 3. Pipes Spawn/Update
      this.pipeSpawnTimer += dt;
      if (this.pipeSpawnTimer >= this.pipeSpawnInterval) {
        this.pipes.push(new Pipe(this.canvas, this.canvas.width + 50));
        this.pipeSpawnTimer = 0;
      }

      for (let i = this.pipes.length - 1; i >= 0; i--) {
        const pipe = this.pipes[i];
        pipe.update(dt, this.speed);

        // Check scoring threshold
        if (!pipe.passed && pipe.x + pipe.width / 2 < this.bird.x) {
          pipe.passed = true;
          this.score++;
          document.getElementById('current-score').textContent = this.score;
          audio.playScore();
        }

        // Collision Check
        if (this.checkCollision(this.bird, pipe)) {
          this.gameOver();
          break;
        }

        // Offscreen pruning
        if (pipe.x + pipe.width < -10) {
          this.pipes.splice(i, 1);
        }
      }

      // Check ceiling/floor collisions
      if (this.bird.y - 12 < 0 || this.bird.y + 12 > this.canvas.height - 120) {
        this.gameOver();
      }
    }

    // 4. Update Particle trail
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  checkCollision(bird, pipe) {
    // Refined circular vs rectangular bounds collision model
    const birdRadius = 11; // Slightly smaller radius than drawing to make hitbox fair
    
    // Top Pipe box
    const tBox = { x1: pipe.x, y1: 0, x2: pipe.x + pipe.width, y2: pipe.topHeight };
    // Bottom Pipe box
    const bBox = { x1: pipe.x, y1: this.canvas.height - 120 - pipe.bottomHeight, x2: pipe.x + pipe.width, y2: this.canvas.height - 120 };

    function circleBoxCollision(circle, box) {
      // Find closest point to circle on the rectangle
      const closestX = Math.max(box.x1, Math.min(circle.x, box.x2));
      const closestY = Math.max(box.y1, Math.min(circle.y, box.y2));
      
      const distanceX = circle.x - closestX;
      const distanceY = circle.y - closestY;
      const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
      
      return distanceSquared < (birdRadius * birdRadius);
    }

    return circleBoxCollision(bird, tBox) || circleBoxCollision(bird, bBox);
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Space Sky Background
    const bgGrad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    bgGrad.addColorStop(0, '#06040e');
    bgGrad.addColorStop(0.6, '#0f0b24');
    bgGrad.addColorStop(1, '#1b143c');
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Draw stars (Layer 1 Parallax)
    this.ctx.fillStyle = '#ffffff';
    this.stars.forEach(star => {
      this.ctx.globalAlpha = star.alpha;
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    this.ctx.globalAlpha = 1.0;

    // 3. Draw Cyber City Grid Skyline (Layer 2 Parallax)
    this.drawCitySkyline();

    // 4. Draw game pipes
    this.pipes.forEach(pipe => pipe.draw(this.ctx));

    // 5. Draw particles trail
    this.particles.forEach(p => p.draw(this.ctx));

    // 6. Draw bird player
    this.bird.draw(this.ctx, this.selectedSkin);

    // 7. Draw Cyber Neon Ground Floor (Layer 3)
    this.drawGround();
  }

  drawCitySkyline() {
    this.ctx.save();
    
    // Distant city silhouette with glowing outlines
    const skylineHeights = [140, 190, 110, 160, 220, 130, 180, 90];
    const bldWidth = 60;
    const startX = -this.cityScroll;
    
    // Draw twice for infinite wrap around scrolling
    for (let loopCount = 0; loopCount < 2; loopCount++) {
      const offsetX = loopCount * this.canvas.width;
      
      skylineHeights.forEach((height, i) => {
        const x = startX + offsetX + (i * bldWidth);
        const y = this.canvas.height - 120 - height;
        
        // Building body
        const grad = this.ctx.createLinearGradient(x, y, x, y + height);
        grad.addColorStop(0, 'rgba(30, 22, 64, 0.55)');
        grad.addColorStop(1, 'rgba(10, 8, 22, 0.95)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(x, y, bldWidth - 2, height);
        
        // Cyber building laser outlines
        this.ctx.strokeStyle = 'rgba(253, 38, 120, 0.15)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, bldWidth - 2, height);

        // Windows (tiny glowing grids) - using stable relative positioning to prevent flickering
        this.ctx.fillStyle = 'rgba(0, 242, 254, 0.12)';
        let winIndex = 0;
        for (let wx = x + 8; wx < x + bldWidth - 12; wx += 14) {
          for (let wy = y + 15; wy < y + height - 20; wy += 25) {
            winIndex++;
            if ((winIndex + i * 7) % 3 === 0) { // Stable condition per building
              this.ctx.fillRect(wx, wy, 4, 6);
            }
          }
        }
      });
    }

    ctxRestoreHelper(this.ctx);
  }

  drawGround() {
    const groundY = this.canvas.height - 120;
    const groundHeight = 120;

    this.ctx.save();

    // 1. Dark bottom floor block
    const groundGrad = this.ctx.createLinearGradient(0, groundY, 0, this.canvas.height);
    groundGrad.addColorStop(0, '#0a0816');
    groundGrad.addColorStop(1, '#020105');
    this.ctx.fillStyle = groundGrad;
    this.ctx.fillRect(0, groundY, this.canvas.width, groundHeight);

    // 2. Horizon Neon Grid separator
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = 'var(--neon-blue)';
    this.ctx.strokeStyle = 'var(--neon-blue)';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(0, groundY);
    this.ctx.lineTo(this.canvas.width, groundY);
    this.ctx.stroke();

    // Reset shadow
    this.ctx.shadowBlur = 0;

    // 3. Moving Perspective grid lines
    this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.18)';
    this.ctx.lineWidth = 1.5;
    
    // Vertical perspective lines
    const totalLines = 14;
    for (let i = 0; i <= totalLines; i++) {
      const xTop = (this.canvas.width / totalLines) * i;
      // Perspective warp (fan out towards bottom)
      const xBottom = ((this.canvas.width + 100) / totalLines) * i - 50;
      this.ctx.beginPath();
      this.ctx.moveTo(xTop, groundY);
      this.ctx.lineTo(xBottom, this.canvas.height);
      this.ctx.stroke();
    }

    // Horizontal moving grid lines
    const startOffset = this.groundScroll;
    this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
    for (let gy = groundY + startOffset; gy < this.canvas.height; gy += 24) {
      // Fade lines further down for visual depth
      const ratio = (gy - groundY) / groundHeight;
      this.ctx.globalAlpha = Math.max(0.1, 1.0 - ratio);
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, gy);
      this.ctx.lineTo(this.canvas.width, gy);
      this.ctx.stroke();
    }

    ctxRestoreHelper(this.ctx);
  }
}

// Safely handles restore without causing issues
function ctxRestoreHelper(ctx) {
  ctx.restore();
}

// Instantiate engine when document completes
window.addEventListener('DOMContentLoaded', () => {
  new GameEngine();
});
